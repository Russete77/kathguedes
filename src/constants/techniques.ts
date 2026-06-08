/**
 * Catálogo único de técnicas de execução de exercício.
 *
 * Cada item de plano (consultation.workout_plan.weeks[].days[].exercises[],
 * plan_templates.data.weeks[].days[].exercises[]) pode opcionalmente declarar
 * `technique` — qualquer slug abaixo. Default lógico (sem campo) = "straight"
 * (séries normais).
 *
 * Fonte de verdade compartilhada entre:
 * - Zod schema (`src/lib/validations.ts` — exerciseTechniqueSchema)
 * - Plan editor da consultoria (`src/app/admin/consultorias/[id]/plan-editor.tsx`)
 * - Template editor (`src/app/admin/templates/template-editor.tsx`)
 * - Renderer do aluno (`src/app/(app)/consultoria/exercise-card.tsx`)
 *
 * NÃO MORA NO DB: técnica vive dentro do JSONB de plano. Adicionar nova
 * técnica = incluir aqui; os 4 pontos de uso pegam automático via .map().
 *
 * Lista enxuta (8 itens) — cobre 95% do que personal trainer real usa sem
 * virar inferno de opção pro admin.
 */

export const EXERCISE_TECHNIQUES = [
  {
    value: "straight",
    label: "Séries normais",
    short: "Normal",
    description: "Séries diretas. O padrão.",
    color: "text-gray-2",
    bgClass: "bg-gray-4/30 text-gray-1 border-gray-4",
  },
  {
    value: "bi_set",
    label: "Bi-set",
    short: "Bi-set",
    description: "2 exercícios em sequência sem descanso entre eles.",
    color: "text-pink",
    bgClass: "bg-pink/15 text-pink border-pink/30",
  },
  {
    value: "tri_set",
    label: "Tri-set",
    short: "Tri-set",
    description: "3 exercícios em sequência sem descanso entre eles.",
    color: "text-pink",
    bgClass: "bg-pink/15 text-pink border-pink/30",
  },
  {
    value: "dropset",
    label: "Drop-set",
    short: "Drop",
    description: "Ao falhar, reduz o peso e continua na mesma série.",
    color: "text-orange-400",
    bgClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  {
    value: "rest_pause",
    label: "Rest-pause",
    short: "Rest-pause",
    description: "Ao falhar, pausa curta de 10-15s e continua a mesma série.",
    color: "text-orange-400",
    bgClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  {
    value: "pyramid",
    label: "Pirâmide",
    short: "Pirâmide",
    description: "Carga aumenta (ou diminui) a cada série.",
    color: "text-yellow-400",
    bgClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  {
    value: "iso_hold",
    label: "Isometria",
    short: "Iso",
    description: "Mantém contração estática por tempo determinado.",
    color: "text-blue-400",
    bgClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  {
    value: "fst7",
    label: "FST-7",
    short: "FST-7",
    description: "7 séries de 10-12 com descanso curto (30-45s) — pump.",
    color: "text-purple-400",
    bgClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
] as const;

export type ExerciseTechniqueSlug = typeof EXERCISE_TECHNIQUES[number]["value"];

/** Tupla pra usar em z.enum() — precisa ser `[string, ...string[]]` */
export const EXERCISE_TECHNIQUE_VALUES = EXERCISE_TECHNIQUES.map((t) => t.value) as [
  ExerciseTechniqueSlug,
  ...ExerciseTechniqueSlug[],
];

/** Label PT-BR pra renderizar — fallback no slug se não bater. */
export function exerciseTechniqueLabel(slug: string | null | undefined): string {
  if (!slug) return "Normal";
  return EXERCISE_TECHNIQUES.find((t) => t.value === slug)?.short ?? slug;
}

/** Meta completa pra renderizar badge (label + cor). Null = straight (não mostra badge). */
export function exerciseTechniqueMeta(slug: string | null | undefined) {
  if (!slug || slug === "straight") return null;
  return EXERCISE_TECHNIQUES.find((t) => t.value === slug) ?? null;
}

// ──────────────────────────────────────────────────────────────────────
// Agrupamento (bi-set / tri-set / superset / circuito)
//
// Quando o admin marca 2+ exercícios como bi-set/tri-set, todos os itens
// recebem o MESMO `group_id` (uuid curto gerado no client) + `group_type`
// + `group_role` ("A", "B", "C"...) pra preservar a ordem.
//
// Render no app do aluno: itens com mesmo group_id ficam visualmente
// conectados por borda lateral colorida; o timer de descanso só dispara
// após o ÚLTIMO item do bloco.
// ──────────────────────────────────────────────────────────────────────

export const EXERCISE_GROUP_TYPES = [
  { value: "bi_set",   label: "Bi-set",   size: 2 },
  { value: "tri_set",  label: "Tri-set",  size: 3 },
  { value: "giant_set",label: "Giant-set",size: 4 },
  { value: "superset", label: "Superset", size: 2 },
  { value: "circuito", label: "Circuito", size: 0 }, // tamanho variável
] as const;

export type ExerciseGroupTypeSlug = typeof EXERCISE_GROUP_TYPES[number]["value"];

export const EXERCISE_GROUP_TYPE_VALUES = EXERCISE_GROUP_TYPES.map((g) => g.value) as [
  ExerciseGroupTypeSlug,
  ...ExerciseGroupTypeSlug[],
];

export function exerciseGroupLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return EXERCISE_GROUP_TYPES.find((g) => g.value === slug)?.label ?? slug;
}
