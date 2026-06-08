import "server-only";

/**
 * Atualiza o streak de treino de forma atômica.
 *
 * Caminho preferido: RPC `update_workout_streak(p_user_id)` (migration 50),
 * que faz SELECT ... FOR UPDATE + UPDATE numa transação — sem race condition.
 *
 * Fallback (enquanto a migration não estiver aplicada): replica a lógica em
 * código (SELECT-then-UPDATE, não atômico). Assim a rota funciona antes e
 * depois da migration, sem quebrar.
 */
type RpcResult = { data: unknown; error: { message?: string } | null };
type StreakClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        single: () => Promise<{
          data: {
            workout_streak: number | null;
            last_workout_at: string | null;
          } | null;
        }>;
      };
    };
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<unknown>;
    };
  };
};

export async function updateWorkoutStreak(
  client: unknown,
  userId: string,
): Promise<number> {
  const c = client as StreakClient;

  // 1) Caminho atômico via RPC.
  try {
    const { data, error } = await c.rpc("update_workout_streak", {
      p_user_id: userId,
    });
    if (!error && typeof data === "number") return data;
  } catch {
    // ignora — cai no fallback
  }

  // 2) Fallback inline (não atômico).
  const { data: profile } = await c
    .from("profiles")
    .select("workout_streak, last_workout_at")
    .eq("id", userId)
    .single();

  let newStreak = 1;
  if (profile) {
    const last = profile.last_workout_at
      ? new Date(profile.last_workout_at)
      : null;
    if (last) {
      const diffHours = (Date.now() - last.getTime()) / 3_600_000;
      if (diffHours < 24) {
        newStreak = Math.max(1, profile.workout_streak ?? 1);
      } else if (diffHours < 48) {
        newStreak = (profile.workout_streak ?? 0) + 1;
      }
      // > 48h → reseta para 1
    }
  }

  await c
    .from("profiles")
    .update({
      workout_streak: newStreak,
      last_workout_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return newStreak;
}
