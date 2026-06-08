"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Zap, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Parq {
  answers?: (boolean | null)[];
  anyYes?: boolean;
  cleared?: boolean;
  declarationAccepted?: boolean;
  guardianName?: string | null;
  validUntil?: string;
}

interface Anamnesis {
  parq?: Parq;
  fullName: string;
  birthDate: string;
  biologicalSex: string;
  occupation?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  primaryObjective: string;
  goalsText?: string | null;
  chronicDiseases?: string | null;
  medications?: string | null;
  injuries?: string | null;
  painOnMovement?: string | null;
  surgeries?: string | null;
  currentActivity?: string | null;
  otherActivities?: string | null;
  trainingLevel: string;
  weeklyFrequency: string;
  sessionDuration?: string | null;
  trainingLocation?: string | null;
  equipment?: string[];
  sleepHours?: string | null;
  sleepQuality?: string | null;
  stressLevel?: string | null;
  specificDiet?: string | null;
  foodAllergies?: string | null;
  foodsDisliked?: string | null;
  mealsPerDay?: string | null;
  waterIntake?: string | null;
  alcoholConsumption?: string | null;
  supplements?: string | null;
  ergogenicUse?: string | null;
  weight: number;
  height: number;
  neck?: number | null;
  shoulders?: number | null;
  chest?: number | null;
  armRight?: number | null;
  armLeft?: number | null;
  waistCircumference?: number | null;
  abdomen?: number | null;
  hipCircumference?: number | null;
  thighRight?: number | null;
  thighLeft?: number | null;
  calfRight?: number | null;
  calfLeft?: number | null;
  additionalNotes?: string | null;
  submittedAt: string;
}

interface AnamneseViewerProps {
  anamnesis: Anamnesis;
}

