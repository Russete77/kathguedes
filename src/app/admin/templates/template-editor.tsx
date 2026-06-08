"use client";

import { useState, ReactNode } from "react";
import { createTemplate, updateTemplate } from "../actions";
import { ExercisePicker } from "./exercise-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  X,
  Dumbbell,
  Apple,
  Copy,
  Flame,
  Link2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import {
  EXERCISE_TECHNIQUES,
  EXERCISE_GROUP_TYPES,
  exerciseTechniqueMeta,
  type ExerciseGroupTypeSlug,
} from "@/constants/techniques";

/** Gera id curto pra agrupamento — não precisa ser uuid v4 cripto, só único no JSONB. */
function shortGroupId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface PlanTemplate {
  id: string;
  name: string;
  description: string | null;
  type: "workout" | "diet";
  data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkoutDay {
  dayName: string;
  exercises: WorkoutExercise[];
}

interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  notes: string;
  /** ID do exercise vinculado do catálogo (opcional, mas recomendado). */
  exercise_id?: string;
  /** youtube_id snapshot do vídeo (renderiza no app do aluno sem JOIN extra). */
  youtube_id?: string;
  // ── Técnica + agrupamento (opcionais — vê src/constants/techniques.ts) ──
  technique?: string;
  technique_detail?: string;
  group_id?: string;
  group_type?: string;
  group_role?: string;
}

type WeekIntensity = "leve" | "moderado" | "intenso" | "pico";

interface WorkoutWeek {
  name: string;
  intensity?: WeekIntensity;
  is_peak_week?: boolean;
  notes?: string;
  days: WorkoutDay[];
}

interface DietMeal {
  mealName: string;
  time: string;
  foods: DietFood[];
}

interface DietFood {
  name: string;
  quantity: string;
}

interface TemplateEditorProps {
  template?: PlanTemplate;
  children?: ReactNode;
}

const INTENSITY_OPTIONS: { value: WeekIntensity; label: string; color: string }[] = [
  { value: "leve", label: "Leve", color: "text-green-400" },
  { value: "moderado", label: "Moderado", color: "text-yellow-400" },
  { value: "intenso", label: "Intenso", color: "text-orange-400" },
  { value: "pico", label: "Pico", color: "text-pink" },
];

