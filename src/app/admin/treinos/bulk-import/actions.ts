"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { extractYoutubeId } from "@/lib/youtube/embed";
import { revalidatePath } from "next/cache";

type LevelKey = "iniciante" | "intermediario" | "avancado";

export interface ParsedExercise {
  youtube_id: string;
  level: LevelKey;
  workoutNumber: number;
  exerciseNumber: number;
  note?: string;
  rawUrl: string;
}

export interface ParseResult {
  exercises: ParsedExercise[];
  warnings: string[];
}

export async function parseBulkText(text: string): Promise<ParseResult> {
  await requireAdmin();

  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  let currentLevel: LevelKey | null = null;
  let currentWorkout = 0;
  let exerciseCounter = 0;
  const exercises: ParsedExercise[] = [];
  const seenIds = new Set<string>();

  function normalizeLevel(raw: string): LevelKey | null {
    const s = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]/g, "");
    if (s.startsWith("iniciante")) return "iniciante";
    if (s.startsWith("intermediario")) return "intermediario";
    if (s.startsWith("avancado")) return "avancado";
    return null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const lvl = normalizeLevel(line);
    if (lvl && !/^TREINO/i.test(line) && !line.includes("http")) {
      currentLevel = lvl;
      currentWorkout = 0;
      exerciseCounter = 0;
      continue;
    }

    const workoutMatch = line.match(/^TREINO\s*(\d+)/i);
    if (workoutMatch) {
      currentWorkout = parseInt(workoutMatch[1], 10);
      exerciseCounter = 0;
      continue;
    }

    const urlMatch = line.match(/https?:\/\/\S+/);
    if (!urlMatch) continue;

    const url = urlMatch[0].replace(/[),.]+$/, "");
    const ytId = extractYoutubeId(url);
    if (!ytId) {
      warnings.push(`URL invalida ignorada: ${url}`);
      continue;
    }
    if (!currentLevel || !currentWorkout) {
      warnings.push(`Link sem nivel/treino definido (ignorado): ${url}`);
      continue;
    }

    const noteMatch = line.match(/\(([^)]+)\)/);
    const note = noteMatch ? noteMatch[1].trim() : undefined;

    if (seenIds.has(ytId)) {
      warnings.push(
        `Duplicado no texto (ignorado): ${ytId} (${currentLevel} treino ${currentWorkout})`,
      );
      continue;
    }
    seenIds.add(ytId);

    exerciseCounter += 1;
    exercises.push({
      youtube_id: ytId,
      level: currentLevel,
      workoutNumber: currentWorkout,
      exerciseNumber: exerciseCounter,
      note,
      rawUrl: url,
    });
  }

  return { exercises, warnings };
}

export interface ImportResult {
  inserted: number;
  skipped_existing: number;
  errors: string[];
}

export async function commitBulkImport(
  exercises: ParsedExercise[],
): Promise<ImportResult> {
  await requireAdmin();
  if (exercises.length === 0) {
    return { inserted: 0, skipped_existing: 0, errors: [] };
  }

  const supabase = createAdminSupabaseClient();

  const ids = exercises.map((e) => e.youtube_id);
  const { data: existingRaw } = await supabase
    .from("workout_videos")
    .select("youtube_id")
    .in("youtube_id", ids);
  const existing = new Set(
    ((existingRaw ?? []) as Array<{ youtube_id: string }>).map((r) => r.youtube_id),
  );

  const levelLabel: Record<LevelKey, string> = {
    iniciante: "Iniciante",
    intermediario: "Intermediario",
    avancado: "Avancado",
  };

  const rows: Array<Record<string, unknown>> = [];
  for (const ex of exercises) {
    if (existing.has(ex.youtube_id)) continue;
    const title = `${levelLabel[ex.level]} - Treino ${String(ex.workoutNumber).padStart(2, "0")} - Exercicio ${String(ex.exerciseNumber).padStart(2, "0")}`;
    rows.push({
      title,
      youtube_id: ex.youtube_id,
      category: "full",
      level: ex.level,
      duration_minutes: 1,
      required_plan: "start",
      is_published: false,
      is_short: true,
      notes: ex.note ?? null,
    });
  }

  if (rows.length === 0) {
    return {
      inserted: 0,
      skipped_existing: exercises.length,
      errors: [],
    };
  }

  const { error } = await supabase.from("workout_videos").insert(rows as never);
  if (error) {
    return {
      inserted: 0,
      skipped_existing: existing.size,
      errors: [error.message],
    };
  }

  revalidatePath("/admin/treinos");
  return {
    inserted: rows.length,
    skipped_existing: existing.size,
    errors: [],
  };
}