const PARQ_LABELS = [
  "Problema de coração ou pressão alta",
  "Dor no peito (repouso ou atividade)",
  "Tontura / perda de consciência (12 meses)",
  "Outra condição crônica diagnosticada",
  "Medicamento para condição crônica",
  "Problema ósseo / articular / muscular",
  "Só treinar sob supervisão médica",
];

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calculateBMI(weight: number, height: number): number {
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

function getActivityMultiplier(trainingLevel: string, weeklyFrequency: string): number {
  const freq = parseInt(weeklyFrequency) || 0;
  if (freq >= 6) return 1.9;
  if (freq >= 4) return 1.725;
  if (freq === 3) return 1.55;
  if (freq >= 1) return 1.375;
  void trainingLevel;
  return 1.2;
}

function calculateHarrisBenedict(
  weight: number,
  height: number,
  age: number,
  sex: string,
  objective: string,
  activityMultiplier: number,
): { calories: number; protein: number; carbs: number; fat: number } {
  let bmr = 0;
  if (sex === "Feminino") bmr = 655 + 9.6 * weight + 1.8 * height - 4.87 * age;
  else bmr = 88 + 13.4 * weight + 4.8 * height - 5.68 * age;
  const tdee = Math.round(bmr * activityMultiplier);
  let calories = tdee;
  const obj = objective.toLowerCase();
  if (obj.includes("hipertrofia") || obj.includes("massa")) calories = Math.round(tdee * 1.1);
  else if (obj.includes("emagre") || obj.includes("gordura")) calories = Math.round(tdee * 0.85);
  const protein = Math.round(weight * 1.8);
  const fatGrams = Math.round((calories * 0.25) / 9);
  const carbGrams = Math.round((calories - protein * 4 - fatGrams * 9) / 4);
  return { calories: Math.round(calories), protein, carbs: Math.max(carbGrams, 0), fat: fatGrams };
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
        <h3 className="font-display text-white text-base sm:text-lg text-left">{title}</h3>
        <ChevronDown size={20} className={cn("text-pink transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-gray-4 pt-3">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-2 text-sm shrink-0">{label}</span>
      <span className="text-white font-medium text-right text-sm break-words">
        {empty ? <span className="text-gray-3">Não informado</span> : value}
      </span>
    </div>
  );
}

export function AnamneseViewer({ anamnesis }: AnamneseViewerProps) {
  const age = calculateAge(anamnesis.birthDate);
  const bmi = calculateBMI(anamnesis.weight, anamnesis.height);
  const [showMacros, setShowMacros] = useState(false);

  const macros = calculateHarrisBenedict(
    anamnesis.weight,
    anamnesis.height,
    age,
    anamnesis.biologicalSex,
    anamnesis.primaryObjective,
    getActivityMultiplier(anamnesis.trainingLevel, anamnesis.weeklyFrequency),
  );

  const parq = anamnesis.parq;
  const flagged = (parq?.answers ?? [])
    .map((a, i) => (a === true ? i : -1))
    .filter((i) => i >= 0);

  const measures: { label: string; v?: number | null }[] = [
    { label: "Pescoço", v: anamnesis.neck },
    { label: "Ombros", v: anamnesis.shoulders },
    { label: "Tórax", v: anamnesis.chest },
    { label: "Braço D.", v: anamnesis.armRight },
    { label: "Braço E.", v: anamnesis.armLeft },
    { label: "Cintura", v: anamnesis.waistCircumference },
    { label: "Abdômen", v: anamnesis.abdomen },
    { label: "Quadril", v: anamnesis.hipCircumference },
    { label: "Coxa D.", v: anamnesis.thighRight },
    { label: "Coxa E.", v: anamnesis.thighLeft },
    { label: "Pant. D.", v: anamnesis.calfRight },
    { label: "Pant. E.", v: anamnesis.calfLeft },
  ];

  const handleCopyMacros = () => {
    navigator.clipboard.writeText(
      `Calorias: ${macros.calories} | Proteína: ${macros.protein}g | Carbs: ${macros.carbs}g | Gordura: ${macros.fat}g`,
    );
    toast.success("Macros copiadas!", { style: { borderLeft: "3px solid #00FF88" } });
  };

  return (
    <div className="space-y-4">
      {/* Header + quick stats */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl text-white">{anamnesis.fullName}</h2>
            <p className="text-gray-2 text-sm mt-1">
              Ficha enviada em {new Date(anamnesis.submittedAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <Button onClick={() => setShowMacros(!showMacros)} className="bg-pink hover:bg-pink-dim text-black self-start" size="sm">
            <Zap size={14} /> Sugestão de Macros
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Stat label="Idade" value={`${age} anos`} />
          <Stat label="Sexo" value={anamnesis.biologicalSex} />
          <Stat label="Peso" value={`${anamnesis.weight}kg`} />
          <Stat label="Altura" value={`${anamnesis.height}cm`} />
          <Stat label="IMC" value={String(bmi)} highlight={bmi < 18.5 || bmi > 29.9} />
          <Stat label="Objetivo" value={anamnesis.primaryObjective} small />
        </div>
      </div>

      {/* PAR-Q+ banner (segurança) */}
      {parq && (
        <div
          className={cn(
            "rounded-[14px] p-4 border",
            parq.anyYes ? "bg-yellow/10 border-yellow/40" : "bg-success/10 border-success/40",
          )}
        >
          <div className="flex items-start gap-3">
            {parq.anyYes ? (
              <AlertTriangle size={20} className="text-yellow shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck size={20} className="text-success shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className={cn("font-display text-base", parq.anyYes ? "text-yellow" : "text-success")}>
                PAR-Q+ {parq.anyYes ? "— ATENÇÃO MÉDICA RECOMENDADA" : "— LIBERADO"}
              </p>
              {parq.anyYes ? (
                <ul className="text-gray-1 text-sm mt-2 list-disc pl-4 space-y-1">
                  {flagged.map((i) => (
                    <li key={i}>{PARQ_LABELS[i]}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-2 text-sm mt-1">Respondeu &quot;Não&quot; a todas as perguntas.</p>
              )}
              <p className="text-gray-3 text-xs mt-2">
                {parq.validUntil ? `Válido até ${new Date(parq.validUntil).toLocaleDateString("pt-BR")}` : null}
                {parq.guardianName ? ` · Responsável: ${parq.guardianName}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Macros */}
      {showMacros && (
        <div className="bg-bg-1 border border-pink rounded-[14px] p-4 sm:p-6 space-y-4">
          <p className="text-gray-2 text-xs uppercase tracking-[0.06em] font-semibold">
            Recomendação calculada (Harris-Benedict)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Calorias", macros.calories],
              ["Proteína", `${macros.protein}g`],
              ["Carbs", `${macros.carbs}g`],
              ["Gordura", `${macros.fat}g`],
            ].map(([l, v]) => (
              <div key={l as string} className="bg-bg-2 border border-gray-4 rounded-[10px] p-3 text-center">
                <p className="text-gray-3 text-xs mb-1">{l}</p>
                <p className="text-pink text-2xl font-bold">{v}</p>
              </div>
            ))}
          </div>
          <Button onClick={handleCopyMacros} variant="ghost" size="sm" className="w-full">
            Copiar valores
          </Button>
        </div>
      )}

      <CollapsibleSection title="Contato e objetivos" defaultOpen>
        <InfoRow label="Profissão" value={anamnesis.occupation} />
        <InfoRow label="E-mail" value={anamnesis.email} />
        <InfoRow label="WhatsApp" value={anamnesis.whatsapp} />
        <InfoRow label="Objetivo principal" value={anamnesis.primaryObjective} />
        {anamnesis.goalsText && <Para label="Metas" value={anamnesis.goalsText} />}
      </CollapsibleSection>

      <CollapsibleSection title="Saúde e lesões">
        <Para label="Doenças crônicas" value={anamnesis.chronicDiseases} />
        <Para label="Medicamentos contínuos" value={anamnesis.medications} />
        <Para label="Lesões" value={anamnesis.injuries} />
        <Para label="Dor em movimento" value={anamnesis.painOnMovement} />
        <Para label="Cirurgias" value={anamnesis.surgeries} />
      </CollapsibleSection>

      <CollapsibleSection title="Rotina de treino e estilo de vida">
        <InfoRow label="Atividade atual" value={anamnesis.currentActivity} />
        <InfoRow label="Outras atividades" value={anamnesis.otherActivities} />
        <InfoRow label="Nível" value={anamnesis.trainingLevel} />
        <InfoRow label="Dias/semana" value={anamnesis.weeklyFrequency} />
        <InfoRow label="Duração/sessão" value={anamnesis.sessionDuration} />
        <InfoRow label="Onde treina" value={anamnesis.trainingLocation} />
        <InfoRow label="Equipamentos" value={anamnesis.equipment?.length ? anamnesis.equipment.join(", ") : ""} />
        <InfoRow label="Sono" value={[anamnesis.sleepHours ? `${anamnesis.sleepHours}h` : null, anamnesis.sleepQuality].filter(Boolean).join(" · ")} />
        <InfoRow label="Estresse" value={anamnesis.stressLevel} />
      </CollapsibleSection>

      <CollapsibleSection title="Alimentação e suplementação">
        <Para label="Dieta específica" value={anamnesis.specificDiet} />
        <Para label="Alergias/intolerâncias" value={anamnesis.foodAllergies} />
        <Para label="Não come" value={anamnesis.foodsDisliked} />
        <InfoRow label="Refeições/dia" value={anamnesis.mealsPerDay} />
        <InfoRow label="Água" value={anamnesis.waterIntake} />
        <InfoRow label="Álcool" value={anamnesis.alcoholConsumption} />
        <Para label="Suplementos" value={anamnesis.supplements} />
        <Para label="Recursos ergogênicos (esteroides)" value={anamnesis.ergogenicUse} />
      </CollapsibleSection>

      <CollapsibleSection title="Medidas antropométricas">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {measures.map((m) => (
            <div key={m.label} className="bg-bg-2 border border-gray-4 rounded-[10px] p-2.5 text-center">
              <p className="text-gray-3 text-[11px] mb-0.5">{m.label}</p>
              <p className="text-white text-sm font-semibold">
                {m.v != null ? `${m.v} cm` : <span className="text-gray-3">—</span>}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {anamnesis.additionalNotes && (
        <CollapsibleSection title="Observações do aluno">
          <p className="text-gray-1 text-sm leading-relaxed whitespace-pre-wrap">{anamnesis.additionalNotes}</p>
        </CollapsibleSection>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div>
      <p className="text-gray-3 text-xs uppercase tracking-[0.06em] font-semibold mb-1">{label}</p>
      <p className={cn("font-bold", small ? "text-base sm:text-lg" : "text-xl sm:text-2xl", highlight ? "text-pink" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function Para({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-gray-2 text-sm mb-0.5">{label}</p>
      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
        {value ? value : <span className="text-gray-3">Não informado</span>}
      </p>
    </div>
  );
}
