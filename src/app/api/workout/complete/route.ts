import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/workout/complete
 * Marca treino como concluído, atualiza workout_logs e streak.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let workoutId: string;
  try {
    const body = await req.json();
    workoutId = body.workoutId;
    if (!workoutId) throw new Error("Missing workoutId");
  } catch {
    return NextResponse.json({ error: "workoutId obrigatório" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // 1. Inserir workout_log
  const { error: logError } = await supabase.from("workout_logs").insert({
    user_id: userId,
    workout_id: workoutId,
  });

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // 2. Calcular streak
  const { data: profile } = await supabase
    .from("profiles")
    .select("workout_streak, last_workout_at")
    .eq("id", userId)
    .single();

  let newStreak = 1;
  if (profile) {
    const lastWorkout = profile.last_workout_at
      ? new Date(profile.last_workout_at)
      : null;
    const now = new Date();

    if (lastWorkout) {
      const diffHours =
        (now.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60);

      if (diffHours < 24) {
        // Mesmo dia ou dentro de 24h — manter streak
        newStreak = profile.workout_streak;
      } else if (diffHours < 48) {
        // Dia seguinte — incrementar streak
        newStreak = profile.workout_streak + 1;
      }
      // Mais de 48h — reset para 1 (valor default)
    }
  }

  // 3. Atualizar profile
  await supabase
    .from("profiles")
    .update({
      workout_streak: newStreak,
      last_workout_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return NextResponse.json({
    completed: true,
    streak: newStreak,
  });
}
