import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PlanEditor } from "./plan-editor";
import { AnamneseViewer } from "./anamnese-viewer";

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

  // Buscar consultoria e templates em paralelo
  const [{ data: consultation }, { data: workoutTemplates }, { data: dietTemplates }] = await Promise.all([
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
  ]);

  if (!consultation) notFound();

  const dbTemplates = {
    workout: (workoutTemplates || []) as { id: string; name: string; description: string | null; data: unknown }[],
    diet: (dietTemplates || []) as { id: string; name: string; description: string | null; data: unknown }[],
  };

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
        <div className="bg-bg-1 border border-yellow/30 rounded-[14px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow/10 rounded-full flex items-center justify-center shrink-0">
            <span className="text-yellow text-lg">!</span>
          </div>
          <div>
            <h3 className="font-display text-lg text-white">
              ANAMNESE NÃO PREENCHIDA
            </h3>
            <p className="text-gray-2 text-sm mt-0.5">
              O assinante ainda não preencheu a ficha de anamnese. O plano pode
              ser montado mesmo assim, mas sem os dados detalhados do aluno.
            </p>
          </div>
        </div>
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
      />
    </div>
  );
}
