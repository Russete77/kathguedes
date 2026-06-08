"use client";

import { useState } from "react";
import { updateConsultationPlan, saveCurrentAsTemplate } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Send, Zap, Library, Copy, Flame, X, Link2, Unlink, ArrowUp, ArrowDown, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { WorkoutPickerModal, type WorkoutLibraryItem } from "./workout-picker-modal";
import { ExercisePickerModal, type ExerciseCatalogItem } from "./exercise-picker-modal";
import {
  EXERCISE_TECHNIQUES,
  EXERCISE_GROUP_TYPES,
  exerciseTechniqueMeta,
  type ExerciseGroupTypeSlug,
} from "@/constants/techniques";

// Ordem dos dias da semana para nomear dias novos por padrão (PT-BR).
const WEEKDAYS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  youtube_id?: string;
  exercise_id?: string; // FK opcional pra catalogo (exercises.id)
  // ── Técnica + agrupamento (opcionais — vê src/constants/techniques.ts) ──
  technique?: string;
  technique_detail?: string;
  group_id?: string;
  group_type?: string;
  group_role?: string; // "A"|"B"|"C"|"D" — ordem dentro do bloco
}

/** Gera id curto pra agrupamento — não precisa ser uuid v4 cripto, só único no JSONB. */
function shortGroupId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface TrainingDay {
  name: string;
  exercises: Exercise[];
}

type WeekIntensity = "leve" | "moderado" | "intenso" | "pico";

interface PlanWeek {
  name: string;
  intensity?: WeekIntensity;
  is_peak_week?: boolean;
  notes?: string;
  days: TrainingDay[];
}

const INTENSITY_OPTIONS: { value: WeekIntensity; label: string }[] = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "intenso", label: "Intenso" },
  { value: "pico", label: "Pico" },
];

interface FoodItem {
  name: string;
  quantity: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface Meal {
  name: string;
  time: string;
  foods: FoodItem[];
}

interface Anamnesis {
  weight: number;
  height: number;
  birthDate: string;
  biologicalSex: string;
  trainingLevel: string;
  weeklyFrequency: string;
  primaryObjective: string;
}

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  data: unknown;
}

