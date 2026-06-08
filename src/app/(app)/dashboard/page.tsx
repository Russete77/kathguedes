import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { planLevel, hasActiveAccess } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";
import { StreakBadge } from "@/components/fitness/streak-badge";
import { WorkoutCard } from "@/components/fitness/workout-card";
import Link from "next/link";
import {
  PlayCircle,
  Target,
  Calculator,
  ShoppingBag,
  Flame,
  ArrowRight,
  Crown,
  ClipboardList,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Seu painel no KathApp — acesse treinos, veja seu progresso de streak, consultoria e loja.",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  // currentUser() faz chamada HTTP para a API do Clerk; quando o Clerk
  // retorna 500 (instabilidade ou chave errada em prod) nao derruba o
  // dashboard — caímos no firstName do profile que ja temos no Supabase.
  let user: Awaited<ReturnType<typeof currentUser>> | null = null;
  try {
    user = await currentUser();
  } catch (e) {
    console.error("[dashboard] currentUser() falhou, usando fallback do profile:", e);
  }
  // Admin client: profile e workouts via RLS bloqueavam em dev (sem A1).
  // Workouts: gate manual de plano (replica workouts_select_by_plan).
  const supabase = createAdminSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId!)
    .single();

  const userLevel = planLevel(
    ((profile?.plan_tier as string) || "start") as PlanTier,
  );
  // Fonte única de acesso (status ativo OU dentro do período pago).
  const hasActiveSub = hasActiveAccess(profile);

  // Consultoria ativa: usada tanto para o CTA de anamnese quanto para mostrar o
  // plano da semana no lugar dos vídeos aleatórios (pagante com plano entregue).
  const { data: activeConsultation } = await supabase
    .from("consultations")
    .select("status, anamnesis, workout_plan, created_at")
    .eq("user_id", userId!)
    .in("status", ["pending", "in_progress", "delivered"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const needsAnamnese =
    !!activeConsultation &&
    activeConsultation.anamnesis == null &&
    ["pending", "in_progress"].includes(activeConsultation.status as string);

  // ── Plano da semana (B6): pagante com consultoria entregue vê o treino da
  // semana atual da periodização (semana calculada pela data de início do plano),
  // em vez de vídeos aleatórios da biblioteca. ──
  type PlanWeek = {
    name?: string;
    intensity?: string;
    is_peak_week?: boolean;
    days?: { name?: string; exercises?: { name?: string; sets?: number; reps?: string }[] }[];
  };
  const workoutPlanWeeks =
    activeConsultation?.status === "delivered"
      ? ((activeConsultation.workout_plan as { weeks?: PlanWeek[] } | null)?.weeks ?? [])
      : [];
  const showConsultationWeek = hasActiveSub && workoutPlanWeeks.length > 0;
  let currentWeek: PlanWeek | null = null;
  let currentWeekIndex = 0;
  if (showConsultationWeek) {
    const startedAt = activeConsultation?.created_at
      ? new Date(activeConsultation.created_at as string)
      : null;
    const weeksElapsed = startedAt
      ? Math.floor((Date.now() - startedAt.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    currentWeekIndex = Math.min(
      Math.max(0, weeksElapsed),
      workoutPlanWeeks.length - 1,
    );
    currentWeek = workoutPlanWeeks[currentWeekIndex] ?? null;
  }

  // Vídeos recentes (fallback / não-pagante): mostra TODOS os últimos publicados
  // e marca isLocked por card — quem não tem acesso vê cadeado → /planos, nunca 404.
  const { data: recentWorkouts } = showConsultationWeek
    ? { data: null }
    : await supabase
        .from("workout_videos")
        .select(
          "id, title, youtube_id, category, level, duration_minutes, required_plan, views_count, is_free_preview, thumbnail_url",
        )
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(4);

  const streak = profile?.workout_streak ?? 0;
  const planTier = (profile?.plan_tier as string) || "start";
  // Prioridade: profile.full_name (Supabase) -> Clerk firstName -> fallback.
  // Pega só o primeiro nome para a saudação ficar curta.
  const fullName = (profile?.full_name as string | null) ?? "";
  const firstFromProfile = fullName.trim().split(/\s+/)[0];
  const firstName =
    firstFromProfile || user?.firstName || "Bem-vinda";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl lg:text-5xl text-white">
            OLÁ, <span className="text-pink">{firstName.toUpperCase()}</span>
          </h1>
          <p className="text-gray-2 text-sm mt-1">
            Bora treinar hoje? Sua evolução depende de você.
          </p>
        </div>
        <StreakBadge streak={streak} />
      </div>

      {/* Anamnese pendente — CTA forte pro aluno preencher logo após pagar */}
      {needsAnamnese && (
        <Link
          href="/consultoria/anamnese"
          className="block bg-gradient-to-r from-pink/15 to-pink/5 border border-pink/40 rounded-[18px] p-5 hover:border-pink transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink rounded-full flex items-center justify-center shrink-0 shadow-pink">
              <ClipboardList size={22} className="stroke-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg text-white">
                PREENCHA SUA <span className="text-pink">ANAMNESE</span>
              </h3>
              <p className="text-gray-2 text-[13px] mt-0.5">
                Sua consultoria já está liberada! Preencha a ficha pra Kath montar
                seu treino e dieta personalizados.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-pink text-sm font-semibold whitespace-nowrap group-hover:gap-2 transition-all">
              Preencher <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame size={20} className="stroke-pink" />}
          value={String(streak)}
          label="Dias de streak"
          accent
        />
        <StatCard
          icon={<Crown size={20} className="stroke-yellow" />}
          value={planTier.toUpperCase()}
          label="Seu plano"
        />
        <StatCard
          icon={<PlayCircle size={20} className="stroke-pink" />}
          value={String(recentWorkouts?.length || 0)}
          label="Treinos novos"
        />
        <StatCard
          icon={<Target size={20} className="stroke-success" />}
          value={profile?.last_workout_at ? "Ativo" : "—"}
          label="Último treino"
        />
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="font-display text-2xl text-white mb-4">ACESSO RÁPIDO</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction href="/fitness" icon={<PlayCircle size={24} />} label="Biblioteca" />
          <QuickAction href="/consultoria" icon={<Target size={24} />} label="Consultoria" />
          <QuickAction href="/calculadora" icon={<Calculator size={24} />} label="Macros" />
          {/* Cupons oculto temporariamente (reativar em breve) — rota mantida. */}
          <QuickAction href="/loja" icon={<ShoppingBag size={24} />} label="Loja" />
        </div>
      </section>

      {/* Plano da semana (pagante com consultoria entregue) */}
      {showConsultationWeek && currentWeek && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl text-white">SEU PLANO DESTA SEMANA</h2>
              <p className="text-gray-3 text-[13px] mt-0.5">
                {currentWeek.name || `Semana ${currentWeekIndex + 1}`}
                {currentWeek.intensity ? ` · ${currentWeek.intensity}` : ""}
                {currentWeek.is_peak_week ? " · semana de pico" : ""}
              </p>
            </div>
            <Link
              href="/consultoria"
              className="text-[13px] text-pink flex items-center gap-1 hover:text-pink-light transition-colors whitespace-nowrap"
            >
              Abrir consultoria <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(currentWeek.days ?? []).map((day, di) => (
              <Link
                key={di}
                href="/consultoria"
                className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="stroke-pink" />
                  <h3 className="text-white text-[15px] font-bold group-hover:text-pink transition-colors">
                    {day.name || `Dia ${di + 1}`}
                  </h3>
                </div>
                <ul className="space-y-1">
                  {(day.exercises ?? []).slice(0, 5).map((ex, ei) => (
                    <li key={ei} className="text-gray-2 text-[13px] flex justify-between gap-2">
                      <span className="truncate">{ex.name || "Exercício"}</span>
                      {(ex.sets || ex.reps) && (
                        <span className="font-mono text-[11px] text-gray-3 shrink-0">
                          {ex.sets ?? ""}{ex.reps ? `×${ex.reps}` : ""}
                        </span>
                      )}
                    </li>
                  ))}
                  {(day.exercises?.length ?? 0) > 5 && (
                    <li className="text-gray-3 text-[11px]">
                      +{(day.exercises?.length ?? 0) - 5} exercícios
                    </li>
                  )}
                  {(day.exercises?.length ?? 0) === 0 && (
                    <li className="text-gray-3 text-[12px]">Sem exercícios</li>
                  )}
                </ul>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Vídeos recentes (não-pagante ou sem consultoria entregue) — com cadeado */}
      {!showConsultationWeek && recentWorkouts && recentWorkouts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-white">VÍDEOS RECENTES</h2>
            <Link
              href="/fitness"
              className="text-[13px] text-pink flex items-center gap-1 hover:text-pink-light transition-colors"
            >
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentWorkouts.map((w) => {
              const isLocked = !(
                (w as { is_free_preview?: boolean }).is_free_preview === true ||
                (hasActiveSub && planLevel(w.required_plan as PlanTier) <= userLevel)
              );
              return (
                <WorkoutCard
                  key={w.id}
                  id={w.id}
                  title={w.title}
                  youtube_id={w.youtube_id}
                  category={w.category}
                  level={w.level}
                  duration_minutes={w.duration_minutes}
                  required_plan={w.required_plan}
                  views_count={w.views_count}
                  thumbnail_url={(w as { thumbnail_url?: string | null }).thumbnail_url}
                  isLocked={isLocked}
                />
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/35 transition-all">
      <div className="mb-2">{icon}</div>
      <div className={`font-display text-[28px] leading-none ${accent ? "text-pink" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[12px] text-gray-3 mt-1">{label}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-bg-1 border border-gray-4 rounded-[14px] hover:border-pink/40 hover:bg-bg-2 transition-all duration-150 group"
    >
      <div className="w-12 h-12 bg-pink-dim rounded-[14px] flex items-center justify-center border border-pink/20 text-pink group-hover:shadow-[0_0_16px_rgba(255,0,128,0.2)] transition-shadow">
        {icon}
      </div>
      <span className="text-[12px] font-semibold text-gray-2 group-hover:text-white transition-colors">
        {label}
      </span>
    </Link>
  );
}
