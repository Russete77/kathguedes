import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyAdmins } from "@/lib/notifications";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

/**
 * POST /api/chat/notify
 *
 * Disparado pelo hook `useRealtimeMessages.sendMessage` no client APÓS o insert
 * em `messages` ter sido feito. O insert em si segue via Supabase JS direto
 * (preservando o realtime), esta rota só serve pra notificar admins.
 *
 * Body: { body: string }  — o conteúdo da mensagem recém-enviada
 *
 * Segurança: rate limit por user (10/min) + auth obrigatório + truncate do
 * body antes de exibir.
 */

const bodySchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimitAsync(`chat-notify:${userId}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const clerkUser = await currentUser();
    const senderLabel =
      clerkUser?.firstName ||
      clerkUser?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      "Assinante";

    const snippet =
      parsed.data.body.length > 80
        ? parsed.data.body.slice(0, 80) + "..."
        : parsed.data.body;

    await notifyAdmins({
      title: `Nova mensagem de ${senderLabel}`,
      body: snippet,
      icon: "MessageCircle",
      url: "/admin/chat",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "POST /api/chat/notify");
  }
}
