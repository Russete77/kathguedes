import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { VideoPlayer } from "@/components/fitness/video-player";
import { RestTimer } from "@/components/fitness/rest-timer";
import { CompleteWorkoutButton } from "./complete-button";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Clock, BarChart2, Target, Dumbbell, Info, Heart,
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
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("workout_videos")
    .select("title")
    .eq("id", id)
    .single();
  return { title: data?.title || "Treino" };
}

export default async function WorkoutPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();
  const supabase = createAdminSupabaseClient();

  const { data: workout } = await supabase
    .from("workout_videos")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!workout) notFound();

  // Buscar próximos treinos da mesma categoria
  const { data: relatedWorkouts } = await supabase
    .from("workout_videos")
    .select("id, title, youtube_id, duration_minutes, category")
    .eq("is_published", true)
    .eq("category", workout.category)
    .neq("id", workout.id)
    .order("published_at", { ascending: false })
    .limit(3);

  // Verificar se já completou hoje
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
