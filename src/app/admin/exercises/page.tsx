import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { ExerciseList } from "./exercise-list";
import { ExerciseForm } from "./exercise-form";
import type { ExerciseRow } from "@/lib/supabase/types";

export const metadata = { title: "Catálogo de Exercícios" };

export default async function AdminExercisesPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const [{ data: exercises }, { data: videos }] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .order("primary_category")
      .order("sort_order")
      .order("name"),
    // Lista enxuta de workout_videos pra select de "linkar com biblioteca"
    supabase
      .from("workout_videos")
      .select("id, title, category")
      .eq("is_published", true)
      .order("title"),
  ]);

  const rows = (exercises ?? []) as ExerciseRow[];
  const videoOptions = (videos ?? []) as { id: string; title: string; category: string }[];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">CATÁLOGO DE EXERCÍCIOS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Cadastre exercícios uma vez — admin escolhe direto no plan-editor da consultoria.
          </p>
        </div>
        <ExerciseForm videoOptions={videoOptions} />
      </div>

      <ExerciseList exercises={rows} videoOptions={videoOptions} />
    </div>
  );
}
