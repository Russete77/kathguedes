"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { z } from "zod";

const sendSchema = z.object({
  userId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  senderRole: z.enum(["kath", "sidney", "admin"]),
});

const markReadSchema = z.object({
  userId: z.string().min(1),
});

type Message = {
  id: string;
  user_id: string;
  body: string;
  sender_role: string;
  is_read: boolean;
  created_at: string;
};

export async function listAdminThreadMessages(userId: string): Promise<Message[]> {
  await requireAdmin();
  if (!userId) return [];

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, user_id, body, sender_role, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[admin/chat] list failed: ${error.message}`);
  return (data ?? []) as Message[];
}

/**
 * Poll de novas mensagens depois de `sinceIso`. Retorna só o que entrou depois.
 * Usado pelo inbox pra atualizar em ~3-5s sem depender de Realtime + RLS de admin.
 */
export async function pollAdminThreadMessages(
  userId: string,
  sinceIso: string | null,
): Promise<Message[]> {
  await requireAdmin();
  if (!userId) return [];

  const supabase = createAdminSupabaseClient();
  let q = supabase
    .from("messages")
    .select("id, user_id, body, sender_role, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (sinceIso) q = q.gt("created_at", sinceIso);

  const { data, error } = await q;
  if (error) throw new Error(`[admin/chat] poll failed: ${error.message}`);
  return (data ?? []) as Message[];
}

export async function sendAdminMessage(input: {
  userId: string;
  body: string;
  senderRole: "kath" | "sidney" | "admin";
}): Promise<Message> {
  await requireAdmin();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("send invalid: " + JSON.stringify(parsed.error.flatten()));
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: parsed.data.userId,
      body: parsed.data.body,
      sender_role: parsed.data.senderRole,
      is_read: true,
    })
    .select("id, user_id, body, sender_role, is_read, created_at")
    .single();

  if (error || !data) {
    throw new Error(`[admin/chat] insert failed: ${error?.message ?? "no data"}`);
  }
  return data as Message;
}

export async function markThreadAsRead(input: { userId: string }): Promise<void> {
  await requireAdmin();
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) throw new Error("markRead invalid");

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("user_id", parsed.data.userId)
    .eq("is_read", false)
    .neq("sender_role", "kath")
    .neq("sender_role", "sidney")
    .neq("sender_role", "admin");
}