interface PlanEditorProps {
  consultationId: string;
  initialWorkoutPlan: unknown;
  initialDietPlan: unknown;
  initialCalories: number | null;
  initialProtein: number | null;
  initialCarbs: number | null;
  initialFat: number | null;
  initialNotes: string | null;
  status: string;
  anamnesis?: Anamnesis;
  dbTemplates?: {
    workout: DbTemplate[];
    diet: DbTemplate[];
  };
  workoutLibrary?: WorkoutLibraryItem[];
  exerciseCatalog?: ExerciseCatalogItem[];
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getActivityMultiplier(trainingLevel: string, weeklyFrequency: string): number {
  const freq = parseInt(weeklyFrequency) || 0;

  if (trainingLevel === "Sedentário" || freq === 0) return 1.2;
  if (trainingLevel === "Leve" || freq <= 2) return 1.375;
  if (trainingLevel === "Moderado" || freq === 3) return 1.55;
  if (trainingLevel === "Intenso" || freq >= 4) return 1.725;
  if (trainingLevel === "Muito intenso" || freq >= 6) return 1.9;

  return 1.55;
}

function calculateHarrisBenedict(
  weight: number,
  height: number,
  age: number,
  sex: string,
  objective: string,
  activityMultiplier: number
): { calories: number; protein: number; carbs: number; fat: number } {
  let bmr = 0;

  if (sex === "Feminino") {
    bmr = 655 + 9.6 * weight + 1.8 * height - 4.87 * age;
  } else {
    bmr = 88 + 13.4 * weight + 4.8 * height - 5.68 * age;
  }

  const tdee = Math.round(bmr * activityMultiplier);

  let calories = tdee;
  if (objective === "Ganho de massa" || objective === "Hipertrofia") {
    calories = Math.round(tdee * 1.1);
  } else if (objective === "Perda de peso" || objective === "Emagrecimento") {
    calories = Math.round(tdee * 0.85);
  }

  const proteinPerKg = 1.8;
  const protein = Math.round(weight * proteinPerKg);
  const fatGrams = Math.round((calories * 0.25) / 9);
  const carbGrams = Math.round((calories - protein * 4 - fatGrams * 9) / 4);

  return {
    calories: Math.round(calories),
    protein,
    carbs: Math.max(carbGrams, 0),
    fat: fatGrams,
  };
}

export function PlanEditor({
  consultationId,
  initialWorkoutPlan,
  initialDietPlan,
  initialCalories,
  initialProtein,
  initialCarbs,
  initialFat,
  initialNotes,
  status,
  anamnesis,
  dbTemplates,
  workoutLibrary = [],
  exerciseCatalog = [],
}: PlanEditorProps) {
  // Modal de biblioteca de videos aberto para qual dia (null = fechado)
  const [pickerOpenForDay, setPickerOpenForDay] = useState<number | null>(null);
  // Modal de catalogo de exercicios aberto para qual dia (null = fechado)
  const [catalogPickerOpenForDay, setCatalogPickerOpenForDay] = useState<number | null>(null);
  // Modal "vincular vídeo da biblioteca" a um exercício específico já existente.
  const [videoPickerFor, setVideoPickerFor] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const wp = initialWorkoutPlan as { weeks: Partial<PlanWeek>[] } | null;
  const dp = initialDietPlan as { meals: Meal[] } | null;

  // Periodização: state é `weeks`, mas funções legadas operam em `days` da semana ativa.
  // `setDays(newDays)` mutates weeks[activeWeekIdx].days transparentemente.
  const [weeks, setWeeks] = useState<PlanWeek[]>(
    wp?.weeks && wp.weeks.length > 0
      ? wp.weeks.map((w, i) => ({
          name: w.name || `Semana ${i + 1}`,
          intensity: w.intensity,
          is_peak_week: w.is_peak_week,
          notes: w.notes,
          days: w.days || [],
        }))
      : [{ name: "Semana 1", days: [{ name: "Segunda", exercises: [] }] }]
  );
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const days = weeks[activeWeekIdx]?.days ?? [];
  const currentWeek = weeks[activeWeekIdx];

  // Aceita array OU updater funcional. Usa setWeeks funcional (lê prevWeeks),
  // então edições em sequência (ex.: adicionar vários exercícios/vídeos sem
  // re-render entre cliques) não partem de um snapshot defasado de `days`.
  function setDays(
    next: TrainingDay[] | ((prev: TrainingDay[]) => TrainingDay[]),
  ) {
    setWeeks((prevWeeks) => {
      const prevDays = prevWeeks[activeWeekIdx]?.days ?? [];
      const newDays =
        typeof next === "function"
          ? (next as (p: TrainingDay[]) => TrainingDay[])(prevDays)
          : next;
      const updated = [...prevWeeks];
      updated[activeWeekIdx] = { ...updated[activeWeekIdx], days: newDays };
      return updated;
    });
  }

  function updateWeekField<K extends keyof PlanWeek>(field: K, value: PlanWeek[K]) {
    const updated = [...weeks];
    updated[activeWeekIdx] = { ...updated[activeWeekIdx], [field]: value };
    setWeeks(updated);
  }

  function addWeek() {
    const newIdx = weeks.length;
    setWeeks([
      ...weeks,
      { name: `Semana ${newIdx + 1}`, days: [{ name: "Segunda", exercises: [] }] },
    ]);
    setActiveWeekIdx(newIdx);
  }

  function duplicateWeek(weekIdx: number) {
    const source = weeks[weekIdx];
    const copy: PlanWeek = {
      name: `${source.name} (cópia)`,
      intensity: source.intensity,
      is_peak_week: false,
      notes: source.notes,
      days: source.days.map((d) => ({
        name: d.name,
        exercises: d.exercises.map((e) => ({ ...e })),
      })),
    };
    const updated = [...weeks];
    updated.splice(weekIdx + 1, 0, copy);
    setWeeks(updated);
    setActiveWeekIdx(weekIdx + 1);
  }

  function removeWeek(weekIdx: number) {
    if (weeks.length <= 1) return;
    const updated = weeks.filter((_, i) => i !== weekIdx);
    setWeeks(updated);
    setActiveWeekIdx(Math.min(activeWeekIdx, updated.length - 1));
  }
  const [meals, setMeals] = useState<Meal[]>(
    dp?.meals || [{ name: "Café da manhã", time: "07:00", foods: [] }]
  );
  const [macros, setMacros] = useState({
    calories: initialCalories || 0,
    protein: initialProtein || 0,
    carbs: initialCarbs || 0,
    fat: initialFat || 0,
  });
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

  // -- Training Day helpers --
  // Default do nome do dia segue a ordem da semana (Segunda…Domingo); a partir
  // do 8º dia cai no genérico. O nome continua editável no input.
  function addDay() {
    setDays((d) => {
      const name = WEEKDAYS[d.length] ?? `Dia ${d.length + 1}`;
      return [...d, { name, exercises: [] }];
    });
  }

  /** Duplica um dia (com todos os exercícios) logo abaixo dele. */
  function duplicateDay(dayIdx: number) {
    const source = days[dayIdx];
    const copy: TrainingDay = {
      name: `${source.name} (cópia)`,
      exercises: source.exercises.map((e) => ({ ...e })),
    };
    const updated = [...days];
    updated.splice(dayIdx + 1, 0, copy);
    setDays(updated);
    toast.success(`Dia "${source.name}" duplicado!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  /** Move um dia pra cima/baixo na ordem. */
  function moveDay(dayIdx: number, dir: "up" | "down") {
    const target = dir === "up" ? dayIdx - 1 : dayIdx + 1;
    if (target < 0 || target >= days.length) return;
    const updated = [...days];
    [updated[dayIdx], updated[target]] = [updated[target], updated[dayIdx]];
    setDays(updated);
  }

  /** Copia todos os dias da semana ANTERIOR para a semana ativa (substitui). */
  function copyDaysFromPreviousWeek() {
    if (activeWeekIdx === 0) {
      toast.error("Não há semana anterior.");
      return;
    }
    const prev = weeks[activeWeekIdx - 1];
    const clonedDays: TrainingDay[] = prev.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({ ...e })),
    }));
    setDays(clonedDays);
    toast.success(`Dias copiados de "${prev.name}"!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  function addExercise(dayIdx: number) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                { name: "", sets: 3, reps: "12", rest: "60s", youtube_id: "" },
              ],
            }
          : day,
      ),
    );
  }

  function addExerciseFromLibrary(dayIdx: number, workout: WorkoutLibraryItem) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  name: workout.title,
                  sets: 3,
                  reps: "12",
                  rest: "60s",
                  youtube_id: workout.youtube_id,
                },
              ],
            }
          : day,
      ),
    );
    // Não fecha o picker: permite adicionar vários vídeos em sequência
    // (igual ao catálogo). O usuário fecha quando terminar.
    toast.success(`"${workout.title}" adicionado!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  function addExerciseFromCatalog(dayIdx: number, exercise: ExerciseCatalogItem) {
    const ex: Exercise = {
      name: exercise.name,
      sets: exercise.default_sets,
      reps: exercise.default_reps,
      rest: `${exercise.default_rest}s`,
      youtube_id: exercise.workout_video_youtube_id ?? "",
      exercise_id: exercise.id,
    };
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx ? { ...day, exercises: [...day.exercises, ex] } : day,
      ),
    );
    // Não fecha o picker: permite adicionar vários exercícios em sequência.
    toast.success(`"${exercise.name}" adicionado!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  /** Vincula um vídeo da biblioteca a um exercício JÁ existente (sem criar outro). */
  function setExerciseVideoFromLibrary(
    dayIdx: number,
    exIdx: number,
    workout: WorkoutLibraryItem,
  ) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? {
              ...day,
              exercises: day.exercises.map((ex, j) =>
                j === exIdx
                  ? {
                      ...ex,
                      youtube_id: workout.youtube_id,
                      name: ex.name?.trim() ? ex.name : workout.title,
                    }
                  : ex,
              ),
            }
          : day,
      ),
    );
    setVideoPickerFor(null);
    toast.success(`Vídeo "${workout.title}" vinculado!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  function updateExercise(dayIdx: number, exIdx: number, field: string, value: string | number) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? {
              ...day,
              exercises: day.exercises.map((ex, j) =>
                j === exIdx
                  ? ({ ...ex, [field]: value } as unknown as Exercise)
                  : ex,
              ),
            }
          : day,
      ),
    );
  }

  function removeExercise(dayIdx: number, exIdx: number) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIdx) }
          : day,
      ),
    );
  }

  // ── Técnica ──
  function updateTechnique(dayIdx: number, exIdx: number, slug: string) {
    setDays((d) =>
      d.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          exercises: day.exercises.map((ex, j) => {
            if (j !== exIdx) return ex;
            if (slug === "straight" || !slug) {
              const { technique, technique_detail, ...rest } = ex;
              void technique;
              void technique_detail;
              return rest as Exercise;
            }
            return { ...ex, technique: slug };
          }),
        };
      }),
    );
  }

  function updateTechniqueDetail(dayIdx: number, exIdx: number, text: string) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? {
              ...day,
              exercises: day.exercises.map((ex, j) =>
                j === exIdx ? { ...ex, technique_detail: text || undefined } : ex,
              ),
            }
          : day,
      ),
    );
  }

  // ── Agrupamento (bi-set / tri-set / superset / circuito) ──
  function startGroup(dayIdx: number, exIdx: number, groupType: ExerciseGroupTypeSlug) {
    const meta = EXERCISE_GROUP_TYPES.find((g) => g.value === groupType);
    if (!meta) return;
    const list = days[dayIdx].exercises;
    const targetSize = meta.size === 0 ? Math.max(2, list.length - exIdx) : meta.size;
    if (exIdx + targetSize > list.length) {
      toast.error(
        `Precisa de pelo menos ${targetSize} exercícios a partir daqui. Adicione mais e tente de novo.`,
      );
      return;
    }
    for (let i = exIdx; i < exIdx + targetSize; i++) {
      if (list[i].group_id) {
        toast.error(`"${list[i].name || "Exercício"}" já está em outro grupo. Desagrupe primeiro.`);
        return;
      }
    }
    const groupId = shortGroupId();
    setDays((d) =>
      d.map((day, di) => {
        if (di !== dayIdx) return day;
        return {
          ...day,
          exercises: day.exercises.map((ex, j) =>
            j >= exIdx && j < exIdx + targetSize
              ? {
                  ...ex,
                  group_id: groupId,
                  group_type: groupType,
                  group_role: String.fromCharCode(65 + (j - exIdx)),
                }
              : ex,
          ),
        };
      }),
    );
    toast.success(`${meta.label} criado!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  function clearGroup(dayIdx: number, exIdx: number) {
    const gid = days[dayIdx]?.exercises[exIdx]?.group_id;
    if (!gid) return;
    setDays((d) =>
      d.map((day, di) =>
        di === dayIdx
          ? {
              ...day,
              exercises: day.exercises.map((e) => {
                if (e.group_id !== gid) return e;
                const { group_id, group_type, group_role, ...rest } = e;
                void group_id;
                void group_type;
                void group_role;
                return rest as Exercise;
              }),
            }
          : day,
      ),
    );
  }

  function removeDay(dayIdx: number) {
    setDays((d) => d.filter((_, i) => i !== dayIdx));
  }

  // Templates carregados via DB (prop dbTemplates).
  // Os 5 workout + 2 diet padrões estão na tabela `plan_templates` (seed via
  // /admin/templates "Seed Templates"). Removido objeto hardcoded duplicado.
  function applyWorkoutTemplate(templateId: string) {
    const dbTemplate = dbTemplates?.workout.find((t) => t.id === templateId);
    if (!dbTemplate) return;
    const data = dbTemplate.data as { weeks?: Partial<PlanWeek>[] };
    if (!data?.weeks || data.weeks.length === 0) return;
    // Carrega TODAS as semanas do template (periodização preservada).
    const loaded: PlanWeek[] = data.weeks.map((w, i) => ({
      name: w.name || `Semana ${i + 1}`,
      intensity: w.intensity,
      is_peak_week: w.is_peak_week,
      notes: w.notes,
      days: w.days || [],
    }));
    setWeeks(loaded);
    setActiveWeekIdx(0);
    toast.success(
      `Template "${dbTemplate.name}" carregado (${loaded.length} semana${loaded.length > 1 ? "s" : ""})!`,
      { style: { borderLeft: "3px solid #00FF88" } },
    );
  }

  function applyDietTemplate(templateId: string) {
    const dbTemplate = dbTemplates?.diet.find((t) => t.id === templateId);
    if (!dbTemplate) return;
    const data = dbTemplate.data as { meals: Meal[] };
    if (data?.meals) {
      setMeals(data.meals);
      toast.success(`Template "${dbTemplate.name}" carregado!`, {
        style: { borderLeft: "3px solid #00FF88" },
      });
    }
  }

  function applyMacroCalculation() {
    if (!anamnesis) {
      toast.error("Anamnese não encontrada");
      return;
    }

    const age = calculateAge(anamnesis.birthDate);
    const activityMultiplier = getActivityMultiplier(
      anamnesis.trainingLevel,
      anamnesis.weeklyFrequency
    );

    const calculated = calculateHarrisBenedict(
      anamnesis.weight,
      anamnesis.height,
      age,
      anamnesis.biologicalSex,
      anamnesis.primaryObjective,
      activityMultiplier
    );

    setMacros(calculated);
    toast.success("Macros calculadas e aplicadas!", {
      style: { borderLeft: "3px solid #00FF88" },
    });
  }

  // ── Meal helpers ──
  function addMeal() {
    setMeals([...meals, { name: `Refeição ${meals.length + 1}`, time: "12:00", foods: [] }]);
  }

  function addFood(mealIdx: number) {
    const updated = [...meals];
    updated[mealIdx].foods.push({ name: "", quantity: "" });
    setMeals(updated);
  }

  /** Duplica uma refeição (com os alimentos) logo abaixo dela. */
  function duplicateMeal(mealIdx: number) {
    const source = meals[mealIdx];
    const copy: Meal = {
      name: `${source.name} (cópia)`,
      time: source.time,
      foods: source.foods.map((f) => ({ ...f })),
    };
    const updated = [...meals];
    updated.splice(mealIdx + 1, 0, copy);
    setMeals(updated);
  }

  function removeMeal(mealIdx: number) {
    setMeals(meals.filter((_, i) => i !== mealIdx));
  }

  function updateFood(mealIdx: number, foodIdx: number, field: string, value: string | number) {
    const updated = [...meals];
    (updated[mealIdx].foods[foodIdx] as unknown as Record<string, unknown>)[field] = value;
    setMeals(updated);
  }

  function removeFood(mealIdx: number, foodIdx: number) {
    const updated = [...meals];
    updated[mealIdx].foods.splice(foodIdx, 1);
    setMeals(updated);
  }

  // ── Salvar plano atual como template reutilizável ──
  const [savingTemplate, setSavingTemplate] = useState(false);
  async function handleSaveAsTemplate(type: "workout" | "diet") {
    const label = type === "workout" ? "treino" : "dieta";
    const name = window.prompt(`Nome do template de ${label}:`);
    if (!name || !name.trim()) return;
    setSavingTemplate(true);
    try {
      await saveCurrentAsTemplate(
        name.trim(),
        type,
        type === "workout" ? { weeks } : { meals },
      );
      toast.success(`Template de ${label} "${name.trim()}" salvo!`, {
        style: { borderLeft: "3px solid #00FF88" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── Save ──
  async function handleSave(deliver = false) {
    setSaving(true);
    try {
      await updateConsultationPlan(consultationId, {
        workout_plan: { weeks },
        diet_plan: { meals },
        daily_calories: macros.calories,
        daily_protein: macros.protein,
        daily_carbs: macros.carbs,
        daily_fat: macros.fat,
        notes_admin: notes,
        ...(deliver && { status: "delivered" }),
      });
      toast.success(deliver ? "Consultoria entregue!" : "Rascunho salvo!", {
        style: { borderLeft: "3px solid #00FF88" },
      });
    } catch (err) {
      toast.error("Erro ao salvar");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Status */}
      <div className="flex items-center gap-3">
        <Badge variant={status === "delivered" ? "green" : status === "in_progress" ? "pink" : "yellow"}>
          {status === "delivered" ? "Entregue" : status === "in_progress" ? "Em andamento" : "Pendente"}
        </Badge>
      </div>

      {/* ── TREINO ── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl text-white">PLANO DE TREINO</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  applyWorkoutTemplate(e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
            >
              <option value="">Carregar Template...</option>
              {dbTemplates && dbTemplates.workout.length > 0 ? (
                dbTemplates.workout.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>Nenhum template — seed via /admin/templates</option>
              )}
            </select>
            <Button size="sm" variant="ghost" onClick={addDay}>
              <Plus size={14} /> Dia
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSaveAsTemplate("workout")}
              disabled={savingTemplate}
              title="Salvar este plano de treino como template reutilizável"
            >
              <BookMarked size={14} /> Salvar template
            </Button>
          </div>
        </div>

        {/* Tabs de semanas (periodização) */}
        <div className="flex items-center gap-2 border-b border-gray-4 overflow-x-auto pb-px">
          {weeks.map((w, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveWeekIdx(idx)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                activeWeekIdx === idx
                  ? "border-pink text-pink"
                  : "border-transparent text-gray-2 hover:text-white"
              }`}
            >
              {w.is_peak_week && <Flame size={12} />}
              {w.name}
            </button>
          ))}
          <button
            type="button"
            onClick={addWeek}
            className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-3 hover:text-pink border border-gray-4 hover:border-pink/40 rounded-md"
            title="Adicionar semana"
          >
            <Plus size={12} /> Semana
          </button>
        </div>

        {/* Metadados da semana ativa */}
        {currentWeek && (
          <div className="bg-bg-1 border border-gray-4 rounded-[12px] p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 min-w-0">
              <div className="min-w-0">
                <label className="text-[11px] text-gray-3 mb-1 block font-mono tracking-[0.08em] uppercase">Nome da semana</label>
                <input
                  value={currentWeek.name}
                  onChange={(e) => updateWeekField("name", e.target.value)}
                  placeholder="Semana 1 — Adaptação"
                  className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
                />
              </div>
              <div className="min-w-0">
                <label className="text-[11px] text-gray-3 mb-1 block font-mono tracking-[0.08em] uppercase">Intensidade</label>
                <select
                  value={currentWeek.intensity ?? ""}
                  onChange={(e) =>
                    updateWeekField("intensity", (e.target.value || undefined) as WeekIntensity | undefined)
                  }
                  className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
                >
                  <option value="">—</option>
                  {INTENSITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 text-[13px] text-gray-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentWeek.is_peak_week}
                  onChange={(e) => updateWeekField("is_peak_week", e.target.checked)}
                  className="accent-pink"
                />
                <Flame size={14} className="text-pink" /> Peak Week
              </label>
              <div className="flex gap-2 flex-wrap">
                {activeWeekIdx > 0 && (
                  <button
                    type="button"
                    onClick={copyDaysFromPreviousWeek}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-2 hover:text-white border border-gray-4 hover:border-pink/40 rounded-md"
                    title="Copiar os dias da semana anterior pra esta"
                  >
                    <Copy size={12} /> Copiar semana anterior
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => duplicateWeek(activeWeekIdx)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-2 hover:text-white border border-gray-4 hover:border-pink/40 rounded-md"
                >
                  <Copy size={12} /> Duplicar
                </button>
                {weeks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWeek(activeWeekIdx)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-3 hover:text-danger border border-gray-4 hover:border-danger/40 rounded-md"
                  >
                    <X size={12} /> Remover
                  </button>
                )}
              </div>
            </div>
            <input
              value={currentWeek.notes ?? ""}
              onChange={(e) => updateWeekField("notes", e.target.value)}
              placeholder="Notas da semana (opcional)"
              className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink placeholder:text-gray-3"
            />
          </div>
        )}

        {days.map((day, dayIdx) => (
          <div key={dayIdx} className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={day.name ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setDays((d) =>
                    d.map((dd, i) => (i === dayIdx ? { ...dd, name: value } : dd)),
                  );
                }}
                className="w-full sm:w-auto sm:flex-1 min-w-0 bg-transparent text-white font-bold text-[15px] outline-none border-b border-transparent focus:border-pink"
              />
              <div className="flex gap-2 flex-wrap items-center">
                {exerciseCatalog.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setCatalogPickerOpenForDay(dayIdx)}
                    title="Adicionar exercício (com vídeo) — dá pra adicionar vários seguidos"
                  >
                    <Plus size={12} /> Exercício
                  </Button>
                )}
                {workoutLibrary.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPickerOpenForDay(dayIdx)}
                    title="Adicionar treino da biblioteca de vídeos"
                  >
                    <Library size={12} /> Vídeos
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => addExercise(dayIdx)} title="Exercício em branco (digitar à mão)">
                  <Plus size={12} /> Em branco
                </Button>
                {/* Reordenar / duplicar / remover dia */}
                <span className="inline-flex items-center gap-1 ml-1 pl-2 border-l border-gray-4">
                  <button
                    onClick={() => moveDay(dayIdx, "up")}
                    disabled={dayIdx === 0}
                    className="text-gray-3 hover:text-pink disabled:opacity-30 disabled:hover:text-gray-3 p-1"
                    title="Mover dia pra cima"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => moveDay(dayIdx, "down")}
                    disabled={dayIdx === days.length - 1}
                    className="text-gray-3 hover:text-pink disabled:opacity-30 disabled:hover:text-gray-3 p-1"
                    title="Mover dia pra baixo"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => duplicateDay(dayIdx)}
                    className="text-gray-3 hover:text-pink p-1"
                    title="Duplicar dia"
                  >
                    <Copy size={14} />
                  </button>
                  {days.length > 1 && (
                    <button onClick={() => removeDay(dayIdx)} className="text-gray-3 hover:text-danger p-1" title="Remover dia">
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              </div>
            </div>

            {day.exercises.map((ex, exIdx) => {
              const techMeta = exerciseTechniqueMeta(ex.technique);
              const inGroup = !!ex.group_id;
              const groupTypeMeta = inGroup
                ? EXERCISE_GROUP_TYPES.find((g) => g.value === ex.group_type)
                : null;
              return (
                <div
                  key={exIdx}
                  className={`space-y-1.5 pb-2 border-b border-gray-4/30 last:border-0 ${
                    inGroup ? "pl-3 border-l-4 border-l-pink/60 -ml-1" : ""
                  }`}
                >
                  {inGroup && (
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.1em] uppercase">
                      <span className="text-pink">
                        {groupTypeMeta?.label ?? ex.group_type} · {ex.group_role}
                      </span>
                      <button
                        type="button"
                        onClick={() => clearGroup(dayIdx, exIdx)}
                        className="inline-flex items-center gap-1 text-gray-3 hover:text-danger"
                        title="Desagrupar bloco"
                      >
                        <Unlink size={10} /> desagrupar
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_44px_64px_52px_auto] gap-2 items-end">
                    <input
                      value={ex.name ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, "name", e.target.value)}
                      placeholder="Exercício"
                      className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
                    />
                    <input
                      type="number"
                      value={ex.sets ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, "sets", Number(e.target.value))}
                      placeholder="Sets"
                      className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-2 py-2 outline-none focus:border-pink text-center"
                    />
                    <input
                      value={ex.reps ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
                      placeholder="Reps"
                      className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-2 py-2 outline-none focus:border-pink text-center"
                    />
                    <input
                      value={ex.rest ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, "rest", e.target.value)}
                      placeholder="Rest"
                      className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-2 py-2 outline-none focus:border-pink text-center"
                    />
                    <button onClick={() => removeExercise(dayIdx, exIdx)} className="text-gray-3 hover:text-danger p-2">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={ex.youtube_id ?? ""}
                      onChange={(e) => {
                        let val = e.target.value;
                        const shortsMatch = val.match(/youtube\.com\/shorts\/([\w-]{11})/);
                        if (shortsMatch) {
                          val = `short:${shortsMatch[1]}`;
                        } else {
                          const ytMatch = val.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
                          if (ytMatch) val = ytMatch[1];
                        }
                        updateExercise(dayIdx, exIdx, "youtube_id", val);
                      }}
                      placeholder="YouTube URL ou ID (shorts detectados automaticamente)"
                      className="flex-1 bg-bg-2 border border-gray-4 rounded-[8px] text-gray-2 text-[11px] px-3 py-1.5 outline-none focus:border-pink placeholder:text-gray-3/60"
                    />
                    {workoutLibrary.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setVideoPickerFor({ dayIdx, exIdx })}
                        className="inline-flex items-center gap-1 shrink-0 text-[10px] text-gray-3 hover:text-pink border border-gray-4 hover:border-pink/40 rounded-md px-2 py-1.5"
                        title="Escolher vídeo da biblioteca para este exercício"
                      >
                        <Library size={11} /> Biblioteca
                      </button>
                    )}
                  </div>

                  {/* Técnica + Agrupamento — linha compacta */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={ex.technique ?? "straight"}
                      onChange={(e) => updateTechnique(dayIdx, exIdx, e.target.value)}
                      className={`bg-bg-2 border border-gray-4 rounded-[6px] text-[11px] px-2 py-1 outline-none focus:border-pink ${
                        techMeta ? techMeta.color : "text-gray-2"
                      }`}
                      title="Técnica de execução"
                    >
                      {EXERCISE_TECHNIQUES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {techMeta && (
                      <input
                        value={ex.technique_detail ?? ""}
                        onChange={(e) => updateTechniqueDetail(dayIdx, exIdx, e.target.value)}
                        placeholder={
                          ex.technique === "dropset"
                            ? "Ex: 3 quedas — 100→70→50kg"
                            : ex.technique === "pyramid"
                            ? "Ex: crescente 10/8/6/4"
                            : "Detalhe (opcional)"
                        }
                        className="flex-1 min-w-[120px] bg-bg-2 border border-gray-4 rounded-[6px] text-gray-1 text-[11px] px-2 py-1 outline-none focus:border-pink placeholder:text-gray-3/60"
                      />
                    )}
                    {!inGroup && (
                      <>
                        <button
                          type="button"
                          onClick={() => startGroup(dayIdx, exIdx, "bi_set")}
                          className="inline-flex items-center gap-1 text-[10px] text-gray-3 hover:text-pink border border-gray-4 hover:border-pink/40 rounded-md px-1.5 py-0.5"
                          title="Agrupar com o próximo (bi-set)"
                        >
                          <Link2 size={10} /> Bi-set
                        </button>
                        <button
                          type="button"
                          onClick={() => startGroup(dayIdx, exIdx, "tri_set")}
                          className="inline-flex items-center gap-1 text-[10px] text-gray-3 hover:text-pink border border-gray-4 hover:border-pink/40 rounded-md px-1.5 py-0.5"
                          title="Agrupar com os 2 próximos (tri-set)"
                        >
                          <Link2 size={10} /> Tri-set
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {/* ── DIETA ── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl text-white">PLANO ALIMENTAR</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  applyDietTemplate(e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
            >
              <option value="">Carregar Template...</option>
              {dbTemplates && dbTemplates.diet.length > 0 ? (
                dbTemplates.diet.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>Nenhum template — seed via /admin/templates</option>
              )}
            </select>
            {anamnesis && (
              <Button
                size="sm"
                className="bg-pink hover:bg-pink-dim text-black"
                onClick={applyMacroCalculation}
              >
                <Zap size={14} />
                Calcular Macros
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={addMeal}>
              <Plus size={14} /> Refeição
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSaveAsTemplate("diet")}
              disabled={savingTemplate}
              title="Salvar este plano alimentar como template reutilizável"
            >
              <BookMarked size={14} /> Salvar template
            </Button>
          </div>
        </div>

        {/* Macros totais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input
            label="Calorias"
            type="number"
            value={macros.calories || ""}
            onChange={(e) => setMacros({ ...macros, calories: Number(e.target.value) })}
            placeholder="2000"
          />
          <Input
            label="Proteína (g)"
            type="number"
            value={macros.protein || ""}
            onChange={(e) => setMacros({ ...macros, protein: Number(e.target.value) })}
            placeholder="130"
          />
          <Input
            label="Carb (g)"
            type="number"
            value={macros.carbs || ""}
            onChange={(e) => setMacros({ ...macros, carbs: Number(e.target.value) })}
            placeholder="250"
          />
          <Input
            label="Gordura (g)"
            type="number"
            value={macros.fat || ""}
            onChange={(e) => setMacros({ ...macros, fat: Number(e.target.value) })}
            placeholder="55"
          />
        </div>

        {meals.map((meal, mealIdx) => (
          <div key={mealIdx} className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                value={meal.name ?? ""}
                onChange={(e) => {
                  const u = [...meals];
                  u[mealIdx].name = e.target.value;
                  setMeals(u);
                }}
                className="bg-transparent text-white font-bold text-[15px] outline-none border-b border-transparent focus:border-pink flex-1"
              />
              <input
                type="time"
                value={meal.time ?? ""}
                onChange={(e) => {
                  const u = [...meals];
                  u[mealIdx].time = e.target.value;
                  setMeals(u);
                }}
                className="bg-bg-2 border border-gray-4 rounded-[8px] text-gray-2 text-[13px] px-2 py-1 outline-none"
              />
              <Button size="sm" variant="ghost" onClick={() => addFood(mealIdx)}>
                <Plus size={12} /> Alimento
              </Button>
              <button
                onClick={() => duplicateMeal(mealIdx)}
                className="text-gray-3 hover:text-pink p-1.5"
                title="Duplicar refeição"
              >
                <Copy size={14} />
              </button>
              {meals.length > 1 && (
                <button
                  onClick={() => removeMeal(mealIdx)}
                  className="text-gray-3 hover:text-danger p-1.5"
                  title="Remover refeição"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {meal.foods.map((food, foodIdx) => (
              <div key={foodIdx} className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
                <input
                  value={food.name ?? ""}
                  onChange={(e) => updateFood(mealIdx, foodIdx, "name", e.target.value)}
                  placeholder="Alimento"
                  className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
                />
                <input
                  value={food.quantity ?? ""}
                  onChange={(e) => updateFood(mealIdx, foodIdx, "quantity", e.target.value)}
                  placeholder="150g"
                  className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-2 py-2 outline-none focus:border-pink text-center"
                />
                <button onClick={() => removeFood(mealIdx, foodIdx)} className="text-gray-3 hover:text-danger p-2">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Notas */}
      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
          Notas internas
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações sobre a assinante, restrições, etc..."
          rows={3}
          className="bg-bg-1 border border-gray-4 rounded-[8px] text-white font-body text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" size="lg" onClick={() => handleSave(false)} disabled={saving}>
          <Save size={16} />
          {saving ? "Salvando..." : "Salvar Rascunho"}
        </Button>
        <Button size="lg" onClick={() => handleSave(true)} disabled={saving}>
          <Send size={16} />
          {saving ? "Enviando..." : "Entregar Consultoria"}
        </Button>
      </div>

      {/* Modal de seleção de treino da biblioteca (videos) */}
      <WorkoutPickerModal
        open={pickerOpenForDay !== null}
        dayName={pickerOpenForDay !== null ? days[pickerOpenForDay]?.name ?? "" : ""}
        library={workoutLibrary}
        onClose={() => setPickerOpenForDay(null)}
        onPick={(workout) => {
          if (pickerOpenForDay !== null) {
            addExerciseFromLibrary(pickerOpenForDay, workout);
          }
        }}
      />

      {/* Modal de seleção de exercício do catálogo */}
      <ExercisePickerModal
        open={catalogPickerOpenForDay !== null}
        dayName={catalogPickerOpenForDay !== null ? days[catalogPickerOpenForDay]?.name ?? "" : ""}
        catalog={exerciseCatalog}
        onClose={() => setCatalogPickerOpenForDay(null)}
        onPick={(exercise) => {
          if (catalogPickerOpenForDay !== null) {
            addExerciseFromCatalog(catalogPickerOpenForDay, exercise);
          }
        }}
      />

      {/* Modal "vincular vídeo da biblioteca" a um exercício específico já existente */}
      <WorkoutPickerModal
        open={videoPickerFor !== null}
        dayName={
          videoPickerFor !== null
            ? days[videoPickerFor.dayIdx]?.exercises[videoPickerFor.exIdx]?.name || "exercício"
            : ""
        }
        library={workoutLibrary}
        onClose={() => setVideoPickerFor(null)}
        onPick={(workout) => {
          if (videoPickerFor !== null) {
            setExerciseVideoFromLibrary(videoPickerFor.dayIdx, videoPickerFor.exIdx, workout);
          }
        }}
      />
    </div>
  );
}
