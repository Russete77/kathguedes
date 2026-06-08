"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";

export interface CatalogExercise {
  id: string;
  name: string;
  primary_category: string;
  secondary_groups: string[];
  default_sets: number;
  default_reps: string;
  default_rest: number;
  notes: string | null;
  workout_video_id: string | null;
  youtube_id: string | null;
}

/**
 * Lista o catálogo de exercícios (apenas ativos) com o youtube_id já resolvido
 * via JOIN com workout_videos. Usado no picker do template editor.
 */
export async function listCatalogExercises(): Promise<CatalogExercise[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("exercises" as never)
    .select(
      "id, name, primary_category, secondary_groups, default_sets, default_reps, default_rest, notes, workout_video_id, workout_videos(youtube_id)" as never,
    )
    .eq("is_active" as never, true)
    .order("primary_category" as never, { ascending: true })
    .order("name" as never, { ascending: true });
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    name: string;
    primary_category: string;
    secondary_groups: string[] | null;
    default_sets: number;
    default_reps: string;
    default_rest: number;
    notes: string | null;
    workout_video_id: string | null;
    workout_videos: { youtube_id: string } | { youtube_id: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const wv = Array.isArray(r.workout_videos) ? r.workout_videos[0] : r.workout_videos;
    return {
      id: r.id,
      name: r.name,
      primary_category: r.primary_category,
      secondary_groups: r.secondary_groups ?? [],
      default_sets: r.default_sets,
      default_reps: r.default_reps,
      default_rest: r.default_rest,
      notes: r.notes,
      workout_video_id: r.workout_video_id,
      youtube_id: wv?.youtube_id ?? null,
    };
  });
}
