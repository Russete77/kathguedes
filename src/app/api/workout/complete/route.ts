import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { updateWorkoutStreak } from "@/lib/billing/streak";

const completeSchema = z.object({ workoutId: z.string().min(1) });

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
