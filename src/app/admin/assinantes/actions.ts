"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { notifyUser } from "@/lib/notifications";
import { planTierSchema } from "@/lib/validations";
import type { PlanTier } from "@/lib/supabase/types";

const subscriptionStatusSchema = z.enum(["active", "past_due", "canceled"]);

/**
 * Toggle de status da assinatura. Não cancela no Asaas — só atualiza o registro
 * local. Use para corrigir desalinhamento ou para suspender acesso manualmente.
 *
 * Para cancelamento financeiro real (cobrança Asaas), use /api/checkout/cancel.
 */
export async function setSubscriptionStatus(input: {
  user_id: string;
  status: "active" | "past_due" | "canceled";
}): Promise<{ ok: true; previousStatus: string | null }> {
  await requireAdmin();
  const data = z
    .object({
      user_id: z.string().min(1),
      status: subscriptionStatusSchema,
    })
    .parse(input);
  const supabase = createAdminSupabaseClient();

  const { data: prev } = await supabase
    .from("profiles")
    .select("subscription_status, full_name")
    .eq("id", data.user_id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_status: data.status })
    .eq("id", data.user_id);
  if (error) throw new Error(error.message);

  // Notif ao user só em mudanças significativas
  if (prev?.subscription_status !== data.status) {
    const messages: Record<string, { title: string; body: string }> = {
      active: {
        title: "Sua assinatura está ativa",
        body: "Acesso liberado novamente.",
      },
      past_due: {
        title: "Pagamento em atraso",
        body: "Regularize a cobrança para continuar com o acesso.",
      },
      canceled: {
        title: "Assinatura cancelada",
        body: "Seu plano foi marcado como cancelado pelo admin.",
      },
    };
    const msg = messages[data.status];
    if (msg) {
      notifyUser(data.user_id, {
        ...msg,
        icon: data.status === "active" ? "Check" : "AlertTriangle",
        url: "/planos",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin/assinantes");
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
  return { ok: true, previousStatus: (prev?.subscription_status as string | null) ?? null };
}

/**
 * Wrapper local da action de tier — espelha /admin/users/actions.ts:setTestUserTier,
 * com revalidate para /admin/assinantes.
 */
const setTierSchema = z.object({
  user_id: z.string().min(1),
  tier: planTierSchema,
});

export async function setAssinantePlan(input: {
  user_id: string;
  tier: PlanTier;
}): Promise<{ ok: true; previousTier: string | null; newTier: PlanTier }> {
  await requireAdmin();
  const data = setTierSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  const { data: prevProfile } = await supabase
    .from("profiles")
    .select("plan_tier, full_name")
    .eq("id", data.user_id)
    .single();
  const prevTier = (prevProfile as { plan_tier: string | null } | null)?.plan_tier ?? null;

  const isPaid = data.tier !== "free";
  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      plan_tier: data.tier,
      // status segue regra simples: pago → active, free → canceled.
      // Para ajustes mais finos, usar setSubscriptionStatus separado.
      subscription_status: isPaid ? "active" : "canceled",
    })
    .eq("id", data.user_id);
  if (updErr) throw new Error(updErr.message);

  // Consultoria automatica (espelha webhook)
  const tierToPackage: Partial<Record<PlanTier, "mensal" | "premium">> = {
    plano2: "mensal",
    plano3: "mensal",
    atleta: "premium",
  };
  const packageType = tierToPackage[data.tier];
  if (packageType) {
    const { data: existing } = await supabase
      .from("consultations")
      .select("id")
      .eq("user_id", data.user_id)
      .in("status", ["pending", "in_progress"])
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      await supabase.from("consultations").insert({
        user_id: data.user_id,
        package_type: packageType,
        status: "pending",
        valid_until: validUntil.toISOString(),
      });
    }
  }

  notifyUser(data.user_id, {
    title: "Seu plano foi atualizado",
    body: `Agora você está no plano ${data.tier}.`,
    icon: "Crown",
    url: "/planos",
  }).catch(() => {});

  // Invalidar paginas admin + as paginas do user que leem plan_tier — sem isso,
  // o client-router cache do Next mantem o estado antigo do /perfil, /dashboard,
  // /fitness etc, e o operador acha que o update nao pegou. layout-level revalida
  // tudo abaixo de uma so vez (gates de plano espalhados sao varios paths).
  revalidatePath("/admin/assinantes");
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");

  return { ok: true, previousTier: prevTier, newTier: data.tier };
}
