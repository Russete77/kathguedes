"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  ChevronDown,
  Target,
  Dumbbell,
  UtensilsCrossed,
  Heart,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Anamnesis {
  fullName?: string;
  birthDate?: string;
  biologicalSex?: string;
  weight?: number;
  height?: number;
  waistCircumference?: number;
  hipCircumference?: number;
  primaryObjective?: string;
  secondaryObjective?: string;
  trainingLevel?: string;
  trainingTime?: string;
  weeklyFrequency?: string;
  sessionDuration?: string;
  trainingLocation?: string;
  equipment?: string[];
  preferredTime?: string;
  mealsPerDay?: string;
  proteinEveryMeal?: string;
  drinksEnoughWater?: string;
  waterLiters?: number;
  dietaryRestrictions?: string[];
  foodAllergies?: string;
  supplements?: string;
  injuries?: string;
  chronicDiseases?: string;
  medications?: string;
  sleepQuality?: string;
  sleepHours?: string;
  stressLevel?: string;
  occupation?: string;
  additionalNotes?: string;
  submittedAt?: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-gray-3 text-[13px]">{label}</span>
      <span className="text-white text-[13px] font-medium text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

export function AnamneseSummary({ anamnesis }: { anamnesis: Anamnesis }) {
  const [open, setOpen] = useState(false);

  const age = anamnesis.birthDate
    ? (() => {
        const today = new Date();
        const birth = new Date(anamnesis.birthDate);
        let a = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
        return a;
      })()
    : null;

  const bmi =
    anamnesis.weight && anamnesis.height
      ? Math.round(
          (anamnesis.weight / ((anamnesis.height / 100) ** 2)) * 10
        ) / 10
      : null;

  return (
    <section className="space-y-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-bg-1 border border-gray-4 rounded-[22px] p-5 flex items-center gap-3 hover:border-pink/40 transition-colors"
      >
        <div className="w-10 h-10 bg-pink-dim rounded-full flex items-center justify-center shrink-0">
          <ClipboardList size={18} className="stroke-pink" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="font-display text-xl text-white tracking-wide">
            MINHA ANAMNESE
          </h2>
          {anamnesis.submittedAt && (
            <p className="font-mono text-[11px] text-gray-3">
              Enviada em{" "}
              {new Date(anamnesis.submittedAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <ChevronDown
          size={20}
          className={cn(
            "stroke-pink transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {age != null && (
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-3 text-center">
                <p className="font-mono text-[10px] text-gray-3 uppercase tracking-wider mb-1">
                  Idade
                </p>
                <p className="font-display text-xl text-white">{age} anos</p>
              </div>
            )}
            {anamnesis.weight && (
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-3 text-center">
                <p className="font-mono text-[10px] text-gray-3 uppercase tracking-wider mb-1">
                  Peso
                </p>
                <p className="font-display text-xl text-white">
                  {anamnesis.weight}kg
                </p>
              </div>
            )}
            {anamnesis.height && (
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-3 text-center">
                <p className="font-mono text-[10px] text-gray-3 uppercase tracking-wider mb-1">
                  Altura
                </p>
                <p className="font-display text-xl text-white">
                  {anamnesis.height}cm
                </p>
              </div>
            )}
            {bmi != null && (
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-3 text-center">
                <p className="font-mono text-[10px] text-gray-3 uppercase tracking-wider mb-1">
                  IMC
                </p>
                <p className="font-display text-xl text-white">{bmi}</p>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {/* Objectives */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="stroke-pink" />
                <span className="font-display text-sm text-white uppercase tracking-wide">
                  Objetivos
                </span>
              </div>
              <InfoRow label="Objetivo principal" value={anamnesis.primaryObjective} />
              <InfoRow label="Objetivo secundário" value={anamnesis.secondaryObjective} />
              <InfoRow label="Nível de treino" value={anamnesis.trainingLevel} />
              <InfoRow label="Tempo de treino" value={anamnesis.trainingTime} />
            </div>

            {/* Training */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell size={14} className="stroke-pink" />
                <span className="font-display text-sm text-white uppercase tracking-wide">
                  Rotina de Treino
                </span>
              </div>
              <InfoRow
                label="Frequência"
                value={
                  anamnesis.weeklyFrequency
                    ? `${anamnesis.weeklyFrequency} dias/semana`
                    : undefined
                }
              />
              <InfoRow label="Duração" value={anamnesis.sessionDuration} />
              <InfoRow label="Local" value={anamnesis.trainingLocation} />
              <InfoRow label="Horário" value={anamnesis.preferredTime} />
              {anamnesis.equipment && anamnesis.equipment.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {anamnesis.equipment.map((eq, i) => (
                    <Badge key={i} variant="pink" className="text-[10px]">
                      {eq}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Nutrition */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <UtensilsCrossed size={14} className="stroke-emerald-400" />
                <span className="font-display text-sm text-white uppercase tracking-wide">
                  Alimentação
                </span>
              </div>
              <InfoRow label="Refeições/dia" value={anamnesis.mealsPerDay} />
              <InfoRow label="Proteína em todas" value={anamnesis.proteinEveryMeal} />
              <InfoRow
                label="Água"
                value={
                  anamnesis.waterLiters
                    ? `${anamnesis.waterLiters}L/dia`
                    : anamnesis.drinksEnoughWater
                }
              />
              <InfoRow label="Suplementos" value={anamnesis.supplements} />
              {anamnesis.dietaryRestrictions &&
                anamnesis.dietaryRestrictions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {anamnesis.dietaryRestrictions.map((r, i) => (
                      <Badge key={i} variant="yellow" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              <InfoRow label="Alergias" value={anamnesis.foodAllergies} />
            </div>

            {/* Health */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Heart size={14} className="stroke-pink" />
                <span className="font-display text-sm text-white uppercase tracking-wide">
                  Saúde
                </span>
              </div>
              <InfoRow label="Lesões" value={anamnesis.injuries} />
              <InfoRow label="Doenças crônicas" value={anamnesis.chronicDiseases} />
              <InfoRow label="Medicações" value={anamnesis.medications} />
              <InfoRow label="Sono" value={anamnesis.sleepQuality} />
              <InfoRow
                label="Horas de sono"
                value={anamnesis.sleepHours}
              />
            </div>

            {/* Lifestyle */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="stroke-blue-400" />
                <span className="font-display text-sm text-white uppercase tracking-wide">
                  Estilo de Vida
                </span>
              </div>
              <InfoRow label="Estresse" value={anamnesis.stressLevel} />
              <InfoRow label="Ocupação" value={anamnesis.occupation} />
            </div>

            {/* Notes */}
            {anamnesis.additionalNotes && (
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-4">
                <p className="font-mono text-[10px] text-gray-3 uppercase tracking-wider mb-2">
                  Observações
                </p>
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                  {anamnesis.additionalNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
