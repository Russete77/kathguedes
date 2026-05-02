"use client";

import { useState, ReactNode } from "react";
import { createTemplate, updateTemplate } from "../actions";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

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

export function TemplateEditor({ template, children }: TemplateEditorProps) {
  const [open, setOpen] = useState(false);
  const [templateType, setTemplateType] = useState<"workout" | "diet">(
    template?.type || "workout"
  );
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [loading, setLoading] = useState(false);

  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>(
    getInitialWorkoutDays(template)
  );
  const [dietMeals, setDietMeals] = useState<DietMeal[]>(
    getInitialDietMeals(template)
  );

  function getInitialWorkoutDays(t?: PlanTemplate): WorkoutDay[] {
    if (!t || t.type !== "workout") {
      return [{ dayName: "Segunda", exercises: [] }];
    }
    const data = t.data as { weeks?: Array<{ days?: WorkoutDay[] }> };
    return data.weeks?.[0]?.days || [{ dayName: "Segunda", exercises: [] }];
  }

  function getInitialDietMeals(t?: PlanTemplate): DietMeal[] {
    if (!t || t.type !== "diet") {
      return [{ mealName: "Café da Manhã", time: "07:00", foods: [] }];
    }
    const data = t.data as { meals?: DietMeal[] };
    return data.meals || [{ mealName: "Café da Manhã", time: "07:00", foods: [] }];
  }

  const handleAddWorkoutDay = () => {
    const dayNames = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const nextName = dayNames[workoutDays.length] || `Dia ${workoutDays.length + 1}`;
    setWorkoutDays([...workoutDays, { dayName: nextName, exercises: [] }]);
  };

  const handleRemoveWorkoutDay = (index: number) => {
    setWorkoutDays(workoutDays.filter((_, i) => i !== index));
  };

  const handleAddExercise = (dayIndex: number) => {
    const newDays = [...workoutDays];
    newDays[dayIndex].exercises.push({
      name: "",
      sets: 3,
      reps: "10-12",
      rest: 60,
      notes: "",
    });
    setWorkoutDays(newDays);
  };

  const handleRemoveExercise = (dayIndex: number, exerciseIndex: number) => {
    const newDays = [...workoutDays];
    newDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setWorkoutDays(newDays);
  };

  const handleUpdateExercise = (
    dayIndex: number,
    exerciseIndex: number,
    field: keyof WorkoutExercise,
    value: unknown
  ) => {
    const newDays = [...workoutDays];
    (newDays[dayIndex].exercises[exerciseIndex][field] as unknown) = value;
    setWorkoutDays(newDays);
  };

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

  const handleUpdateDayName = (dayIndex: number, newName: string) => {
    const newDays = [...workoutDays];
    newDays[dayIndex].dayName = newName;
    setWorkoutDays(newDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    const data =
      templateType === "workout"
        ? { weeks: [{ days: workoutDays }] }
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

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-1 border-gray-4">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            {template ? "Editar Template" : "Novo Template"}
          </DialogTitle>
          <DialogDescription className="text-gray-2">
            {template ? "Edite o template existente" : "Crie um novo template de treino ou dieta"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Type Selection - Only for new templates */}
          {!template && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-2">Tipo de Template</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTemplateType("workout")}
                  className={`flex-1 py-3 px-4 rounded-[10px] border-2 transition-all flex items-center justify-center gap-2 ${
                    templateType === "workout"
                      ? "bg-pink/20 border-pink text-white"
                      : "bg-bg-2 border-gray-4 text-gray-2 hover:border-gray-3"
                  }`}
                >
                  <Dumbbell size={18} />
                  Treino
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType("diet")}
                  className={`flex-1 py-3 px-4 rounded-[10px] border-2 transition-all flex items-center justify-center gap-2 ${
                    templateType === "diet"
                      ? "bg-pink/20 border-pink text-white"
                      : "bg-bg-2 border-gray-4 text-gray-2 hover:border-gray-3"
                  }`}
                >
                  <Apple size={18} />
                  Dieta
                </button>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-2">Nome do Template</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Treino Full Body Iniciante"
              className="bg-bg-2 border-gray-4 text-white placeholder:text-gray-3"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-2">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do template..."
              rows={3}
              className="w-full bg-bg-2 border border-gray-4 rounded-[10px] px-4 py-3 text-white placeholder:text-gray-3 focus:outline-none focus:border-pink resize-none"
            />
          </div>

          {/* Workout Template Editor */}
          {templateType === "workout" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-2">Dias de Treino</label>
                <Button
                  type="button"
                  onClick={handleAddWorkoutDay}
                  variant="secondary"
                  size="sm"
                  className="border-gray-4 text-pink hover:text-pink"
                >
                  <Plus size={16} className="mr-1" />
                  Adicionar Dia
                </Button>
              </div>

              <div className="space-y-4">
                {workoutDays.map((day, dayIndex) => (
                  <div key={dayIndex} className="bg-bg-2 border border-gray-4 rounded-[12px] p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Input
                        value={day.dayName}
                        onChange={(e) => handleUpdateDayName(dayIndex, e.target.value)}
                        className="bg-bg-1 border-gray-4 text-white font-semibold w-full mr-2"
                        placeholder="Nome do dia"
                      />
                      {workoutDays.length > 1 && (
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
                      {day.exercises.map((exercise, exerciseIndex) => (
                        <div
                          key={exerciseIndex}
                          className="bg-bg-1 border border-gray-4 rounded-[10px] p-3 space-y-3"
                        >
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
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      onClick={() => handleAddExercise(dayIndex)}
                      variant="secondary"
                      size="sm"
                      className="w-full border-gray-4 text-pink hover:text-pink"
                    >
                      <Plus size={16} className="mr-1" />
                      Adicionar Exercício
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diet Template Editor */}
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
    </Dialog>
  );
}
