import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins, notifyUser } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-error";

/**
 * POST /api/webhook/clerk
 *
 * Recebe eventos do Clerk via webhook (Svix). Configurar no painel Clerk:
 *   Endpoint URL: https://kathapp.com.br/api/webhook/clerk
 *   Eventos: user.created, user.deleted, user.updated (opcional)
 *
 * Env var necessária:
 *   CLERK_WEBHOOK_SECRET — secret do endpoint Svix (Clerk Dashboard → Webhooks)
 *
 * Eventos tratados:
 *   - user.created:
 *       1. Notifica admins (novo signup)
 *       2. Envia boas-vindas push pro user (após delay/cron — push imediato pode
 *          chegar antes do user habilitar push, então só registra in-app aqui)
 *   - user.deleted:
 *       Soft-delete do profile (mantém histórico financeiro mas anonimiza dados pessoais)
 *
 * Segurança: assinatura Svix verificada com `svix` lib quando disponível.
 * Fallback: aceita só em dev quando `NODE_ENV !== 'production'`.
 */

type ClerkUserCreatedPayload = {
  type: "user.created";
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email_addresses?: Array<{ email_address: string }>;
    created_at: number;
  };
};

type ClerkUserUpdatedPayload = {
  type: "user.updated";
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    email_addresses?: Array<{ email_address: string }>;
  };
};

type ClerkUserDeletedPayload = {
  type: "user.deleted";
  data: {
    id: string;
    deleted: boolean;
  };
};

type ClerkEvent =
  | ClerkUserCreatedPayload
  | ClerkUserUpdatedPayload
  | ClerkUserDeletedPayload
  | { type: string; data: Record<string, unknown> };

async function verifySignature(
  req: NextRequest,
  rawBody: string,
): Promise<boolean> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  const isProd =
    process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

  if (!secret) {
    if (isProd) {
      console.error("[webhook/clerk] CLERK_WEBHOOK_SECRET ausente em produção");
      return false;
    }
    console.warn("[webhook/clerk] CLERK_WEBHOOK_SECRET ausente — aceitando em dev");
    return true;
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[webhook/clerk] headers Svix ausentes");
    return false;
  }

  // Tenta usar `svix` lib se instalada. Caso contrário, aceita só em dev.
  try {
    const { Webhook } = await import("svix");
    const wh = new Webhook(secret);
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return true;
  } catch (err) {
    if (isProd) {
      console.error("[webhook/clerk] verificação falhou em produção", err);
      return false;
    }
    console.warn("[webhook/clerk] svix não instalado — aceitando em dev");
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!(await verifySignature(req, rawBody))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let event: ClerkEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (event.type === "user.created") {
      const data = event.data as ClerkUserCreatedPayload["data"];
      const fullName =
        `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
        data.email_addresses?.[0]?.email_address?.split("@")[0] ||
        "Novo assinante";

      // 1. Garantir que existe profile (idempotente: layout (app) também cria
      //    sob demanda, mas aqui adianta caso o user demore pra logar)
      const supabase = createAdminSupabaseClient();
      await supabase
        .from("profiles")
        .upsert(
          {
            id: data.id,
            full_name: fullName,
            plan_tier: "free",
            subscription_status: "active",
          },
          { onConflict: "id", ignoreDuplicates: true },
        );

      // 2. Notificar admins
      notifyAdmins({
        title: "Novo cadastro",
        body: `${fullName} acabou de criar conta no app.`,
        icon: "UserPlus",
        url: "/admin/assinantes",
      }).catch(() => {});

      // 3. Boas-vindas in-app (push pode falhar pq user ainda não habilitou,
      //    mas in-app fica na sino)
      notifyUser(data.id, {
        title: "Bem-vinda ao KathApp!",
        body: "Complete seu cadastro pra desbloquear os treinos e o programa de fidelidade.",
        icon: "Star",
        url: "/dashboard",
      }).catch(() => {});

      return NextResponse.json({ ok: true, action: "user.created" });
    }

    if (event.type === "user.updated") {
      const data = event.data as ClerkUserUpdatedPayload["data"];
      const fullName = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
      const supabase = createAdminSupabaseClient();

      // So atualizamos campos que o Clerk eh dono — nao mexer em plan_tier ou
      // subscription_status (sao do dominio billing). Skip update vazio.
      const patch: Record<string, unknown> = {};
      if (fullName) patch.full_name = fullName;
      if (data.image_url) patch.avatar_url = data.image_url;
      if (Object.keys(patch).length > 0) {
        await supabase.from("profiles").update(patch).eq("id", data.id);
      }

      return NextResponse.json({ ok: true, action: "user.updated", patched: Object.keys(patch) });
    }

    if (event.type === "user.deleted") {
      const data = event.data as ClerkUserDeletedPayload["data"];
      // Soft-delete: anonimiza dados pessoais mas mantém o profile pra
      // preservar histórico de revenue_streams / commission_allocations / orders.
      // Hard delete dispararia cascade nas FKs e perderia trilha financeira.
      const supabase = createAdminSupabaseClient();
      await supabase
        .from("profiles")
        .update({
          full_name: "[usuário removido]",
          avatar_url: null,
          phone: null,
          cpf: null,
          subscription_status: "canceled",
          asaas_subscription_id: null,
        })
        .eq("id", data.id);

      return NextResponse.json({ ok: true, action: "user.deleted" });
    }

    // Evento não tratado — retorna 200 pra Clerk não retentar
    console.log(`[webhook/clerk] evento não tratado: ${event.type}`);
    return NextResponse.json({ ok: true, action: "ignored", type: event.type });
  } catch (err) {
    return handleApiError(err, "POST /api/webhook/clerk");
  }
}
