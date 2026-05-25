import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { PLAN_LEVELS, planLevel } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";
import { VideoPlayer } from "@/components/fitness/video-player";
import { RestTimer } from "@/components/fitness/rest-timer";
import { CompleteWorkoutButton } from "./complete-button";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Clock, BarChart2, Target, Dumbbell, Info,
} from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

const categoryLabels: Record<string, string> = {
  gluteo: "Glúteos", pernas: "Pernas", costas: "Costas", ombro: "Ombro",
  biceps: "Bíceps", triceps: "Tríceps", peito: "Peito", abdomen: "Abdômen",
  superior: "Superior", hiit: "HIIT", cardio: "Cardio", funcional: "Funcional",
  full: "Completo", alongamento: "Alongamento", aquecimento: "Aquecimento",
  viagem: "Viagem", competicao: "Competição",
};

const levelLabels: Record<string, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  // Admin client + gate manual por plano: titulo so vaza se o user tem nivel >= required_plan.
  // Antes era RLS client (workouts_select_by_plan); em dev o JWT do Clerk dev nao eh aceito
  // pelo Supabase e o titulo voltava como "Treino" pra todo mundo. O gate de seguranca eh
  // identico, so movido pra codigo.
  const { userId } = await auth();
  const admin = createAdminSupabaseClient();
  const [{ data: workout }, { data: profile }] = await Promise.all([
    admin
      .from("workout_videos")
      .select("title, required_plan")
      .eq("id", id)
      .single(),
    admin.from("profiles").select("plan_tier").eq("id", userId!).single(),
  ]);
  if (!workout) return { title: "Treino" };
  const userLevel = planLevel(((profile?.plan_tier as string) || "free") as PlanTier);
  const required = planLevel(workout.required_plan as PlanTier);
  if (userLevel < required) return { title: "Treino" };
  return { title: workout.title || "Treino" };
}

export default async function WorkoutPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();
  // Antes a policy workouts_select_by_plan gateava (C4 do audit). Em dev o JWT do Clerk
  // nao eh aceito pelo Supabase e mesmo treino free voltava vazio → 404 generalizado.
  // Movemos o gate pra codigo (mesma logica: planLevel(user) >= planLevel(required_plan))
  // usando admin client. Sem regressao de seguranca — o gate explicit aqui eh o mesmo
  // SQL que a RLS aplica.
  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();
  const userTier = ((profile?.plan_tier as string) || "free") as PlanTier;
  const userLevel = planLevel(userTier);

  const { data: workout } = await admin
    .from("workout_videos")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!workout) notFound();
  // Gate manual — equivalente a workouts_select_by_plan.
  if (planLevel(workout.required_plan as PlanTier) > userLevel) notFound();

  const allowedTiers = (Object.keys(PLAN_LEVELS) as PlanTier[]).filter(
    (t) => PLAN_LEVELS[t] <= userLevel,
  );

  const { data: relatedWorkouts } = await admin
    .from("workout_videos")
    .select("id, title, youtube_id, duration_minutes, category")
    .eq("is_published", true)
    .eq("category", workout.category)
    .in("required_plan", allowedTiers)
    .neq("id", workout.id)
    .order("published_at", { ascending: false })
    .limit(3);

  // Verificar se já completou hoje (depende de RLS no workout_logs; em dev sem A1
  // pode voltar vazio e alreadyCompleted sera false — UX degradada, sem risco).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayLog } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("user_id", userId!)
    .eq("workout_id", workout.id)
    .gte("completed_at", today.toISOString())
    .limit(1)
    .single();

  const alreadyCompleted = !!todayLog;
  const equipment = (workout.equipment as string[]) || [];
  const isShort = workout.is_short || false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <Link
        href="/fitness"
        className="inline-flex items-center gap-2 text-gray-2 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Voltar para treinos
      </Link>

      {/* Player — adapta pra Shorts ou Normal */}
      <VideoPlayer
        youtube_id={workout.youtube_id}
        title={workout.title}
        is_short={isShort}
      />

      {/* Info + Complete */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl leading-none text-white">
            {workout.title.toUpperCase()}
          </h1>
          {workout.description && (
            <p className="text-gray-2 text-[14px] mt-2 leading-relaxed">
              {workout.description}
            </p>
          )}
        </div>
        <CompleteWorkoutButton
          workoutId={workout.id}
          alreadyCompleted={alreadyCompleted}
        />
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="pink">
          {categoryLabels[workout.category] || workout.category}
        </Badge>
        <Badge variant="white">
          <Target size={12} />
          {levelLabels[workout.level] || workout.level}
        </Badge>
        <Badge variant="white">
          <Clock size={12} />
          {workout.duration_minutes} min
        </Badge>
        <Badge variant="dark">
          <BarChart2 size={12} />
          {workout.views_count} views
        </Badge>
      </div>

      {/* Equipamentos */}
      {equipment.length > 0 && (
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell size={16} className="stroke-pink" />
            <span className="font-mono text-[11px] text-gray-2 tracking-[0.1em] uppercase">
              Equipamentos
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq, i) => (
              <Badge key={i} variant="dark">{eq}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notas da Kath */}
      {workout.notes && (
        <div className="bg-bg-1 border border-pink/20 rounded-[14px] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={16} className="stroke-pink" />
            <span className="font-mono text-[11px] text-pink tracking-[0.1em] uppercase">
              Dica da Kath
            </span>
          </div>
          <p className="text-gray-1 text-[14px] leading-relaxed">
            {workout.notes}
          </p>
        </div>
      )}

      {/* Cronômetro de descanso */}
      <RestTimer />

      {/* Próximos treinos */}
      {relatedWorkouts && relatedWorkouts.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-white mb-3">
            TREINOS RELACIONADOS
          </h2>
          <div className="space-y-2">
            {relatedWorkouts.map((w) => (
              <Link
                key={w.id}
                href={`/fitness/${w.id}`}
                className="flex items-center gap-4 bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 hover:translate-x-1 transition-all duration-200 group"
              >
                <div
                  className="w-16 h-16 rounded-[8px] bg-bg-2 bg-cover bg-center shrink-0 border border-gray-4"
                  style={{
                    backgroundImage: `url(https://img.youtube.com/vi/${w.youtube_id}/mqdefault.jpg)`,
                  }}
                />
                <div className="flex-1">
                  <div className="text-white text-[14px] font-bold group-hover:text-pink transition-colors">
                    {w.title}
                  </div>
                  <div className="font-mono text-[11px] text-gray-3 flex gap-3 mt-1">
                    <span>{w.duration_minutes} min</span>
                    <span>{categoryLabels[w.category] || w.category}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
