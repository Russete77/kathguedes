import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { updateWorkoutStreak } from "@/lib/billing/streak";
import { planLevel, hasLibraryAccess } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";

const completeSchema = z.object({ workoutId: z.string().uuid() });

/**
 * POST /api/workout/complete
 * Marca treino como concluído, atualiza workout_logs e streak.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = completeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "workoutId obrigatório" }, { status: 400 });
  }
  const { workoutId } = parsed.data;

  const supabase = createAdminSupabaseClient();

  // 0. Gate: o treino precisa existir/estar publicado E o usuário precisa ter
  //    acesso (mesma regra de /fitness/[id]: is_free_preview destranca; senão
  //    exige acesso de biblioteca — pago ou trial — e tier >= required_plan).
  //    Sem isso, qualquer usuário logado poderia inflar logs/streak de conteúdo
  //    bloqueado ou inexistente (auditoria 2026-06-16).
  const [{ data: workout }, { data: profile }] = await Promise.all([
    supabase
      .from("workout_videos")
      .select("id, required_plan, is_free_preview")
      .eq("id", workoutId)
      .eq("is_published", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("plan_tier, subscription_status, subscription_ends_at, created_at")
      .eq("id", userId)
      .single(),
  ]);

  if (!workout) {
    return NextResponse.json({ error: "Treino não encontrado" }, { status: 404 });
  }

  const w = workout as { required_plan?: string | null; is_free_preview?: boolean };
  const userLevel = planLevel(((profile?.plan_tier as string) || "start") as PlanTier);
  const tierOk = planLevel((w.required_plan as PlanTier) ?? "start") <= userLevel;
  const canComplete =
    w.is_free_preview === true ||
    (hasLibraryAccess(
      profile as {
        subscription_status?: string | null;
        subscription_ends_at?: string | null;
        created_at?: string | null;
      } | null,
    ) &&
      tierOk);

  if (!canComplete) {
    return NextResponse.json({ error: "Sem acesso a este treino" }, { status: 403 });
  }

  // 1. Inserir workout_log
  const { error: logError } = await supabase.from("workout_logs").insert({
    user_id: userId,
    workout_id: workoutId,
  });

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // 2. Streak atômico (RPC com fallback — ver lib/billing/streak).
  const newStreak = await updateWorkoutStreak(supabase, userId);

  return NextResponse.json({
    completed: true,
    streak: newStreak,
  });
}
