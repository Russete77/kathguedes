"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Calculator, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type Goal = "deficit" | "manutencao" | "superavit";
type Sex = "feminino" | "masculino";

interface MacroResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const goals: { value: Goal; label: string; desc: string }[] = [
  { value: "deficit", label: "Emagrecer", desc: "Déficit calórico" },
  { value: "manutencao", label: "Manter", desc: "Manutenção" },
  { value: "superavit", label: "Ganhar massa", desc: "Superávit" },
];

const sexOptions: { value: Sex; label: string }[] = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
];

const activityLevels = [
  { value: 1.2, label: "Sedentária" },
  { value: 1.375, label: "Leve (1-3x/sem)" },
  { value: 1.55, label: "Moderado (3-5x/sem)" },
  { value: 1.725, label: "Intenso (6-7x/sem)" },
  { value: 1.9, label: "Atleta" },
];

function calculateMacros(
  weight: number,
  height: number,
  age: number,
  activity: number,
  goal: Goal,
  sex: Sex
): MacroResult {
  // Harris-Benedict formula based on sex
  let bmr: number;
  if (sex === "masculino") {
    // Male: BMR = 88.362 + (13.397 × weight) + (4.799 × height) - (5.677 × age)
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  } else {
    // Female: BMR = 447.593 + (9.247 × weight) + (3.098 × height) - (4.330 × age)
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  }
  const tdee = bmr * activity;

  const multipliers: Record<Goal, number> = {
    deficit: 0.8,
    manutencao: 1.0,
    superavit: 1.15,
  };

  const calories = Math.round(tdee * multipliers[goal]);

  // Macros: 2g proteína/kg, 25% gordura, restante carboidrato
  const protein = Math.round(weight * 2);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat };
}

export function MacroCalculator() {
  const [goal, setGoal] = useState<Goal>("deficit");
  const [activity, setActivity] = useState(1.55);
  const [sex, setSex] = useState<Sex>("feminino");
  const [result, setResult] = useState<MacroResult | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const weight = Number(form.get("weight"));
    const height = Number(form.get("height"));
    const age = Number(form.get("age"));

    if (!weight || !height || !age) return;

    setResult(calculateMacros(weight, height, age, activity, goal, sex));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sex Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
            Sexo
          </label>
          <div className="flex gap-2">
            {sexOptions.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSex(s.value)}
                className={cn(
                  "flex-1 px-4 py-2 rounded-[10px] border text-center transition-all duration-150 text-[14px] font-medium",
                  sex === s.value
                    ? "bg-pink-dim border-pink/40 text-pink"
                    : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="grid grid-cols-3 gap-3">
          {goals.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(g.value)}
              className={cn(
                "p-4 rounded-[14px] border text-center transition-all duration-150",
                goal === g.value
                  ? "bg-pink-dim border-pink/40 text-pink"
                  : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
              )}
            >
              <div className="font-bold text-[14px]">{g.label}</div>
              <div className="text-[11px] mt-0.5 opacity-70">{g.desc}</div>
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-3 gap-4">
          <Input name="weight" label="Peso (kg)" type="number" placeholder="65" required />
          <Input name="height" label="Altura (cm)" type="number" placeholder="165" required />
          <Input name="age" label="Idade" type="number" placeholder="28" required />
        </div>

        {/* Activity */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
            Nível de atividade
          </label>
          <div className="flex flex-wrap gap-2">
            {activityLevels.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setActivity(a.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150 border",
                  activity === a.value
                    ? "bg-pink-dim text-pink border-pink/25"
                    : "bg-bg-2 text-gray-3 border-gray-4 hover:text-gray-1"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full">
          <Calculator size={18} />
          Calcular Macros
        </Button>
      </form>

      {/* Result */}
      {result && (
        <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 space-y-5">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Flame size={20} className="stroke-pink" />
              <span className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">
                Calorias diárias
              </span>
            </div>
            <div className="font-display text-[64px] leading-none text-pink">
              {result.calories}
            </div>
            <div className="font-mono text-[13px] text-gray-3 mt-1">kcal/dia</div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <MacroBar
              label="Proteína"
              value={result.protein}
              unit="g"
              color="text-pink"
              pct={Math.round((result.protein * 4 * 100) / result.calories)}
            />
            <MacroBar
              label="Carboidrato"
              value={result.carbs}
              unit="g"
              color="text-yellow"
              pct={Math.round((result.carbs * 4 * 100) / result.calories)}
            />
            <MacroBar
              label="Gordura"
              value={result.fat}
              unit="g"
              color="text-info"
              pct={Math.round((result.fat * 9 * 100) / result.calories)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({
  label,
  value,
  unit,
  color,
  pct,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  pct: number;
}) {
  return (
    <div className="text-center space-y-2">
      <div className={cn("font-display text-[32px] leading-none", color)}>
        {value}
      </div>
      <div className="font-mono text-[11px] text-gray-3">
        {unit} · {pct}%
      </div>
      <Progress value={pct} />
      <div className="text-[12px] text-gray-2 font-medium">{label}</div>
    </div>
  );
}