export function TemplateEditor({ template, children }: TemplateEditorProps) {
  const [open, setOpen] = useState(false);
  const [templateType, setTemplateType] = useState<"workout" | "diet">(
    template?.type || "workout"
  );
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [loading, setLoading] = useState(false);

  const [workoutWeeks, setWorkoutWeeks] = useState<WorkoutWeek[]>(
    getInitialWorkoutWeeks(template)
  );
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [dietMeals, setDietMeals] = useState<DietMeal[]>(
    getInitialDietMeals(template)
  );

  function getInitialWorkoutWeeks(t?: PlanTemplate): WorkoutWeek[] {
    if (!t || t.type !== "workout") {
      return [{ name: "Semana 1", days: [{ dayName: "Segunda", exercises: [] }] }];
    }
    const data = t.data as { weeks?: Array<Partial<WorkoutWeek>> };
    if (!data.weeks || data.weeks.length === 0) {
      return [{ name: "Semana 1", days: [{ dayName: "Segunda", exercises: [] }] }];
    }
    return data.weeks.map((w, i) => ({
      name: w.name || `Semana ${i + 1}`,
      intensity: w.intensity,
      is_peak_week: w.is_peak_week,
      notes: w.notes,
      days: w.days || [],
    }));
  }

  function getInitialDietMeals(t?: PlanTemplate): DietMeal[] {
    if (!t || t.type !== "diet") {
      return [{ mealName: "Café da Manhã", time: "07:00", foods: [] }];
    }
    const data = t.data as { meals?: DietMeal[] };
    return data.meals || [{ mealName: "Café da Manhã", time: "07:00", foods: [] }];
  }

  // ── Week helpers ──
  const handleAddWeek = () => {
    const newIdx = workoutWeeks.length;
    setWorkoutWeeks([
      ...workoutWeeks,
      {
        name: `Semana ${newIdx + 1}`,
        days: [{ dayName: "Segunda", exercises: [] }],
      },
    ]);
    setActiveWeekIdx(newIdx);
  };

  const handleDuplicateWeek = (weekIdx: number) => {
    const source = workoutWeeks[weekIdx];
    const copy: WorkoutWeek = {
      name: `${source.name} (cópia)`,
      intensity: source.intensity,
      is_peak_week: false,
      notes: source.notes,
      days: source.days.map((d) => ({
        dayName: d.dayName,
        exercises: d.exercises.map((e) => ({ ...e })),
      })),
    };
    const updated = [...workoutWeeks];
    updated.splice(weekIdx + 1, 0, copy);
    setWorkoutWeeks(updated);
    setActiveWeekIdx(weekIdx + 1);
  };

  const handleRemoveWeek = (weekIdx: number) => {
    if (workoutWeeks.length <= 1) return;
    const updated = workoutWeeks.filter((_, i) => i !== weekIdx);
    setWorkoutWeeks(updated);
    setActiveWeekIdx(Math.min(activeWeekIdx, updated.length - 1));
  };

  const handleUpdateWeekField = <K extends keyof WorkoutWeek>(
    weekIdx: number,
    field: K,
    value: WorkoutWeek[K],
  ) => {
    const updated = [...workoutWeeks];
    updated[weekIdx] = { ...updated[weekIdx], [field]: value };
    setWorkoutWeeks(updated);
  };

  // ── Day/exercise helpers (operam na semana ativa) ──
  const handleAddWorkoutDay = () => {
    const dayNames = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const updated = [...workoutWeeks];
    const days = updated[activeWeekIdx].days;
    const nextName = dayNames[days.length] || `Dia ${days.length + 1}`;
    updated[activeWeekIdx].days = [...days, { dayName: nextName, exercises: [] }];
    setWorkoutWeeks(updated);
  };

  const handleRemoveWorkoutDay = (dayIndex: number) => {
    const updated = [...workoutWeeks];
    updated[activeWeekIdx].days = updated[activeWeekIdx].days.filter((_, i) => i !== dayIndex);
    setWorkoutWeeks(updated);
  };

  // Picker state — abre o catálogo para o dia atual. Quando o user escolhe um
  // exercício, ele entra no dia selecionado já com sets/reps/rest do default
  // + exercise_id e youtube_id snapshot pro app renderizar o vídeo.
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const handleAddExercise = (dayIndex: number) => {
    // Abre o picker do catálogo em vez de inserir uma linha vazia.
    setPickerDay(dayIndex);
  };

  const handleAddBlankExercise = (dayIndex: number) => {
    // Fallback: insere linha vazia (caso o admin queira digitar livre).
    const updated = [...workoutWeeks];
    updated[activeWeekIdx].days[dayIndex].exercises.push({
      name: "",
      sets: 3,
      reps: "10-12",
      rest: 60,
      notes: "",
    });
    setWorkoutWeeks(updated);
  };

  const handlePickFromCatalog = (
    picked: {
      name: string;
      sets: number;
      reps: string;
      rest: number;
      notes: string;
      exercise_id: string;
      youtube_id?: string;
    },
  ) => {
    if (pickerDay === null) return;
    const updated = [...workoutWeeks];
    updated[activeWeekIdx].days[pickerDay].exercises.push(picked);
    setWorkoutWeeks(updated);
  };

  const handleRemoveExercise = (dayIndex: number, exerciseIndex: number) => {
    const updated = [...workoutWeeks];
    updated[activeWeekIdx].days[dayIndex].exercises.splice(exerciseIndex, 1);
    setWorkoutWeeks(updated);
  };

  // ── Técnica ──
  const handleUpdateTechnique = (dayIndex: number, exerciseIndex: number, slug: string) => {
    const updated = [...workoutWeeks];
    const ex = updated[activeWeekIdx].days[dayIndex].exercises[exerciseIndex];
    if (slug === "straight" || !slug) {
      delete ex.technique;
      delete ex.technique_detail;
    } else {
      ex.technique = slug;
    }
    setWorkoutWeeks(updated);
  };

  const handleUpdateTechniqueDetail = (dayIndex: number, exerciseIndex: number, text: string) => {
    const updated = [...workoutWeeks];
    updated[activeWeekIdx].days[dayIndex].exercises[exerciseIndex].technique_detail =
      text || undefined;
    setWorkoutWeeks(updated);
  };

  // ── Agrupamento (bi-set / tri-set / superset / circuito) ──
  const handleStartGroup = (
    dayIndex: number,
    exerciseIndex: number,
    groupType: ExerciseGroupTypeSlug,
  ) => {
    const meta = EXERCISE_GROUP_TYPES.find((g) => g.value === groupType);
    if (!meta) return;
    const list = workoutWeeks[activeWeekIdx].days[dayIndex].exercises;
    const targetSize = meta.size === 0 ? Math.max(2, list.length - exerciseIndex) : meta.size;
    if (exerciseIndex + targetSize > list.length) {
      toast.error(
        `Precisa de pelo menos ${targetSize} exercícios a partir daqui. Adicione mais e tente de novo.`,
      );
      return;
    }
    for (let i = exerciseIndex; i < exerciseIndex + targetSize; i++) {
      if (list[i].group_id) {
        toast.error(`"${list[i].name || "Exercício"}" já está em outro grupo. Desagrupe primeiro.`);
        return;
      }
    }
    const groupId = shortGroupId();
    const updated = [...workoutWeeks];
    for (let i = 0; i < targetSize; i++) {
      const target = updated[activeWeekIdx].days[dayIndex].exercises[exerciseIndex + i];
      target.group_id = groupId;
      target.group_type = groupType;
      target.group_role = String.fromCharCode(65 + i);
    }
    setWorkoutWeeks(updated);
    toast.success(`${meta.label} criado!`, {
      style: { borderLeft: "3px solid #00FF88" },
    });
  };

  const handleClearGroup = (dayIndex: number, exerciseIndex: number) => {
    const updated = [...workoutWeeks];
    const ex = updated[activeWeekIdx].days[dayIndex].exercises[exerciseIndex];
    const gid = ex.group_id;
    if (!gid) return;
    updated[activeWeekIdx].days[dayIndex].exercises = updated[activeWeekIdx].days[
      dayIndex
    ].exercises.map((e) => {
      if (e.group_id !== gid) return e;
      const { group_id, group_type, group_role, ...rest } = e;
      void group_id;
      void group_type;
      void group_role;
      return rest as WorkoutExercise;
    });
    setWorkoutWeeks(updated);
  };

  const handleUpdateExercise = (
    dayIndex: number,
    exerciseIndex: number,
    field: keyof WorkoutExercise,
    value: unknown
  ) => {
    const updated = [...workoutWeeks];
    (updated[activeWeekIdx].days[dayIndex].exercises[exerciseIndex][field] as unknown) = value;
    setWorkoutWeeks(updated);
  };

  const handleUpdateDayName = (dayIndex: number, newName: string) => {
    const updated = [...workoutWeeks];
    updated[activeWeekIdx].days[dayIndex].dayName = newName;
    setWorkoutWeeks(updated);
  };

  // ── Diet helpers (sem mudança) ──
  const handleAddDietMeal = () => {
    const mealNames = ["Café da Manhã", "Lanche Matinal", "Almoço", "Café da Tarde", "Janta", "Ceia"];
    const nextName = mealNames[dietMeals.length] || `Refeição ${dietMeals.length + 1}`;
    setDietMeals([
      ...dietMeals,
      { mealName: nextName, time: "12:00", foods: [] },
    ]);
  };

  const handleRemoveDietMeal = (index: number) => {
    setDietMeals(dietMeals.filter((_, i) => i !== index));
  };

  const handleAddFood = (mealIndex: number) => {
    const newMeals = [...dietMeals];
    newMeals[mealIndex].foods.push({ name: "", quantity: "100g" });
    setDietMeals(newMeals);
  };

  const handleRemoveFood = (mealIndex: number, foodIndex: number) => {
    const newMeals = [...dietMeals];
    newMeals[mealIndex].foods.splice(foodIndex, 1);
    setDietMeals(newMeals);
  };

  const handleUpdateFood = (
    mealIndex: number,
    foodIndex: number,
    field: keyof DietFood,
    value: string
  ) => {
    const newMeals = [...dietMeals];
    newMeals[mealIndex].foods[foodIndex][field] = value;
    setDietMeals(newMeals);
  };

  const handleUpdateMealField = (
    mealIndex: number,
    field: "mealName" | "time",
    value: string
  ) => {
    const newMeals = [...dietMeals];
    (newMeals[mealIndex][field] as unknown) = value;
    setDietMeals(newMeals);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    const data =
      templateType === "workout"
        ? { weeks: workoutWeeks }
        : { meals: dietMeals };

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("type", templateType);
      formData.append("description", description);
      formData.append("data", JSON.stringify(data));

      if (template) {
        await updateTemplate(template.id, formData);
        toast.success("Template atualizado com sucesso!");
      } else {
        await createTemplate(formData);
        toast.success("Template criado com sucesso!");
      }

      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar template"
      );
    } finally {
      setLoading(false);
    }
  };

  const currentWeek = workoutWeeks[activeWeekIdx];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">
          {children}
        </span>
      ) : (
        <DialogTrigger className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-7 py-3 bg-pink hover:bg-pink/90 text-white rounded-full transition-all">
          <Plus size={18} />
          Novo Template
        </DialogTrigger>
      )}

      <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden bg-bg-1 border-gray-4">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            {template ? "Editar Template" : "Novo Template"}
          </DialogTitle>
          <DialogDescription className="text-gray-2">
            {template ? "Edite o template existente" : "Crie um novo template de treino ou dieta"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!template && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-2">Tipo de Template</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTemplateType("workout")}
                  className={`flex-1 min-w-0 py-3 px-3 rounded-[10px] border-2 transition-all flex items-center justify-center gap-2 text-sm ${
                    templateType === "workout"
                      ? "bg-pink/20 border-pink text-white"
                      : "bg-bg-2 border-gray-4 text-gray-2 hover:border-gray-3"
                  }`}
                >
                  <Dumbbell size={16} className="shrink-0" />
                  Treino
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType("diet")}
                  className={`flex-1 min-w-0 py-3 px-3 rounded-[10px] border-2 transition-all flex items-center justify-center gap-2 text-sm ${
                    templateType === "diet"
                      ? "bg-pink/20 border-pink text-white"
                      : "bg-bg-2 border-gray-4 text-gray-2 hover:border-gray-3"
                  }`}
                >
                  <Apple size={16} className="shrink-0" />
                  Dieta
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-2">Nome do Template</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Treino Atleta Pré-Competição (4 semanas)"
              className="bg-bg-2 border-gray-4 text-white placeholder:text-gray-3"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-2">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do template..."
              rows={3}
              className="w-full bg-bg-2 border border-gray-4 rounded-[10px] px-4 py-3 text-white placeholder:text-gray-3 focus:outline-none focus:border-pink resize-none"
            />
          </div>

          {/* WORKOUT — periodização (semanas) */}
          {templateType === "workout" && (
            <div className="space-y-4">
              {/* Tabs de semanas */}
              <div className="flex items-center gap-2 border-b border-gray-4 overflow-x-auto pb-px">
                {workoutWeeks.map((w, idx) => (
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
                  onClick={handleAddWeek}
                  className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-3 hover:text-pink border border-gray-4 hover:border-pink/40 rounded-md"
                  title="Adicionar semana"
                >
                  <Plus size={12} /> Semana
                </button>
              </div>

              {currentWeek && (
                <>
                  {/* Metadados da semana ativa */}
                  <div className="bg-bg-2 border border-gray-4 rounded-[12px] p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 min-w-0">
                      <div className="min-w-0">
                        <label className="text-xs text-gray-3 mb-1 block">Nome da semana</label>
                        <Input
                          value={currentWeek.name}
                          onChange={(e) => handleUpdateWeekField(activeWeekIdx, "name", e.target.value)}
                          placeholder="Semana 1 — Adaptação"
                          className="w-full bg-bg-1 border-gray-4 text-white"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="text-xs text-gray-3 mb-1 block">Intensidade</label>
                        <select
                          value={currentWeek.intensity ?? ""}
                          onChange={(e) =>
                            handleUpdateWeekField(
                              activeWeekIdx,
                              "intensity",
                              (e.target.value || undefined) as WeekIntensity | undefined,
                            )
                          }
                          className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
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
                          onChange={(e) => handleUpdateWeekField(activeWeekIdx, "is_peak_week", e.target.checked)}
                          className="accent-pink"
                        />
                        <Flame size={14} className="text-pink" /> Peak Week
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleDuplicateWeek(activeWeekIdx)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-2 hover:text-white border border-gray-4 hover:border-pink/40 rounded-md"
                        >
                          <Copy size={12} /> Duplicar
                        </button>
                        {workoutWeeks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWeek(activeWeekIdx)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-gray-3 hover:text-danger border border-gray-4 hover:border-danger/40 rounded-md"
                          >
                            <X size={12} /> Remover
                          </button>
                        )}
                      </div>
                    </div>
                    <Input
                      value={currentWeek.notes ?? ""}
                      onChange={(e) => handleUpdateWeekField(activeWeekIdx, "notes", e.target.value)}
                      placeholder="Notas da semana (opcional)"
                      className="w-full bg-bg-1 border-gray-4 text-white placeholder:text-gray-3"
                    />
                  </div>

                  {/* Dias da semana ativa */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-sm font-semibold text-gray-2">Dias de treino</label>
                    <Button
                      type="button"
                      onClick={handleAddWorkoutDay}
                      variant="secondary"
                      size="sm"
                      className="border-gray-4 text-pink hover:text-pink shrink-0"
                    >
                      <Plus size={16} className="mr-1" />
                      Adicionar Dia
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {currentWeek.days.map((day, dayIndex) => (
                      <div key={dayIndex} className="bg-bg-2 border border-gray-4 rounded-[12px] p-4">
                        <div className="flex items-center justify-between mb-4">
                          <Input
                            value={day.dayName}
                            onChange={(e) => handleUpdateDayName(dayIndex, e.target.value)}
                            className="bg-bg-1 border-gray-4 text-white font-semibold w-full mr-2"
                            placeholder="Nome do dia"
                          />
                          {currentWeek.days.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveWorkoutDay(dayIndex)}
                              className="text-gray-2 hover:text-red-500 transition-colors"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3 mb-3">
                          {day.exercises.map((exercise, exerciseIndex) => {
                            const techMeta = exerciseTechniqueMeta(exercise.technique);
                            const inGroup = !!exercise.group_id;
                            const groupTypeMeta = inGroup
                              ? EXERCISE_GROUP_TYPES.find((g) => g.value === exercise.group_type)
                              : null;
                            return (
                              <div
                                key={exerciseIndex}
                                className={`bg-bg-1 border border-gray-4 rounded-[10px] p-3 space-y-3 ${
                                  inGroup ? "border-l-4 border-l-pink/60" : ""
                                }`}
                              >
                                {inGroup && (
                                  <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.1em] uppercase">
                                    <span className="text-pink">
                                      {groupTypeMeta?.label ?? exercise.group_type} ·{" "}
                                      {exercise.group_role}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleClearGroup(dayIndex, exerciseIndex)}
                                      className="inline-flex items-center gap-1 text-gray-3 hover:text-danger"
                                      title="Desagrupar bloco"
                                    >
                                      <Unlink size={10} /> desagrupar
                                    </button>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <Input
                                    value={exercise.name}
                                    onChange={(e) =>
                                      handleUpdateExercise(dayIndex, exerciseIndex, "name", e.target.value)
                                    }
                                    placeholder="Nome do exercício"
                                    className="bg-bg-2 border-gray-4 text-white placeholder:text-gray-3 flex-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExercise(dayIndex, exerciseIndex)}
                                    className="text-gray-2 hover:text-red-500 ml-2 transition-colors"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-gray-3">Séries</label>
                                    <Input
                                      type="number"
                                      value={exercise.sets}
                                      onChange={(e) =>
                                        handleUpdateExercise(dayIndex, exerciseIndex, "sets", parseInt(e.target.value) || 0)
                                      }
                                      min="1"
                                      className="bg-bg-2 border-gray-4 text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-3">Repetições</label>
                                    <Input
                                      value={exercise.reps}
                                      onChange={(e) =>
                                        handleUpdateExercise(dayIndex, exerciseIndex, "reps", e.target.value)
                                      }
                                      placeholder="10-12"
                                      className="bg-bg-2 border-gray-4 text-white placeholder:text-gray-3"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-3">Descanso (segundos)</label>
                                  <Input
                                    type="number"
                                    value={exercise.rest}
                                    onChange={(e) =>
                                      handleUpdateExercise(dayIndex, exerciseIndex, "rest", parseInt(e.target.value) || 0)
                                    }
                                    min="0"
                                    className="bg-bg-2 border-gray-4 text-white"
                                  />
                                </div>

                                <Input
                                  value={exercise.notes}
                                  onChange={(e) =>
                                    handleUpdateExercise(dayIndex, exerciseIndex, "notes", e.target.value)
                                  }
                                  placeholder="Notas (opcional)"
                                  className="bg-bg-2 border-gray-4 text-white placeholder:text-gray-3"
                                />

                                {/* Técnica + Agrupamento */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                  <select
                                    value={exercise.technique ?? "straight"}
                                    onChange={(e) => handleUpdateTechnique(dayIndex, exerciseIndex, e.target.value)}
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
                                    <Input
                                      value={exercise.technique_detail ?? ""}
                                      onChange={(e) =>
                                        handleUpdateTechniqueDetail(dayIndex, exerciseIndex, e.target.value)
                                      }
                                      placeholder={
                                        exercise.technique === "dropset"
                                          ? "Ex: 3 quedas — 100→70→50kg"
                                          : exercise.technique === "pyramid"
                                          ? "Ex: crescente 10/8/6/4"
                                          : "Detalhe (opcional)"
                                      }
                                      className="flex-1 min-w-[140px] bg-bg-2 border-gray-4 text-gray-1 text-[11px] placeholder:text-gray-3/60 h-[28px]"
                                    />
                                  )}
                                  {!inGroup && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleStartGroup(dayIndex, exerciseIndex, "bi_set")}
                                        className="inline-flex items-center gap-1 text-[10px] text-gray-3 hover:text-pink border border-gray-4 hover:border-pink/40 rounded-md px-1.5 py-0.5"
                                        title="Agrupar com o próximo (bi-set)"
                                      >
                                        <Link2 size={10} /> Bi-set
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleStartGroup(dayIndex, exerciseIndex, "tri_set")}
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

                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            onClick={() => handleAddExercise(dayIndex)}
                            variant="secondary"
                            size="sm"
                            className="flex-1 border-gray-4 text-pink hover:text-pink"
                          >
                            <Plus size={16} className="mr-1" />
                            Do catálogo (com vídeo)
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleAddBlankExercise(dayIndex)}
                            variant="ghost"
                            size="sm"
                            className="flex-1 text-gray-2"
                          >
                            <Plus size={16} className="mr-1" />
                            Livre
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Diet Template Editor (sem mudança) */}
          {templateType === "diet" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-2">Refeições</label>
                <Button
                  type="button"
                  onClick={handleAddDietMeal}
                  variant="secondary"
                  size="sm"
                  className="border-gray-4 text-pink hover:text-pink"
                >
                  <Plus size={16} className="mr-1" />
                  Adicionar Refeição
                </Button>
              </div>

              <div className="space-y-4">
                {dietMeals.map((meal, mealIndex) => (
                  <div key={mealIndex} className="bg-bg-2 border border-gray-4 rounded-[12px] p-4">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <Input
                        value={meal.mealName}
                        onChange={(e) =>
                          handleUpdateMealField(mealIndex, "mealName", e.target.value)
                        }
                        placeholder="Nome da refeição"
                        className="bg-bg-1 border-gray-4 text-white placeholder:text-gray-3"
                      />
                      <Input
                        type="time"
                        value={meal.time}
                        onChange={(e) => handleUpdateMealField(mealIndex, "time", e.target.value)}
                        className="bg-bg-1 border-gray-4 text-white"
                      />
                    </div>

                    <div className="space-y-2 mb-3">
                      {meal.foods.map((food, foodIndex) => (
                        <div key={foodIndex} className="flex items-center gap-2">
                          <Input
                            value={food.name}
                            onChange={(e) =>
                              handleUpdateFood(mealIndex, foodIndex, "name", e.target.value)
                            }
                            placeholder="Nome do alimento"
                            className="bg-bg-1 border-gray-4 text-white placeholder:text-gray-3 flex-1"
                          />
                          <Input
                            value={food.quantity}
                            onChange={(e) =>
                              handleUpdateFood(mealIndex, foodIndex, "quantity", e.target.value)
                            }
                            placeholder="100g"
                            className="bg-bg-1 border-gray-4 text-white placeholder:text-gray-3 w-24"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFood(mealIndex, foodIndex)}
                            className="text-gray-2 hover:text-red-500 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => handleAddFood(mealIndex)}
                        variant="secondary"
                        size="sm"
                        className="flex-1 border-gray-4 text-pink hover:text-pink"
                      >
                        <Plus size={16} className="mr-1" />
                        Alimento
                      </Button>
                      {dietMeals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDietMeal(mealIndex)}
                          className="px-3 py-2 text-gray-2 hover:text-red-500 border border-gray-4 rounded-[8px] transition-colors"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-4">
            <Button
              type="button"
              onClick={() => setOpen(false)}
              variant="secondary"
              className="flex-1 border-gray-4 text-gray-2 hover:text-white hover:bg-bg-2"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-pink hover:bg-pink/90 text-white disabled:opacity-50"
            >
              {loading ? "Salvando..." : template ? "Atualizar" : "Criar"} Template
            </Button>
          </div>
        </form>
      </DialogContent>

      <ExercisePicker
        open={pickerDay !== null}
        onClose={() => setPickerDay(null)}
        onPick={handlePickFromCatalog}
      />
    </Dialog>
  );
}
