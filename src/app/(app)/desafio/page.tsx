import type { Metadata } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PLAN_LEVELS, planLevel } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";
import { auth } from "@clerk/nextjs/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Flame, PlayCircle, Lock, Check, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Desafio da Semana",
  description: "Participe do desafio fitness semanal do KathApp — exercícios exclusivos, ranking e prêmios. Desafie-se com a comunidade.",
};

export default async function DesafioPage() {
  const { userId } = await auth();
  // Admin client: workouts via RLS bloqueavam em dev. workout_logs idem.
  // Workouts ainda gateados por plano (replica policy).
  const supabase = createAdminSupabaseClient();

  const { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("id", userId)
        .single()
    : { data: null };
  const userLevel = planLevel(
    ((profile?.plan_tier as string) || "free") as PlanTier,
  );
  const allowedTiers = (Object.keys(PLAN_LEVELS) as PlanTier[]).filter(
    (t) => PLAN_LEVELS[t] <= userLevel,
  );

  // Buscar treinos da semana (últimos 7 publicados, gateados por plano)
  const { data: weekWorkouts } = await supabase
    .from("workout_videos")
    .select("id, title, youtube_id, category, duration_minutes, required_plan")
    .eq("is_published", true)
    .in("required_plan", allowedTiers)
    .order("published_at", { ascending: false })
    .limit(7);

  // Calcular completedDays baseado em workout_logs da semana
  let completedDays = 0;
  if (userId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: logs, error } = await supabase
      .from("workout_logs")
      .select("completed_at")
      .eq("user_id", userId)
      .gte("completed_at", sevenDaysAgo.toISOString())
      .order("completed_at", { ascending: false });

    if (!error && logs) {
      // Contar dias distintos
      const distinctDays = new Set(
        logs.map((log) => new Date(log.completed_at).toDateString())
      );
      completedDays = Math.min(distinctDays.size, 7);
    }
  }

  const totalDays = 7;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-glow-pink opacity-15 pointer-events-none" />
        <div className="relative z-10 text-center">
          <Badge variant="yellow" className="mb-3">
            <Zap size={12} />
            DESAFIO ATIVO
          </Badge>
          <h1 className="font-display text-4xl lg:text-5xl text-white mb-2">
            7 DIAS DE
            <br />
            <span className="text-pink">GLÚTEO</span>
          </h1>
          <p className="text-gray-2 text-[14px] mb-4">
            Complete 7 treinos em 7 dias e ganhe o badge de dedicação.
          </p>
          <Progress
            value={completedDays}
            max={totalDays}
            displayValue={`${completedDays}/${totalDays} dias`}
            label="Progresso"
          />
        </div>
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {Array.from({ length: totalDays }).map((_, dayIdx) => {
          const workout = weekWorkouts?.[dayIdx];
          const isCompleted = dayIdx < completedDays;
          const isToday = dayIdx === completedDays;
          const isLocked = dayIdx > completedDays;

          return (
            <div
              key={dayIdx}
              className={`bg-bg-1 border rounded-[14px] p-4 flex items-center gap-4 transition-all ${
                isCompleted
                  ? "border-success/30"
                  : isToday
                  ? "border-pink/40"
                  : "border-gray-4 opacity-60"
              }`}
            >
              {/* Day number */}
              <div
                className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 border ${
                  isCompleted
                    ? "bg-success/15 border-success/30"
                    : isToday
                    ? "bg-pink-dim border-pink/30"
                    : "bg-bg-2 border-gray-4"
                }`}
              >
                {isCompleted ? (
                  <Check size={20} className="stroke-success" strokeWidth={2.5} />
                ) : isLocked ? (
                  <Lock size={18} className="stroke-gray-3" />
                ) : (
                  <Flame size={20} className="stroke-pink" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] text-gray-3 tracking-[0.08em] uppercase">
                  Dia {dayIdx + 1}
                </div>
                <div className="text-white text-[14px] font-bold truncate">
                  {workout?.title || `Treino do Dia ${dayIdx + 1}`}
                </div>
                {workout && (
                  <span className="font-mono text-[11px] text-gray-3">
                    {workout.duration_minutes} min
                  </span>
                )}
              </div>

              {/* Action */}
              {isToday && workout && (
                <Link href={`/fitness/${workout.id}`}>
                  <Button size="sm">
                    <PlayCircle size={14} />
                    Treinar
                  </Button>
                </Link>
              )}
              {isCompleted && (
                <Badge variant="green">Feito</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
