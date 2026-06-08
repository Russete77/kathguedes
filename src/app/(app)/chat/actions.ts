"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { hasPlanAccess } from "@/lib/billing/access";
import { notifyAdmins } from "@/lib/notifications";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * Chat user → equipe.
 *
 * Substitui o `useRealtimeMessages` (que dependia do browser client com JWT
 * Clerk → Supabase, quebrado em dev pelo issuer dev nao reconhecido pela
 * Third-Party Auth). Aqui leitura/insert ficam server-side via admin client +
 * filtro explicito por `userId` (sem IDOR), com gate de plano (plano3/atleta —
 * mesmo que a policy `messages_insert_chat` checava).
 *
 * Realtime virou polling 4s, igual ao admin chat.
 */

export interface ChatMessage {
  id: string;
  user_id: string;
  body: string;
  sender_role: "user" | "kath" | "sidney" | "admin";
  is_read: boolean;
  created_at: string;
}

const sendSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

/**
 * Lista o historico completo da conversa do user logado.
 */
export async function listUserMessages(): Promise<ChatMessage[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, user_id, body, sender_role, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[chat] list failed: ${error.message}`);
  return (data ?? []) as ChatMessage[];
}

/**
 * Poll incremental: retorna apenas mensagens criadas depois de `sinceIso`.
 * Pra alimentar o loop de 4s sem refazer toda a query a cada tick.
 */
export async function pollUserMessages(sinceIso: string | null): Promise<ChatMessage[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createAdminSupabaseClient();
  let q = supabase
    .from("messages")
    .select("id, user_id, body, sender_role, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (sinceIso) q = q.gt("created_at", sinceIso);

  const { data, error } = await q;
  if (error) throw new Error(`[chat] poll failed: ${error.message}`);
  return (data ?? []) as ChatMessage[];
}

/**
 * User manda mensagem pra Kath. Gate de plano em codigo (plano3 ou atleta) —
 * espelha a policy RLS `messages_insert_chat`. Notifica admins fire-and-forget.
 */
export async function sendUserMessage(input: {
  body: string;
}): Promise<ChatMessage> {
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) throw new Error("Mensagem inválida");

  // Rate limit: 30 msgs/min/user — generoso pra conversa fluida sem virar spam.
  const { allowed } = await checkRateLimitAsync(`chat-send:${userId}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!allowed) throw new Error("Muitas mensagens em sequência. Aguarde um instante.");

  const supabase = createAdminSupabaseClient();

  // Gate de plano em codigo. Mesma regra da policy SQL.
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, full_name")
    .eq("id", userId)
    .single();

  if (!hasPlanAccess(profile?.plan_tier, "saude_completa")) {
    throw new Error(
      "Chat exclusivo para Plano 3 e Atleta. Faça upgrade pra liberar.",
    );
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: userId,
      body: parsed.data.body,
      sender_role: "user",
      is_read: false,
    })
    .select("id, user_id, body, sender_role, is_read, created_at")
    .single();

  if (error || !data) {
    throw new Error(`[chat] send failed: ${error?.message ?? "no data"}`);
  }

  // Notif aos admins — fire-and-forget. Truncate em ~80 chars pra caber no push.
  const preview =
    parsed.data.body.length > 80
      ? parsed.data.body.slice(0, 80) + "..."
      : parsed.data.body;
  const senderName = (profile?.full_name as string | undefined) ?? "Assinante";
  notifyAdmins({
    title: `Mensagem VIP de ${senderName}`,
    body: preview,
    icon: "MessageCircle",
    url: "/admin/chat",
  }).catch(() => {});

  return data as ChatMessage;
}
