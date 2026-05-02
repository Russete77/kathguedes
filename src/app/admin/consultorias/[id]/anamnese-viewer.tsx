"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Anamnesis {
  // Step 1
  fullName: string;
  birthDate: string;
  biologicalSex: string;
  weight: number;
  height: number;
  waistCircumference?: number;
  hipCircumference?: number;
  // Step 2
  primaryObjective: string;
  secondaryObjective?: string;
  trainingLevel: string;
  trainingTime?: string;
  // Step 3
  weeklyFrequency: string;
  sessionDuration: string;
  trainingLocation: string;
  equipment: string[];
  preferredTime: string;
  // Step 4
  mealsPerDay: string;
  proteinEveryMeal: string;
  drinksEnoughWater: string;
  waterLiters?: number;
  dietaryRestrictions: string[];
  foodAllergies?: string;
  supplements?: string;
  // Step 5
  injuries?: string;
  chronicDiseases?: string;
  medications?: string;
  surgeries?: string;
  pregnancyStatus: string;
  menstrualCycle: string;
  sleepQuality: string;
  sleepHours: string;
  // Step 6
  stressLevel: string;
  occupation?: string;
  workActivityLevel: string;
  otherActivities?: string;
  alcoholConsumption: string;
  smoking: string;
  // Step 7
  additionalNotes?: string;
  submittedAt: string;
}

