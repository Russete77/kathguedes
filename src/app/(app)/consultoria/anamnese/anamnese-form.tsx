"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  consultationId: string;
}

// Constants
const objectives = [
  "Emagrecer",
  "Ganhar massa muscular",
  "Definição",
  "Saúde e bem-estar",
  "Preparação para competição",
  "Manutenção",
  "Ganhar força",
  "Reabilitação",
];

const trainingLevels = [
  "Nunca treinei",
  "Iniciante < 6 meses",
  "Intermediário 6m-2a",
  "Avançado 2+ anos",
  "Atleta",
];

const trainingFrequencies = ["2-3x", "4-5x", "6x", "Todos os dias"];
const sessionDurations = ["30-45min", "45-60min", "60-90min", "90+ min"];
const trainingLocations = ["Academia", "Casa", "Ar livre", "Hotel/viagem"];
const equipments = [
  "Halteres",
  "Barras",
  "Máquinas",
  "Elásticos",
  "Nenhum",
  "Todos da academia",
];
const preferredTimes = ["Manhã", "Tarde", "Noite", "Flexível"];

const mealFrequencies = ["2-3", "4-5", "6+"];
const proteinOptions = ["Sim", "Não", "Às vezes"];
const waterOptions = ["Sim", "Não", "Às vezes"];
const dietaryRestrictions = [
  "Nenhuma",
  "Vegetariana",
  "Vegana",
  "Sem lactose",
  "Sem glúten",
  "Low carb",
  "Outra",
];

const pregnancyOptions = ["Não", "Grávida", "Amamentando", "Não se aplica"];
const menstrualOptions = ["Sim", "Não", "Não se aplica"];
const sleepQuality = ["Péssima", "Ruim", "Boa", "Ótima"];
const sleepHours = ["<5h", "5-6h", "7-8h", "8+h"];

const stressLevels = ["Baixo", "Moderado", "Alto", "Muito alto"];
const workIntensity = ["Sedentário", "Leve", "Moderado", "Intenso"];
const alcoholFrequency = ["Nunca", "Socialmente", "Frequentemente"];
const smokingOptions = ["Não", "Sim", "Ex-fumante"];

