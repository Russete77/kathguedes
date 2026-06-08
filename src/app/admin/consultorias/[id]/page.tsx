import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PlanEditor } from "./plan-editor";
import { AnamneseViewer } from "./anamnese-viewer";
import { NotifyAnamneseButton } from "./notify-anamnese-button";
import { AiDraftButton } from "./ai-draft-button";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("consultations")
    .select("profiles(full_name)")
    .eq("id", id)
    .single();
  const profiles = data?.profiles as unknown as { full_name: string } | null;
  const name = profiles?.full_name;
  return { title: `Consultoria — ${name || "Detalhe"}` };
}

export default async function ConsultationDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  // Buscar consultoria, templates, biblioteca de treinos e catalogo em paralelo
  const [
    { data: consultation },
    { data: workoutTemplates },
    { data: dietTemplates },
    { data: workoutLibrary },
    { data: exerciseCatalog },
  ] = await Promise.all([
    supabase
      .from("consultations")
      .select("*, profiles(full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("plan_templates")
      .select("id, name, description, data")
      .eq("type", "workout")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("plan_templates")
      .select("id, name, description, data")
      .eq("type", "diet")
      .eq("is_active", true)
      .order("name"),
    // Biblioteca de treinos publicados — admin escolhe direto no plan-editor
    // em vez de copiar/colar youtube_id manualmente.
    supabase
      .from("workout_videos")
      .select("id, title, youtube_id, category, level, duration_minutes, required_plan")
      .eq("is_published", true)
      .order("category")
      .order("title"),
    // Catalogo de exercicios (migration 34) — admin escolhe exercicio com
    // defaults de sets/reps/rest preenchidos automaticamente.
    supabase
      .from("exercises")
      .select(
        "id, name, primary_category, level, secondary_groups, equipment, default_sets, default_reps, default_rest, workout_video_id, workout_videos(youtube_id)",
      )
      .eq("is_active", true)
      .order("primary_category")
      .order("sort_order"),
  ]);

  if (!consultation) notFound();

  const dbTemplates = {
    workout: (workoutTemplates || []) as { id: string; name: string; description: string | null; data: unknown }[],
    diet: (dietTemplates || []) as { id: string; name: string; description: string | null; data: unknown }[],
  };

  const library = (workoutLibrary || []) as {
    id: string;
    title: string;
    youtube_id: string;
    category: string;
    level: string;
    duration_minutes: number;
    required_plan: string;
  }[];

  // Catalog: flatten workout_videos.youtube_id (join opcional) pra prop simples
  type CatalogRaw = {
    id: string;
    name: string;
    primary_category: string;
    level: string | null;
    secondary_groups: string[];
    equipment: string[];
    default_sets: number;
    default_reps: string;
    default_rest: number;
    workout_video_id: string | null;
    workout_videos: { youtube_id: string } | { youtube_id: string }[] | null;
  };
  const catalog = ((exerciseCatalog || []) as unknown as CatalogRaw[]).map((e) => {
    const video = Array.isArray(e.workout_videos) ? e.workout_videos[0] : e.workout_videos;
    return {
      id: e.id,
      name: e.name,
      primary_category: e.primary_category,
      level: e.level,
      secondary_groups: e.secondary_groups,
      equipment: e.equipment,
      default_sets: e.default_sets,
      default_reps: e.default_reps,
      default_rest: e.default_rest,
      workout_video_id: e.workout_video_id,
      workout_video_youtube_id: video?.youtube_id ?? null,
    };
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">
          CONSULTORIA — {(consultation.profiles as unknown as { full_name: string })?.full_name?.toUpperCase()}
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Monte o plano de treino e dieta — o assinante visualiza direto no app.
        </p>
      </div>

      {consultation.anamnesis ? (
        <AnamneseViewer anamnesis={consultation.anamnesis as unknown as Parameters<typeof AnamneseViewer>[0]['anamnesis']} />
      ) : (
        <div className="bg-bg-1 border border-yellow/30 rounded-[14px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 bg-yellow/10 rounded-full flex items-center justify-center shrink-0">
            <span className="text-yellow text-lg">!</span>
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg text-white">
              ANAMNESE NÃO PREENCHIDA
            </h3>
            <p className="text-gray-2 text-sm mt-0.5">
              O assinante ainda não preencheu a ficha de anamnese. Notifique-o, ou
              monte o plano mesmo assim (sem os dados detalhados do aluno).
            </p>
          </div>
          <NotifyAnamneseButton consultationId={consultation.id} />
        </div>
      )}

      {consultation.anamnesis && (
        <AiDraftButton
          consultationId={consultation.id}
          hasDraft={!!(consultation as { ai_draft_generated_at?: string | null }).ai_draft_generated_at}
          flags={
            (((consultation as { ai_flags?: unknown }).ai_flags as string[] | null) ?? [])
          }
        />
      )}

      <PlanEditor
        consultationId={consultation.id}
        initialWorkoutPlan={consultation.workout_plan}
        initialDietPlan={consultation.diet_plan}
        initialCalories={consultation.daily_calories}
        initialProtein={consultation.daily_protein}
        initialCarbs={consultation.daily_carbs}
        initialFat={consultation.daily_fat}
        initialNotes={consultation.notes_admin}
        status={consultation.status}
        anamnesis={consultation.anamnesis as unknown as Parameters<typeof PlanEditor>[0]['anamnesis']}
        dbTemplates={dbTemplates}
        workoutLibrary={library}
        exerciseCatalog={catalog}
      />
    </div>
  );
}