interface AnamneseViewerProps {
  anamnesis: Anamnesis;
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

function calculateBMI(weight: number, height: number): number {
  const heightInMeters = height / 100;
  return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
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

  // Harris-Benedict formula
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

  // Macro distribution
  const proteinPerKg = 1.8;
  const protein = Math.round(weight * proteinPerKg);
  const fatGrams = Math.round(calories * 0.25 / 9);
  const carbGrams = Math.round((calories - protein * 4 - fatGrams * 9) / 4);

  return {
    calories: Math.round(calories),
    protein,
    carbs: Math.max(carbGrams, 0),
    fat: fatGrams,
  };
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-bg-2 transition-colors"
      >
        <h3 className="font-display text-white text-lg">{title}</h3>
        <ChevronDown
          size={20}
          className={cn("text-pink transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-gray-4">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-gray-2 text-sm">{label}</span>
      <span className="text-white font-medium text-right">
        {value === null || value === undefined || value === "" ? (
          <span className="text-gray-3">Não informado</span>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

export function AnamneseViewer({ anamnesis }: AnamneseViewerProps) {
  const age = calculateAge(anamnesis.birthDate);
  const bmi = calculateBMI(anamnesis.weight, anamnesis.height);
  const [showMacros, setShowMacros] = useState(false);

  const activityMultiplier = getActivityMultiplier(
    anamnesis.trainingLevel,
    anamnesis.weeklyFrequency
  );

  const macros = calculateHarrisBenedict(
    anamnesis.weight,
    anamnesis.height,
    age,
    anamnesis.biologicalSex,
    anamnesis.primaryObjective,
    activityMultiplier
  );

  const handleCopyMacros = () => {
    const text = `Calorias: ${macros.calories} | Proteína: ${macros.protein}g | Carbs: ${macros.carbs}g | Gordura: ${macros.fat}g`;
    navigator.clipboard.writeText(text);
    toast.success("Macros copiadas!", {
      style: { borderLeft: "3px solid #00FF88" },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header com resumo rápido */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-3xl text-white">{anamnesis.fullName}</h2>
            <p className="text-gray-2 text-sm mt-1">Anamnese submetida em {new Date(anamnesis.submittedAt).toLocaleDateString('pt-BR')}</p>
          </div>
          <Button
            onClick={() => setShowMacros(!showMacros)}
            className="bg-pink hover:bg-pink-dim text-black"
            size="sm"
          >
            <Zap size={14} />
            Sugestão de Macros
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-6 gap-4">
          <div>
            <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">Idade</p>
            <p className="text-white text-2xl font-bold">{age} anos</p>
          </div>
          <div>
            <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">Sexo</p>
            <p className="text-white text-2xl font-bold">{anamnesis.biologicalSex}</p>
          </div>
          <div>
            <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">Peso</p>
            <p className="text-white text-2xl font-bold">{anamnesis.weight}kg</p>
          </div>
          <div>
            <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">Altura</p>
            <p className="text-white text-2xl font-bold">{anamnesis.height}cm</p>
          </div>
          <div>
            <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">IMC</p>
            <p className={cn("text-2xl font-bold", {
              "text-pink": bmi < 18.5 || bmi > 29.9,
              "text-white": bmi >= 18.5 && bmi <= 29.9,
            })}>{bmi}</p>
          </div>
          <div>
            <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">Objetivo</p>
            <p className="text-white text-lg font-bold">{anamnesis.primaryObjective}</p>
          </div>
        </div>
      </div>

      {/* Macros suggestion overlay */}
      {showMacros && (
        <div className="bg-bg-1 border border-pink rounded-[14px] p-6">
          <div className="space-y-4">
            <div>
              <p className="text-gray-2 text-xs uppercase tracking-[0.06em] font-semibold mb-2">
                Recomendação Calculada (Harris-Benedict)
              </p>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-bg-2 border border-gray-4 rounded-[10px] p-3 text-center">
                  <p className="text-gray-3 text-xs mb-1">Calorias</p>
                  <p className="text-pink text-2xl font-bold">{macros.calories}</p>
                </div>
                <div className="bg-bg-2 border border-gray-4 rounded-[10px] p-3 text-center">
                  <p className="text-gray-3 text-xs mb-1">Proteína</p>
                  <p className="text-pink text-2xl font-bold">{macros.protein}g</p>
                </div>
                <div className="bg-bg-2 border border-gray-4 rounded-[10px] p-3 text-center">
                  <p className="text-gray-3 text-xs mb-1">Carbs</p>
                  <p className="text-pink text-2xl font-bold">{macros.carbs}g</p>
                </div>
                <div className="bg-bg-2 border border-gray-4 rounded-[10px] p-3 text-center">
                  <p className="text-gray-3 text-xs mb-1">Gordura</p>
                  <p className="text-pink text-2xl font-bold">{macros.fat}g</p>
                </div>
              </div>
            </div>
            <Button onClick={handleCopyMacros} variant="ghost" size="sm" className="w-full">
              Copiar valores
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Biometria */}
      <CollapsibleSection title="1. BIOMETRIA" defaultOpen>
        <div className="space-y-3">
          <InfoRow label="Data de Nascimento" value={anamnesis.birthDate} />
          <InfoRow label="Sexo Biológico" value={anamnesis.biologicalSex} />
          <InfoRow label="Peso (kg)" value={anamnesis.weight} />
          <InfoRow label="Altura (cm)" value={anamnesis.height} />
          <InfoRow label="Circunferência da cintura (cm)" value={anamnesis.waistCircumference} />
          <InfoRow label="Circunferência do quadril (cm)" value={anamnesis.hipCircumference} />
        </div>
      </CollapsibleSection>

      {/* Step 2: Objetivos e Experiência */}
      <CollapsibleSection title="2. OBJETIVOS E EXPERIÊNCIA">
        <div className="space-y-3">
          <InfoRow label="Objetivo Principal" value={anamnesis.primaryObjective} />
          <InfoRow label="Objetivo Secundário" value={anamnesis.secondaryObjective} />
          <InfoRow label="Nível de Treino" value={anamnesis.trainingLevel} />
          <InfoRow label="Tempo de Treino" value={anamnesis.trainingTime} />
        </div>
      </CollapsibleSection>

      {/* Step 3: Rotina de Treino */}
      <CollapsibleSection title="3. ROTINA DE TREINO">
        <div className="space-y-3">
          <InfoRow label="Frequência Semanal" value={`${anamnesis.weeklyFrequency} dias`} />
          <InfoRow label="Duração da Sessão" value={anamnesis.sessionDuration} />
          <InfoRow label="Local de Treino" value={anamnesis.trainingLocation} />
          <InfoRow
            label="Equipamentos Disponíveis"
            value={
              anamnesis.equipment && anamnesis.equipment.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-end">
                  {anamnesis.equipment.map((eq, idx) => (
                    <Badge key={idx} variant="pink" className="bg-pink-dim text-pink">
                      {eq}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-gray-3">Não informado</span>
              )
            }
          />
          <InfoRow label="Horário Preferido" value={anamnesis.preferredTime} />
        </div>
      </CollapsibleSection>

      {/* Step 4: Nutrição */}
      <CollapsibleSection title="4. HÁBITOS ALIMENTARES">
        <div className="space-y-3">
          <InfoRow label="Refeições por Dia" value={anamnesis.mealsPerDay} />
          <InfoRow label="Proteína em Todas as Refeições" value={anamnesis.proteinEveryMeal} />
          <InfoRow label="Bebe Água Suficiente" value={anamnesis.drinksEnoughWater} />
          <InfoRow label="Quantidade de Água (litros)" value={anamnesis.waterLiters} />
          <InfoRow
            label="Restrições Alimentares"
            value={
              anamnesis.dietaryRestrictions && anamnesis.dietaryRestrictions.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-end">
                  {anamnesis.dietaryRestrictions.map((rest, idx) => (
                    <Badge key={idx} variant="pink" className="bg-pink-dim text-pink">
                      {rest}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-gray-3">Nenhuma</span>
              )
            }
          />
          <InfoRow label="Alergias Alimentares" value={anamnesis.foodAllergies} />
          <InfoRow label="Suplementos" value={anamnesis.supplements} />
        </div>
      </CollapsibleSection>

      {/* Step 5: Saúde */}
      <CollapsibleSection title="5. HISTÓRICO DE SAÚDE">
        <div className="space-y-3">
          <InfoRow label="Lesões ou Limitações" value={anamnesis.injuries} />
          <InfoRow label="Doenças Crônicas" value={anamnesis.chronicDiseases} />
          <InfoRow label="Medicações" value={anamnesis.medications} />
          <InfoRow label="Cirurgias Anteriores" value={anamnesis.surgeries} />
          <InfoRow label="Status de Gravidez" value={anamnesis.pregnancyStatus} />
          <InfoRow label="Ciclo Menstrual" value={anamnesis.menstrualCycle} />
          <InfoRow label="Qualidade do Sono" value={anamnesis.sleepQuality} />
          <InfoRow label="Horas de Sono" value={anamnesis.sleepHours} />
        </div>
      </CollapsibleSection>

      {/* Step 6: Estilo de Vida */}
      <CollapsibleSection title="6. ESTILO DE VIDA">
        <div className="space-y-3">
          <InfoRow label="Nível de Estresse" value={anamnesis.stressLevel} />
          <InfoRow label="Ocupação" value={anamnesis.occupation} />
          <InfoRow label="Nível de Atividade no Trabalho" value={anamnesis.workActivityLevel} />
          <InfoRow label="Outras Atividades" value={anamnesis.otherActivities} />
          <InfoRow label="Consumo de Álcool" value={anamnesis.alcoholConsumption} />
          <InfoRow label="Tabagismo" value={anamnesis.smoking} />
        </div>
      </CollapsibleSection>

      {/* Step 7: Observações */}
      {anamnesis.additionalNotes && (
        <CollapsibleSection title="7. OBSERVAÇÕES ADICIONAIS">
          <div className="bg-bg-2 border border-gray-4 rounded-[10px] p-4">
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
              {anamnesis.additionalNotes}
            </p>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