export function AnamneseForm({ consultationId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Dados Pessoais
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [biologicalSex, setBiologicalSex] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [waistCircumference, setWaistCircumference] = useState("");
  const [hipCircumference, setHipCircumference] = useState("");

  // Step 2: Objetivo & Experiência
  const [primaryObjective, setPrimaryObjective] = useState("");
  const [secondaryObjective, setSecondaryObjective] = useState("");
  const [trainingLevel, setTrainingLevel] = useState("");
  const [yearsTraining, setYearsTraining] = useState("");

  // Step 3: Rotina de Treino
  const [frequency, setFrequency] = useState("");
  const [sessionDuration, setSessionDuration] = useState("");
  const [trainingLocation, setTrainingLocation] = useState("");
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState("");

  // Step 4: Hábitos Alimentares
  const [mealFrequency, setMealFrequency] = useState("");
  const [proteinEveryMeal, setProteinEveryMeal] = useState("");
  const [waterIntake, setWaterIntake] = useState("");
  const [waterLiters, setWaterLiters] = useState("");
  const [selectedDietaryRestrictions, setSelectedDietaryRestrictions] = useState<
    string[]
  >([]);
  const [foodAllergies, setFoodAllergies] = useState("");
  const [supplements, setSupplements] = useState("");

  // Step 5: Saúde & Histórico Médico
  const [injuries, setInjuries] = useState("");
  const [chronicDiseases, setChronicDiseases] = useState("");
  const [continuousMedications, setContinuousMedications] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [pregnancyStatus, setPregnancyStatus] = useState("");
  const [menstrualCycle, setMenstrualCycle] = useState("");
  const [sleepQualityLevel, setSleepQualityLevel] = useState("");
  const [sleepHoursPerNight, setSleepHoursPerNight] = useState("");

  // Step 6: Estilo de Vida
  const [stressLevel, setStressLevel] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workActivityLevel, setWorkActivityLevel] = useState("");
  const [otherActivities, setOtherActivities] = useState("");
  const [alcoholConsumption, setAlcoholConsumption] = useState("");
  const [smokeStatus, setSmokeStatus] = useState("");

  // Step 7: Observações
  const [additionalNotes, setAdditionalNotes] = useState("");

  const totalSteps = 7;

  function toggleEquipment(equipment: string) {
    setSelectedEquipments((prev) =>
      prev.includes(equipment)
        ? prev.filter((e) => e !== equipment)
        : [...prev, equipment]
    );
  }

  function toggleDietaryRestriction(restriction: string) {
    setSelectedDietaryRestrictions((prev) =>
      prev.includes(restriction)
        ? prev.filter((r) => r !== restriction)
        : [...prev, restriction]
    );
  }

  function validateStep(currentStep: number): boolean {
    switch (currentStep) {
      case 1:
        return (
          fullName.trim() !== "" &&
          birthDate !== "" &&
          biologicalSex !== "" &&
          weight !== "" &&
          height !== ""
        );
      case 2:
        return (
          primaryObjective !== "" &&
          trainingLevel !== ""
        );
      case 3:
        return (
          frequency !== "" &&
          sessionDuration !== "" &&
          trainingLocation !== "" &&
          selectedEquipments.length > 0 &&
          preferredTime !== ""
        );
      case 4:
        return (
          mealFrequency !== "" &&
          proteinEveryMeal !== "" &&
          waterIntake !== "" &&
          selectedDietaryRestrictions.length > 0
        );
      case 5:
        return (
          injuries !== "" &&
          pregnancyStatus !== "" &&
          menstrualCycle !== "" &&
          sleepQualityLevel !== "" &&
          sleepHoursPerNight !== ""
        );
      case 6:
        return (
          stressLevel !== "" &&
          occupation.trim() !== "" &&
          workActivityLevel !== "" &&
          alcoholConsumption !== "" &&
          smokeStatus !== ""
        );
      case 7:
        return true;
      default:
        return false;
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const anamnesis = {
        // Step 1
        fullName,
        birthDate,
        biologicalSex,
        weight: Number(weight),
        height: Number(height),
        waistCircumference: waistCircumference ? Number(waistCircumference) : null,
        hipCircumference: hipCircumference ? Number(hipCircumference) : null,

        // Step 2
        primaryObjective,
        secondaryObjective: secondaryObjective || null,
        trainingLevel,
        yearsTraining: yearsTraining || null,

        // Step 3
        frequency,
        sessionDuration,
        trainingLocation,
        equipments: selectedEquipments,
        preferredTime,

        // Step 4
        mealFrequency,
        proteinEveryMeal,
        waterIntake,
        waterLiters: waterLiters ? Number(waterLiters) : null,
        dietaryRestrictions: selectedDietaryRestrictions,
        foodAllergies: foodAllergies || null,
        supplements: supplements || null,

        // Step 5
        injuries,
        chronicDiseases: chronicDiseases || null,
        continuousMedications: continuousMedications || null,
        surgeries: surgeries || null,
        pregnancyStatus,
        menstrualCycle,
        sleepQuality: sleepQualityLevel,
        sleepHours: sleepHoursPerNight,

        // Step 6
        stressLevel,
        occupation,
        workActivityLevel,
        otherActivities: otherActivities || null,
        alcoholConsumption,
        smokeStatus,

        // Step 7
        additionalNotes: additionalNotes || null,

        submittedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/consultoria/anamnese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId, anamnesis }),
      });

      if (res.ok) {
        toast.success("Anamnese enviada!", {
          description: "A Kath vai montar seu plano personalizado.",
          style: { borderLeft: "3px solid #00FF88" },
        });
        router.push("/consultoria");
      } else {
        toast.error("Erro ao enviar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all",
              i + 1 <= step ? "bg-pink flex-1" : "bg-gray-4 flex-[0.4]"
            )}
          />
        ))}
      </div>

      {/* Step 1: Dados Pessoais */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Dados Pessoais</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Nome Completo *
            </label>
            <Input
              type="text"
              placeholder="Seu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
                Data de Nascimento *
              </label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
                Sexo Biológico *
              </label>
              <div className="flex gap-2">
                {["Feminino", "Masculino", "Outro"].map((sex) => (
                  <button
                    key={sex}
                    onClick={() => setBiologicalSex(sex)}
                    className={cn(
                      "flex-1 p-2 rounded-[14px] border text-[12px] font-medium transition-all",
                      biologicalSex === sex
                        ? "bg-pink-dim border-pink/40 text-pink"
                        : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                    )}
                  >
                    {sex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
                Peso (kg) *
              </label>
              <Input
                type="number"
                placeholder="65"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
                Altura (cm) *
              </label>
              <Input
                type="number"
                placeholder="165"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
                Cintura (cm)
              </label>
              <Input
                type="number"
                placeholder="70"
                value={waistCircumference}
                onChange={(e) => setWaistCircumference(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Quadril (cm)
            </label>
            <Input
              type="number"
              placeholder="95"
              value={hipCircumference}
              onChange={(e) => setHipCircumference(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              size="lg"
              onClick={() => setStep(2)}
              disabled={!validateStep(1)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Objetivo & Experiência */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Objetivo & Experiência</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Objetivo Principal *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {objectives.map((obj) => (
                <button
                  key={obj}
                  onClick={() => setPrimaryObjective(obj)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium text-left transition-all",
                    primaryObjective === obj
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {obj}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Objetivo Secundário
            </label>
            <div className="grid grid-cols-2 gap-2">
              {objectives.map((obj) => (
                <button
                  key={obj}
                  onClick={() =>
                    setSecondaryObjective(
                      secondaryObjective === obj ? "" : obj
                    )
                  }
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium text-left transition-all",
                    secondaryObjective === obj
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {obj}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Nível de Experiência com Treino *
            </label>
            <div className="space-y-2">
              {trainingLevels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setTrainingLevel(lvl)}
                  className={cn(
                    "w-full p-3 rounded-[14px] border text-[13px] font-medium text-left transition-all",
                    trainingLevel === lvl
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Há quanto tempo treina?
            </label>
            <Input
              type="text"
              placeholder="Ex: 1 ano, 6 meses, nunca treinei"
              value={yearsTraining}
              onChange={(e) => setYearsTraining(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button
              size="lg"
              onClick={() => setStep(3)}
              disabled={!validateStep(2)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Rotina de Treino */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Rotina de Treino</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Quantas vezes por semana pode treinar? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {trainingFrequencies.map((freq) => (
                <button
                  key={freq}
                  onClick={() => setFrequency(freq)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    frequency === freq
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Tempo disponível por sessão? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {sessionDurations.map((duration) => (
                <button
                  key={duration}
                  onClick={() => setSessionDuration(duration)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    sessionDuration === duration
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {duration}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Onde treina? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {trainingLocations.map((location) => (
                <button
                  key={location}
                  onClick={() => setTrainingLocation(location)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    trainingLocation === location
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Equipamentos Disponíveis *
            </label>
            <div className="flex flex-wrap gap-2">
              {equipments.map((equip) => (
                <button
                  key={equip}
                  onClick={() => toggleEquipment(equip)}
                  className={cn(
                    "px-3 py-2 rounded-[14px] border text-[12px] font-medium transition-all",
                    selectedEquipments.includes(equip)
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {equip}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Horário Preferido de Treino *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {preferredTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => setPreferredTime(time)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    preferredTime === time
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStep(2)}
              className="flex-1"
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button
              size="lg"
              onClick={() => setStep(4)}
              disabled={!validateStep(3)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Hábitos Alimentares */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Hábitos Alimentares</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Quantas refeições faz por dia? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {mealFrequencies.map((freq) => (
                <button
                  key={freq}
                  onClick={() => setMealFrequency(freq)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    mealFrequency === freq
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Consome proteína em todas as refeições? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {proteinOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setProteinEveryMeal(option)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    proteinEveryMeal === option
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Bebe água suficiente? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {waterOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setWaterIntake(option)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    waterIntake === option
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Litros de água por dia
            </label>
            <Input
              type="number"
              placeholder="2.5"
              step="0.5"
              value={waterLiters}
              onChange={(e) => setWaterLiters(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Restrição Alimentar *
            </label>
            <div className="flex flex-wrap gap-2">
              {dietaryRestrictions.map((restriction) => (
                <button
                  key={restriction}
                  onClick={() => toggleDietaryRestriction(restriction)}
                  className={cn(
                    "px-3 py-2 rounded-[14px] border text-[12px] font-medium transition-all",
                    selectedDietaryRestrictions.includes(restriction)
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {restriction}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Alergias Alimentares
            </label>
            <textarea
              value={foodAllergies}
              onChange={(e) => setFoodAllergies(e.target.value)}
              placeholder="Ex: Amendoim, frutos do mar..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Suplementos que Usa
            </label>
            <textarea
              value={supplements}
              onChange={(e) => setSupplements(e.target.value)}
              placeholder="Ex: Whey protein, creatina, vitaminas..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStep(3)}
              className="flex-1"
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button
              size="lg"
              onClick={() => setStep(5)}
              disabled={!validateStep(4)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Saúde & Histórico Médico */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Saúde & Histórico Médico</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Lesões ou Limitações Físicas *
            </label>
            <textarea
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              placeholder="Ex: Hérnia de disco, dor no joelho, artrite..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Doenças Crônicas
            </label>
            <textarea
              value={chronicDiseases}
              onChange={(e) => setChronicDiseases(e.target.value)}
              placeholder="Ex: Diabetes, hipertensão, asma..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Medicamentos de Uso Contínuo
            </label>
            <textarea
              value={continuousMedications}
              onChange={(e) => setContinuousMedications(e.target.value)}
              placeholder="Ex: Anticoncepcional, antidepressivos..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Já Fez Cirurgia?
            </label>
            <textarea
              value={surgeries}
              onChange={(e) => setSurgeries(e.target.value)}
              placeholder="Ex: Apendicectomia, cirurgia no joelho..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Status de Gravidez *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {pregnancyOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setPregnancyStatus(option)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    pregnancyStatus === option
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Ciclo Menstrual Regular? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {menstrualOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setMenstrualCycle(option)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    menstrualCycle === option
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Qualidade do Sono *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {sleepQuality.map((quality) => (
                <button
                  key={quality}
                  onClick={() => setSleepQualityLevel(quality)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    sleepQualityLevel === quality
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Horas de Sono por Noite *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {sleepHours.map((hours) => (
                <button
                  key={hours}
                  onClick={() => setSleepHoursPerNight(hours)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    sleepHoursPerNight === hours
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {hours}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStep(4)}
              className="flex-1"
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button
              size="lg"
              onClick={() => setStep(6)}
              disabled={!validateStep(5)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 6: Estilo de Vida */}
      {step === 6 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Estilo de Vida</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Nível de Estresse *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {stressLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => setStressLevel(level)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    stressLevel === level
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Profissão / Ocupação *
            </label>
            <Input
              type="text"
              placeholder="Ex: Analista de sistemas, professor..."
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Nível de Atividade no Trabalho *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {workIntensity.map((intensity) => (
                <button
                  key={intensity}
                  onClick={() => setWorkActivityLevel(intensity)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    workActivityLevel === intensity
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {intensity}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Pratica Outra Atividade Física?
            </label>
            <textarea
              value={otherActivities}
              onChange={(e) => setOtherActivities(e.target.value)}
              placeholder="Ex: Yoga, pilates, corrida, natação..."
              rows={2}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Consome Álcool? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {alcoholFrequency.map((frequency) => (
                <button
                  key={frequency}
                  onClick={() => setAlcoholConsumption(frequency)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    alcoholConsumption === frequency
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {frequency}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-3 block">
              Fuma? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {smokingOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSmokeStatus(opt)}
                  className={cn(
                    "p-3 rounded-[14px] border text-[13px] font-medium transition-all",
                    smokeStatus === opt
                      ? "bg-pink-dim border-pink/40 text-pink"
                      : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStep(5)}
              className="flex-1"
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button
              size="lg"
              onClick={() => setStep(7)}
              disabled={!validateStep(6)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 7: Observações & Confirmação */}
      {step === 7 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Observações & Confirmação</h2>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase mb-2 block">
              Observações Adicionais
            </label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Algo que a Kath deveria saber sobre você..."
              rows={3}
              className="w-full bg-bg-1 border border-gray-4 rounded-[8px] text-white text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
            />
          </div>

          {/* Summary Card */}
          <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 space-y-4">
            <div className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase mb-4">
              Resumo da Anamnese
            </div>

            <div className="space-y-3 border-b border-gray-4 pb-4">
              <div className="text-[12px] font-semibold text-gray-2 uppercase tracking-[0.06em]">
                Dados Pessoais
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <span className="text-gray-2">Nome:</span>
                  <div className="text-gray-1 mt-1">{fullName}</div>
                </div>
                <div>
                  <span className="text-gray-2">Data de Nascimento:</span>
                  <div className="text-gray-1 mt-1">{birthDate}</div>
                </div>
                <div>
                  <span className="text-gray-2">Sexo:</span>
                  <div className="text-gray-1 mt-1">{biologicalSex}</div>
                </div>
                <div>
                  <span className="text-gray-2">Medidas:</span>
                  <div className="text-gray-1 font-mono mt-1">
                    {weight}kg · {height}cm
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-b border-gray-4 pb-4">
              <div className="text-[12px] font-semibold text-gray-2 uppercase tracking-[0.06em]">
                Objetivos
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="pink">{primaryObjective}</Badge>
                {secondaryObjective && (
                  <Badge variant="pink" className="bg-bg-2 border border-gray-4 text-gray-1">
                    {secondaryObjective}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3 border-b border-gray-4 pb-4">
              <div className="text-[12px] font-semibold text-gray-2 uppercase tracking-[0.06em]">
                Experiência & Treino
              </div>
              <div className="space-y-2 text-[13px]">
                <div>
                  <span className="text-gray-2">Nível:</span>
                  <div className="text-gray-1 mt-1">{trainingLevel}</div>
                </div>
                <div>
                  <span className="text-gray-2">Frequência:</span>
                  <div className="text-gray-1 mt-1">{frequency} por semana</div>
                </div>
                <div>
                  <span className="text-gray-2">Duração:</span>
                  <div className="text-gray-1 mt-1">{sessionDuration}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-b border-gray-4 pb-4">
              <div className="text-[12px] font-semibold text-gray-2 uppercase tracking-[0.06em]">
                Hábitos Alimentares
              </div>
              <div className="space-y-2 text-[13px]">
                <div>
                  <span className="text-gray-2">Refeições:</span>
                  <div className="text-gray-1 mt-1">{mealFrequency} por dia</div>
                </div>
                <div>
                  <span className="text-gray-2">Restrições:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedDietaryRestrictions.map((restriction) => (
                      <Badge key={restriction} variant="pink" className="bg-bg-2 border border-gray-4 text-gray-1">
                        {restriction}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[12px] font-semibold text-gray-2 uppercase tracking-[0.06em]">
                Saúde & Bem-estar
              </div>
              <div className="space-y-2 text-[13px]">
                <div>
                  <span className="text-gray-2">Sono:</span>
                  <div className="text-gray-1 mt-1">
                    {sleepQualityLevel} · {sleepHoursPerNight} por noite
                  </div>
                </div>
                <div>
                  <span className="text-gray-2">Estresse:</span>
                  <div className="text-gray-1 mt-1">{stressLevel}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStep(6)}
              className="flex-1"
            >
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {loading ? "Enviando..." : "Enviar Anamnese"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
