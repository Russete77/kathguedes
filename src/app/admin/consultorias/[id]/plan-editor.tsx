"use client";

import { useState } from "react";
import { updateConsultationPlan } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Send, Zap } from "lucide-react";
import { toast } from "sonner";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  youtube_id?: string;
}

interface TrainingDay {
  name: string;
  exercises: Exercise[];
}

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
}: PlanEditorProps) {
  const wp = initialWorkoutPlan as { weeks: { name: string; days: TrainingDay[] }[] } | null;
  const dp = initialDietPlan as { meals: Meal[] } | null;

  const [days, setDays] = useState<TrainingDay[]>(
    wp?.weeks?.[0]?.days || [{ name: "Segunda", exercises: [] }]
  );
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

  // ── Workout Templates ──
  const workoutTemplates = {
    "gluteo-pernas-4": {
      name: "Glúteo + Pernas (4 dias)",
      days: [
        {
          name: "Glúteo A",
          exercises: [
            { name: "Agachamento Búlgaro", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Cadeira Extensora", sets: 3, reps: "12-15", rest: "60s" },
            { name: "Extensão de Glúteo", sets: 4, reps: "12", rest: "60s" },
          ],
        },
        {
          name: "Costas + Posterior",
          exercises: [
            { name: "Puxada na Máquina", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Leg Curl", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Flexão de Isquiotibiais", sets: 3, reps: "12", rest: "60s" },
          ],
        },
        {
          name: "Glúteo B",
          exercises: [
            { name: "Hip Thrust", sets: 4, reps: "12-15", rest: "90s" },
            { name: "Hack Machine", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Stiff Leg Deadlift", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Abdução na Máquina", sets: 3, reps: "15", rest: "60s" },
          ],
        },
        {
          name: "Pernas Isoladas",
          exercises: [
            { name: "Leg Press Oblíquo", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Cadeira Adutora", sets: 3, reps: "15", rest: "60s" },
            { name: "Cadeira Abdutora", sets: 3, reps: "15", rest: "60s" },
            { name: "Panturrilha na Máquina", sets: 4, reps: "15-20", rest: "60s" },
          ],
        },
      ],
    },
    "upper-lower-4": {
      name: "Upper/Lower Split (4 dias)",
      days: [
        {
          name: "Upper A",
          exercises: [
            { name: "Supino Inclinado", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Puxada Supinada", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Desenvolvimento Ombro", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Rosca Inversa", sets: 3, reps: "12", rest: "60s" },
          ],
        },
        {
          name: "Lower A",
          exercises: [
            { name: "Agachamento Livre", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Cadeira Extensora", sets: 3, reps: "12-15", rest: "60s" },
            { name: "Leg Curl Sentado", sets: 3, reps: "12", rest: "60s" },
          ],
        },
        {
          name: "Upper B",
          exercises: [
            { name: "Supino Reto", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Barra Fixa", sets: 3, reps: "6-10", rest: "120s" },
            { name: "Voador Peitoral", sets: 3, reps: "12", rest: "90s" },
            { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "60s" },
          ],
        },
        {
          name: "Lower B",
          exercises: [
            { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Agachamento Búlgaro", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Stiff Deadlift", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Panturrilha Máquina", sets: 3, reps: "15-20", rest: "60s" },
          ],
        },
      ],
    },
    "full-body-3": {
      name: "Full Body (3 dias)",
      days: [
        {
          name: "Full Body A",
          exercises: [
            { name: "Agachamento", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Supino", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Leg Curl", sets: 3, reps: "12", rest: "60s" },
          ],
        },
        {
          name: "Full Body B",
          exercises: [
            { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Puxada Supinada", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Desenvolvimento", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Panturrilha", sets: 3, reps: "15-20", rest: "60s" },
          ],
        },
        {
          name: "Full Body C",
          exercises: [
            { name: "Hack Machine", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Barra Fixa", sets: 3, reps: "6-10", rest: "120s" },
            { name: "Voador", sets: 3, reps: "12", rest: "90s" },
            { name: "Rosca Inversa", sets: 3, reps: "12", rest: "60s" },
          ],
        },
      ],
    },
    "ppl-6": {
      name: "Push/Pull/Legs (6 dias)",
      days: [
        {
          name: "Push A",
          exercises: [
            { name: "Supino Inclinado", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Desenvolvimento Ombro", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Crucifixo", sets: 3, reps: "12", rest: "90s" },
            { name: "Rosca Triceps", sets: 3, reps: "12-15", rest: "60s" },
          ],
        },
        {
          name: "Pull A",
          exercises: [
            { name: "Barra Fixa", sets: 4, reps: "6-10", rest: "120s" },
            { name: "Rosca Direta", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Puxada Inversa", sets: 3, reps: "12", rest: "90s" },
            { name: "Encolhimento", sets: 3, reps: "12-15", rest: "60s" },
          ],
        },
        {
          name: "Legs A",
          exercises: [
            { name: "Agachamento", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Leg Press", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Leg Curl", sets: 3, reps: "12", rest: "90s" },
            { name: "Panturrilha", sets: 3, reps: "15-20", rest: "60s" },
          ],
        },
        {
          name: "Push B",
          exercises: [
            { name: "Supino Reto", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Paralela", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Elevação Lateral", sets: 3, reps: "12-15", rest: "90s" },
            { name: "Rosca Francesa", sets: 3, reps: "12-15", rest: "60s" },
          ],
        },
        {
          name: "Pull B",
          exercises: [
            { name: "Puxada na Máquina", sets: 4, reps: "8-10", rest: "120s" },
            { name: "Rosca Scott", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Remada", sets: 3, reps: "10-12", rest: "90s" },
            { name: "Voador Posterior", sets: 3, reps: "12-15", rest: "60s" },
          ],
        },
        {
          name: "Legs B",
          exercises: [
            { name: "Hack Machine", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Leg Curl Deitado", sets: 4, reps: "10-12", rest: "90s" },
            { name: "Cadeira Extensora", sets: 3, reps: "12-15", rest: "60s" },
            { name: "Cadeira Abdutora", sets: 3, reps: "15", rest: "60s" },
          ],
        },
      ],
    },
    "hiit-funcional-3": {
      name: "HIIT + Funcional (3 dias)",
      days: [
        {
          name: "HIIT Cardio",
          exercises: [
            { name: "Burpee", sets: 10, reps: "30s", rest: "30s" },
            { name: "Polichinelo", sets: 10, reps: "30s", rest: "30s" },
            { name: "Mountain Climbers", sets: 10, reps: "30s", rest: "30s" },
            { name: "Jump Squat", sets: 10, reps: "30s", rest: "30s" },
          ],
        },
        {
          name: "Funcional + Force",
          exercises: [
            { name: "Agachamento", sets: 4, reps: "10", rest: "90s" },
            { name: "Flexão", sets: 4, reps: "15", rest: "90s" },
            { name: "Kettlebell Swing", sets: 3, reps: "20", rest: "90s" },
            { name: "Barra Fixa", sets: 3, reps: "max", rest: "90s" },
          ],
        },
        {
          name: "Circuito Misto",
          exercises: [
            { name: "Corrida no Local", sets: 3, reps: "45s", rest: "15s" },
            { name: "Rosca Terra", sets: 3, reps: "10", rest: "60s" },
            { name: "Box Jump", sets: 3, reps: "8", rest: "90s" },
            { name: "Abdominal", sets: 3, reps: "20", rest: "60s" },
          ],
        },
      ],
    },
  };

  // ── Diet Templates ──
  const dietTemplates = {
    "cutting-4": {
      name: "Cutting (4 refeições)",
      meals: [
        {
          name: "Café da Manhã",
          time: "07:00",
          foods: [
            { name: "Ovo (2 unidades)", quantity: "100g" },
            { name: "Pão integral", quantity: "50g" },
            { name: "Café preto", quantity: "200ml" },
          ],
        },
        {
          name: "Almoço",
          time: "12:00",
          foods: [
            { name: "Peito de frango grelhado", quantity: "150g" },
            { name: "Arroz integral", quantity: "100g" },
            { name: "Brócolis cozido", quantity: "150g" },
          ],
        },
        {
          name: "Lanche",
          time: "16:00",
          foods: [
            { name: "Iogurte grego", quantity: "150g" },
            { name: "Berries congelados", quantity: "100g" },
          ],
        },
        {
          name: "Jantar",
          time: "19:30",
          foods: [
            { name: "Peixe branco grelhado", quantity: "120g" },
            { name: "Batata doce cozida", quantity: "100g" },
            { name: "Salada verde", quantity: "200g" },
          ],
        },
      ],
    },
    "bulking-6": {
      name: "Bulking (6 refeições)",
      meals: [
        {
          name: "Café da Manhã",
          time: "07:00",
          foods: [
            { name: "Ovo (3 unidades)", quantity: "150g" },
            { name: "Pão integral", quantity: "80g" },
            { name: "Mel", quantity: "15g" },
          ],
        },
        {
          name: "Lanche 1",
          time: "09:30",
          foods: [
            { name: "Aveia em flocos", quantity: "50g" },
            { name: "Banana", quantity: "100g" },
            { name: "Pasta de amendoim", quantity: "15g" },
          ],
        },
        {
          name: "Almoço",
          time: "12:00",
          foods: [
            { name: "Carne vermelha magra", quantity: "180g" },
            { name: "Arroz branco", quantity: "150g" },
            { name: "Batata cozida", quantity: "150g" },
          ],
        },
        {
          name: "Lanche 2",
          time: "15:00",
          foods: [
            { name: "Whey protein", quantity: "30g" },
            { name: "Frutas secas", quantity: "30g" },
            { name: "Leite integral", quantity: "200ml" },
          ],
        },
        {
          name: "Jantar",
          time: "18:30",
          foods: [
            { name: "Peito de frango", quantity: "160g" },
            { name: "Batata doce", quantity: "150g" },
            { name: "Azeite", quantity: "10ml" },
          ],
        },
        {
          name: "Antes de Dormir",
          time: "21:00",
          foods: [
            { name: "Caseína", quantity: "30g" },
            { name: "Melancia", quantity: "200g" },
          ],
        },
      ],
    },
    "manutencao-5": {
      name: "Manutenção (5 refeições)",
      meals: [
        {
          name: "Café da Manhã",
          time: "07:00",
          foods: [
            { name: "Ovo (2 unidades)", quantity: "100g" },
            { name: "Aveia", quantity: "40g" },
            { name: "Morango", quantity: "100g" },
          ],
        },
        {
          name: "Lanche da Manhã",
          time: "10:00",
          foods: [
            { name: "Banana", quantity: "100g" },
            { name: "Amêndoas", quantity: "20g" },
          ],
        },
        {
          name: "Almoço",
          time: "13:00",
          foods: [
            { name: "Peito de frango grelhado", quantity: "150g" },
            { name: "Arroz integral", quantity: "120g" },
            { name: "Brócolis", quantity: "150g" },
          ],
        },
        {
          name: "Lanche da Tarde",
          time: "16:00",
          foods: [
            { name: "Iogurte natural", quantity: "150g" },
            { name: "Granola integral", quantity: "30g" },
          ],
        },
        {
          name: "Jantar",
          time: "19:00",
          foods: [
            { name: "Peixe grelhado", quantity: "130g" },
            { name: "Batata cozida", quantity: "120g" },
            { name: "Salada", quantity: "200g" },
          ],
        },
      ],
    },
    "low-carb-4": {
      name: "Low Carb (4 refeições)",
      meals: [
        {
          name: "Café da Manhã",
          time: "07:00",
          foods: [
            { name: "Ovo (3 unidades)", quantity: "150g" },
            { name: "Bacon magro", quantity: "40g" },
            { name: "Café com manteiga", quantity: "250ml" },
          ],
        },
        {
          name: "Almoço",
          time: "12:30",
          foods: [
            { name: "Carne vermelha magra", quantity: "180g" },
            { name: "Salada com azeite", quantity: "300g" },
            { name: "Queijo meia cura", quantity: "30g" },
          ],
        },
        {
          name: "Lanche",
          time: "16:00",
          foods: [
            { name: "Abacate", quantity: "100g" },
            { name: "Castanhas do Brasil", quantity: "30g" },
          ],
        },
        {
          name: "Jantar",
          time: "19:30",
          foods: [
            { name: "Peixe gordo (salmão)", quantity: "150g" },
            { name: "Brócolis com manteiga", quantity: "200g" },
            { name: "Azeitonas", quantity: "50g" },
          ],
        },
      ],
    },
  };

  // ── Training Day helpers ──
  function addDay() {
    setDays([...days, { name: `Dia ${days.length + 1}`, exercises: [] }]);
  }

  function addExercise(dayIdx: number) {
    const updated = [...days];
    updated[dayIdx].exercises.push({ name: "", sets: 3, reps: "12", rest: "60s", youtube_id: "" });
    setDays(updated);
  }

  function updateExercise(dayIdx: number, exIdx: number, field: string, value: string | number) {
    const updated = [...days];
    (updated[dayIdx].exercises[exIdx] as unknown as Record<string, unknown>)[field] = value;
    setDays(updated);
  }

  function removeExercise(dayIdx: number, exIdx: number) {
    const updated = [...days];
    updated[dayIdx].exercises.splice(exIdx, 1);
    setDays(updated);
  }

  function removeDay(dayIdx: number) {
    setDays(days.filter((_, i) => i !== dayIdx));
  }

  function applyWorkoutTemplate(templateKey: string) {
    // Check DB templates first (prefixed with "db:")
    if (templateKey.startsWith("db:")) {
      const dbId = templateKey.replace("db:", "");
      const dbTemplate = dbTemplates?.workout.find((t) => t.id === dbId);
      if (dbTemplate) {
        const data = dbTemplate.data as { weeks?: { days: TrainingDay[] }[] };
        if (data?.weeks?.[0]?.days) {
          setDays(data.weeks[0].days);
          toast.success(`Template "${dbTemplate.name}" carregado!`, {
            style: { borderLeft: "3px solid #00FF88" },
          });
        }
      }
      return;
    }
    // Hardcoded templates
    const template = workoutTemplates[templateKey as keyof typeof workoutTemplates];
    if (template) {
      setDays(template.days);
      toast.success(`Template "${template.name}" carregado!`, {
        style: { borderLeft: "3px solid #00FF88" },
      });
    }
  }

  function applyDietTemplate(templateKey: string) {
    // Check DB templates first (prefixed with "db:")
    if (templateKey.startsWith("db:")) {
      const dbId = templateKey.replace("db:", "");
      const dbTemplate = dbTemplates?.diet.find((t) => t.id === dbId);
      if (dbTemplate) {
        const data = dbTemplate.data as { meals: Meal[] };
        if (data?.meals) {
          setMeals(data.meals);
          toast.success(`Template "${dbTemplate.name}" carregado!`, {
            style: { borderLeft: "3px solid #00FF88" },
          });
        }
      }
      return;
    }
    // Hardcoded templates
    const template = dietTemplates[templateKey as keyof typeof dietTemplates];
    if (template) {
      setMeals(template.meals);
      toast.success(`Template "${template.name}" carregado!`, {
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

  // ── Save ──
  async function handleSave(deliver = false) {
    setSaving(true);
    try {
      await updateConsultationPlan(consultationId, {
        workout_plan: { weeks: [{ name: "Semana 1", days }] },
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-white">PLANO DE TREINO</h2>
          <div className="flex gap-2">
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
              {dbTemplates && dbTemplates.workout.length > 0 && (
                <optgroup label="Seus Templates">
                  {dbTemplates.workout.map((t) => (
                    <option key={t.id} value={`db:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Templates Padrão">
                {Object.entries(workoutTemplates).map(([key, template]) => (
                  <option key={key} value={key}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <Button size="sm" variant="ghost" onClick={addDay}>
              <Plus size={14} /> Dia
            </Button>
          </div>
        </div>

        {days.map((day, dayIdx) => (
          <div key={dayIdx} className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <input
                value={day.name ?? ""}
                onChange={(e) => {
                  const u = [...days];
                  u[dayIdx].name = e.target.value;
                  setDays(u);
                }}
                className="bg-transparent text-white font-bold text-[15px] outline-none border-b border-transparent focus:border-pink"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => addExercise(dayIdx)}>
                  <Plus size={12} /> Exercício
                </Button>
                {days.length > 1 && (
                  <button onClick={() => removeDay(dayIdx)} className="text-gray-3 hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {day.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="space-y-1.5 pb-2 border-b border-gray-4/30 last:border-0">
                <div className="grid grid-cols-[1fr_60px_80px_60px_auto] gap-2 items-end">
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
                <input
                  value={ex.youtube_id ?? ""}
                  onChange={(e) => {
                    let val = e.target.value;
                    // Detectar se é um Shorts URL
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
                  className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-gray-2 text-[11px] px-3 py-1.5 outline-none focus:border-pink placeholder:text-gray-3/60"
                />
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ── DIETA ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-white">PLANO ALIMENTAR</h2>
          <div className="flex gap-2">
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
              {dbTemplates && dbTemplates.diet.length > 0 && (
                <optgroup label="Seus Templates">
                  {dbTemplates.diet.map((t) => (
                    <option key={t.id} value={`db:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Templates Padrão">
                {Object.entries(dietTemplates).map(([key, template]) => (
                  <option key={key} value={key}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
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
          </div>
        </div>

        {/* Macros totais */}
        <div className="grid grid-cols-4 gap-3">
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
    </div>
  );
}
