/**
 * Catálogo único de categorias de treino.
 *
 * Fonte de verdade compartilhada entre:
 * - Zod schema (`src/lib/validations.ts` — createWorkoutSchema.category)
 * - Form admin (`src/app/admin/treinos/workout-form.tsx` — SelectItem)
 * - Edit admin (`src/app/admin/treinos/workout-edit.tsx` — SelectItem)
 * - CHECK constraint no DB (`supabase/schema.sql` — só atualizar via migration)
 *
 * Adicionar nova categoria: incluir aqui + criar migration ALTER CHECK em
 * workout_videos.category. As 3 referências de código pegam automático.
 */

export const WORKOUT_CATEGORIES = [
  { value: "gluteo",      label: "Glúteo" },
  { value: "quadriceps",  label: "Quadríceps" },
  { value: "posterior",   label: "Posterior de Coxa" },
  { value: "panturrilha", label: "Panturrilha" },
  { value: "costas",      label: "Costas" },
  { value: "ombro",       label: "Ombro" },
  { value: "biceps",      label: "Bíceps" },
  { value: "triceps",     label: "Tríceps" },
  { value: "peito",       label: "Peito" },
  { value: "abdomen",     label: "Abdômen" },
  { value: "superior",    label: "Superiores" },
  { value: "inferior",    label: "Inferiores" },
  { value: "hiit",        label: "HIIT" },
  { value: "cardio",      label: "Cardio" },
  { value: "funcional",   label: "Funcional" },
  { value: "full",        label: "Full Body" },
  { value: "alongamento", label: "Alongamento" },
  { value: "aquecimento", label: "Aquecimento" },
  { value: "viagem",      label: "Viagem" },
  { value: "competicao",  label: "Competição" },
] as const;

export type WorkoutCategorySlug = typeof WORKOUT_CATEGORIES[number]["value"];

/**
 * Categorias de FORMATO de treino — não são grupamentos musculares. Um vídeo
 * "Full Body", "HIIT" ou "Cardio" é um TREINO inteiro, não um exercício único,
 * então não entra no catálogo de exercícios (nem cria aba lá).
 */
export const NON_EXERCISE_CATEGORIES = [
  "full", "hiit", "cardio", "funcional",
  "alongamento", "aquecimento", "viagem", "competicao",
] as const;

/** Um vídeo dessa categoria deve virar exercício do catálogo? (só grupamentos) */
export function isExerciseCategory(slug: string): boolean {
  return !(NON_EXERCISE_CATEGORIES as readonly string[]).includes(slug);
}

/**
 * Categorias usadas no CATÁLOGO DE EXERCÍCIOS (tabela `exercises`).
 *
 * Só grupamentos musculares (membros + tronco) — sem os formatos de treino
 * (Full Body, HIIT, Cardio…). Um exercício é sempre um movimento de um grupo
 * muscular; "Full Body" é formato de treino (workout_videos), não exercício.
 * Isso tira essas abas/opções do formulário e do filtro do catálogo, sem
 * afetar a Biblioteca de Vídeos (que continua aceitando todas as categorias).
 */
export const EXERCISE_CATEGORIES = WORKOUT_CATEGORIES.filter((c) =>
  isExerciseCategory(c.value),
);

/**
 * "Superiores" e "Inferiores" são GUARDA-CHUVAS (não substituem os grupamentos):
 *  - inferior = tudo abaixo do quadril (glúteo, quadríceps, posterior, panturrilha…)
 *  - superior = tudo acima do quadril (costas, ombro, bíceps, tríceps, peito, abdômen…)
 * Um exercício de glúteo aparece tanto na aba "Glúteo" quanto na aba "Inferiores".
 * Os slugs literais 'inferior'/'superior' também entram (vídeos genéricos do membro).
 */
export const LOWER_BODY_CATEGORIES = [
  "gluteo", "quadriceps", "posterior", "panturrilha", "inferior",
] as const;
export const UPPER_BODY_CATEGORIES = [
  "costas", "ombro", "biceps", "triceps", "peito", "abdomen", "superior",
] as const;

/**
 * Um exercício "pertence" a um grupamento se for sua categoria primária OU
 * estiver nos grupos secundários. Para 'superior'/'inferior', pertence se a
 * categoria (primária ou secundária) estiver no respectivo guarda-chuva.
 */
export function exerciseInGroup(
  ex: { primary_category: string; secondary_groups?: string[] | null },
  slug: string,
): boolean {
  if (slug === "all") return true;
  const cats = [ex.primary_category, ...(ex.secondary_groups ?? [])];
  if (slug === "inferior") {
    return cats.some((c) => (LOWER_BODY_CATEGORIES as readonly string[]).includes(c));
  }
  if (slug === "superior") {
    return cats.some((c) => (UPPER_BODY_CATEGORIES as readonly string[]).includes(c));
  }
  return cats.includes(slug);
}

/** Tupla pra usar em z.enum() — precisa ser `[string, ...string[]]` */
export const WORKOUT_CATEGORY_VALUES = WORKOUT_CATEGORIES.map((c) => c.value) as [
  WorkoutCategorySlug,
  ...WorkoutCategorySlug[],
];

/** Label PT-BR pra renderizar — fallback no slug se não bater. */
export function workoutCategoryLabel(slug: string): string {
  return WORKOUT_CATEGORIES.find((c) => c.value === slug)?.label ?? slug;
}
