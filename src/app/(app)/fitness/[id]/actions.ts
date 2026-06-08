"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { hasPlanAccess } from "@/lib/billing/access";

/**
 * Toggle de like em um treino (RPC atomico).
 * Retorna { liked: boolean, likes_count: int }.
 */
export async function toggleWorkoutLike(workoutId: string): Promise<{
  liked: boolean;
  likes_count: number;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Nao autenticado");

  const id = z.string().uuid().parse(workoutId);
  const supabase = createAdminSupabaseClient();

  // RPC roda como SECURITY DEFINER e bypassa RLS, mas faz check do JWT.
  // Aqui chamamos via admin client (sem JWT do user), entao o JWT claim
  // sub eh null. Trabalhamos em volta: fazer toggle direto via tabela.

  const { data: existing } = await supabase
    .from("workout_likes" as never)
    .select("user_id")
    .eq("user_id" as never, userId)
    .eq("workout_id" as never, id)
    .maybeSingle();

  if (existing) {
    // Deslike
    await supabase
      .from("workout_likes" as never)
      .delete()
      .eq("user_id" as never, userId)
      .eq("workout_id" as never, id);
    const { data: row } = await supabase.rpc(
      "decrement_workout_like" as never,
      { p_workout_id: id } as never,
    );
    // Fallback se RPC nao existe: lemos contagem manualmente
    let likes = 0;
    if (Array.isArray(row) && row[0]) {
      likes = (row[0] as { likes_count?: number }).likes_count ?? 0;
    } else {
      const { data: w } = await supabase
        .from("workout_videos")
        .select("likes_count")
        .eq("id", id)
        .single();
      const wRow = w as { likes_count: number | null } | null;
      likes = wRow?.likes_count ?? 0;
      // Decrement manualmente caso RPC ausente
      await supabase
        .from("workout_videos")
        .update({ likes_count: Math.max(likes - 1, 0) } as never)
        .eq("id", id);
      likes = Math.max(likes - 1, 0);
    }
    revalidatePath(`/fitness/${id}`);
    return { liked: false, likes_count: likes };
  }

  // Like
  await supabase
    .from("workout_likes" as never)
    .insert({ user_id: userId, workout_id: id } as never);
  // Increment manual (sem RPC dependency)
  const { data: w } = await supabase
    .from("workout_videos")
    .select("likes_count")
    .eq("id", id)
    .single();
  const wRow = w as { likes_count: number | null } | null;
  const newCount = (wRow?.likes_count ?? 0) + 1;
  await supabase
    .from("workout_videos")
    .update({ likes_count: newCount } as never)
    .eq("id", id);
  revalidatePath(`/fitness/${id}`);
  return { liked: true, likes_count: newCount };
}

/**
 * Manda uma duvida sobre o treino para o chat VIP. So planos com acesso
 * a chat (saude_completa + atleta) podem usar.
 */
const questionSchema = z.object({
  workout_id: z.string().uuid(),
  workout_title: z.string().min(1).max(200),
  body: z.string().trim().min(2).max(2000),
});

export async function sendWorkoutQuestion(input: {
  workout_id: string;
  workout_title: string;
  body: string;
}): Promise<{ ok: true }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Nao autenticado");

  const data = questionSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  // Gate: so plano com chat
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();
  const planTier =
    (profile as { plan_tier: string | null } | null)?.plan_tier ?? "start";
  // Saude Completa (level 3) e Atleta (level 4) têm chat. Start/Evolucao não.
  if (!hasPlanAccess(planTier as never, "saude_completa")) {
    throw new Error(
      "O chat com a Kath e exclusivo dos planos Saude Completa e Atleta.",
    );
  }

  // Prefixa o body com referencia ao treino pra Kath saber o contexto.
  const message = `[Sobre o treino: ${data.workout_title}]\n\n${data.body}`;

  const { error } = await supabase.from("messages").insert({
    user_id: userId,
    body: message,
    sender_role: "user",
    is_read: false,
  });
  if (error) throw new Error(error.message);

  return { ok: true };
}
