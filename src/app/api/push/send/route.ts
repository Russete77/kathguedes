import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendPushBroadcast, sendPushToUser } from "@/lib/push/webpush";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/auth-helpers";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/push/send
 * Envia push notification — admin only.
 * Body: { title, body, url?, userId? (null = broadcast), segment? }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate limit: 10 push sends per minute per admin
  const { allowed } = await checkRateLimitAsync(`push:${userId}`, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em 1 minuto." }, { status: 429 });
  }

  // Verify admin role (centralizado)
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Acesso negado: apenas admin pode enviar notificações" }, { status: 403 });
  }

  let payload: { title: string; body: string; url?: string; userId?: string };
  try {
    payload = await req.json();
    if (!payload.title || !payload.body) throw new Error("Missing fields");
  } catch {
    return NextResponse.json({ error: "title e body obrigatórios" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  if (payload.userId) {
    // Push para um usuário específico
    await sendPushToUser(payload.userId, {
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });

    // Criar notificação in-app
    await supabase.from("notifications").insert({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });
  } else {
    // Broadcast para todos
    await sendPushBroadcast({
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });

    // Criar notificação in-app para todos os profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id");

    if (profiles?.length) {
      const notifs = profiles.map((p) => ({
        user_id: p.id,
        title: payload.title,
        body: payload.body,
        url: payload.url,
      }));

      // Insert em batches
      const batchSize = 100;
      for (let i = 0; i < notifs.length; i += batchSize) {
        await supabase
          .from("notifications")
          .insert(notifs.slice(i, i + batchSize));
      }
    }
  }

  return NextResponse.json({ sent: true });
}
