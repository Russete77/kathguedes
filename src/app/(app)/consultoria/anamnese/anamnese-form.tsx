"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Loader2, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  consultationId: string;
}

const TOTAL_STEPS = 7;

// ── PAR-Q+ (7 perguntas oficiais) ──
const PARQ_QUESTIONS = [
  "O médico já disse que você tem problema de coração OU pressão alta?",
  "Você sente dor no peito em repouso, nas atividades do dia a dia OU ao praticar atividade física?",
  "Você perde o equilíbrio por tontura OU já ficou inconsciente nos últimos 12 meses?",
  "Você foi diagnosticado com outra condição crônica de saúde (que não seja pressão alta ou doença cardíaca)?",
  "Você está tomando medicamentos prescritos para uma condição crônica de saúde?",
  "Você tem (ou teve nos últimos 12 meses) um problema ósseo, articular ou muscular que poderia piorar ao ficar mais ativo?",
  "O médico já disse que você só deveria fazer atividade física sob supervisão médica?",
];

const OBJECTIVES = [
  "Emagrecimento / Perda de gordura",
  "Hipertrofia / Ganho de massa",
  "Definição / Recomposição corporal",
  "Condicionamento físico / Saúde",
  "Preparação para TAF",
  "Outro",
];
const SEXES = ["Feminino", "Masculino", "Outro"];
const TRAINING_LEVELS = ["Nunca treinei", "Iniciante (< 6 meses)", "Intermediário (6m–2a)", "Avançado (2+ anos)", "Atleta"];
const CURRENT_ACTIVITY = ["Sou sedentário(a)", "Irregular (1–2x/sem)", "Regular (3–6x/sem)"];
const WEEKLY_FREQ = ["2", "3", "4", "5", "6", "7"];
const SESSION_DURATION = ["30–45 min", "45–60 min", "60–90 min", "90+ min"];
const TRAINING_LOCATION = ["Academia completa", "Academia do prédio", "Em casa (peso do corpo)", "Em casa (equipamentos)", "Ar livre / Parque"];
const EQUIPMENT = ["Halteres", "Barras", "Máquinas", "Elásticos", "Anilhas", "Nenhum", "Academia completa"];
const SLEEP_QUALITY = ["Boa", "Razoável", "Ruim"];
const STRESS = ["Baixo", "Moderado", "Alto"];
const MEALS = ["2–3", "4–5", "6+"];
const WATER = ["< 1 litro", "1–2 litros", "2–3 litros", "> 3 litros"];
const ALCOHOL = ["Não", "Raramente", "Fins de semana", "Diariamente"];

const MEASURES: { key: string; label: string }[] = [
  { key: "neck", label: "Pescoço" },
  { key: "shoulders", label: "Ombros" },
  { key: "chest", label: "Tórax" },
  { key: "armRight", label: "Braço D." },
  { key: "armLeft", label: "Braço E." },
  { key: "waistCircumference", label: "Cintura" },
  { key: "abdomen", label: "Abdômen" },
  { key: "hipCircumference", label: "Quadril" },
  { key: "thighRight", label: "Coxa D." },
  { key: "thighLeft", label: "Coxa E." },
  { key: "calfRight", label: "Pant. D." },
  { key: "calfLeft", label: "Pant. E." },
];

export function AnamneseForm({ consultationId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // PAR-Q
  const [parq, setParq] = useState<(boolean | null)[]>(Array(7).fill(null));
  const [declarationParq, setDeclarationParq] = useState(false);
  const [guardianName, setGuardianName] = useState("");

  // Dados & objetivos
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [biologicalSex, setBiologicalSex] = useState("");
  const [occupation, setOccupation] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [primaryObjective, setPrimaryObjective] = useState("");
  const [goalsText, setGoalsText] = useState("");

  // Saúde
  const [chronicDiseases, setChronicDiseases] = useState("");
  const [medications, setMedications] = useState("");
  const [injuries, setInjuries] = useState("");
  const [painOnMovement, setPainOnMovement] = useState("");
  const [surgeries, setSurgeries] = useState("");

  // Rotina & estilo de vida
  const [currentActivity, setCurrentActivity] = useState("");
  const [otherActivities, setOtherActivities] = useState("");
  const [trainingLevel, setTrainingLevel] = useState("");
  const [weeklyFrequency, setWeeklyFrequency] = useState("");
  const [sessionDuration, setSessionDuration] = useState("");
  const [trainingLocation, setTrainingLocation] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [stressLevel, setStressLevel] = useState("");

  // Alimentação
  const [specificDiet, setSpecificDiet] = useState("");
  const [foodAllergies, setFoodAllergies] = useState("");
  const [foodsDisliked, setFoodsDisliked] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState("");
  const [waterIntake, setWaterIntake] = useState("");
  const [alcoholConsumption, setAlcoholConsumption] = useState("");
  const [supplements, setSupplements] = useState("");
  const [ergogenicUse, setErgogenicUse] = useState("");

  // Medidas
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [measures, setMeasures] = useState<Record<string, string>>({});

  // Observações + declaração final
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [declarationTruth, setDeclarationTruth] = useState(false);

  const parqAnyYes = parq.some((p) => p === true);
  const parqAllAnswered = parq.every((p) => p !== null);

  function toggleEquip(v: string) {
    setEquipment((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }
  function setMeasure(k: string, v: string) {
    setMeasures((m) => ({ ...m, [k]: v }));
  }

  function valid(s: number): boolean {
    switch (s) {
      case 1: return parqAllAnswered && declarationParq;
      case 2: return fullName.trim() !== "" && birthDate !== "" && biologicalSex !== "" && primaryObjective !== "";
      case 3: return true;
      case 4: return trainingLevel !== "" && weeklyFrequency !== "" && sessionDuration !== "" && trainingLocation !== "";
      case 5: return mealsPerDay !== "" && waterIntake !== "";
      case 6: return weight !== "" && height !== "";
      case 7: return declarationTruth;
      default: return false;
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      const measureNums: Record<string, number | null> = {};
      for (const m of MEASURES) measureNums[m.key] = num(measures[m.key] ?? "");

      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);

      const anamnesis = {
        // PAR-Q+
        parq: {
          answers: parq,
          anyYes: parqAnyYes,
          cleared: parqAllAnswered && !parqAnyYes,
          declarationAccepted: declarationParq,
          guardianName: guardianName.trim() || null,
          validUntil: validUntil.toISOString(),
        },
        // Dados & objetivos
        fullName,
        birthDate,
        biologicalSex,
        occupation: occupation || null,
        email: email || null,
        whatsapp: whatsapp || null,
        primaryObjective,
        goalsText: goalsText || null,
        // Saúde
        chronicDiseases: chronicDiseases || null,
        medications: medications || null,
        injuries: injuries || null,
        painOnMovement: painOnMovement || null,
        surgeries: surgeries || null,
        // Rotina & estilo de vida
        currentActivity: currentActivity || null,
        otherActivities: otherActivities || null,
        trainingLevel,
        weeklyFrequency,
        sessionDuration,
        trainingLocation,
        equipment,
        sleepHours: sleepHours || null,
        sleepQuality: sleepQuality || null,
        stressLevel: stressLevel || null,
        // Alimentação
        specificDiet: specificDiet || null,
        foodAllergies: foodAllergies || null,
        foodsDisliked: foodsDisliked || null,
        mealsPerDay,
        waterIntake,
        alcoholConsumption: alcoholConsumption || null,
        supplements: supplements || null,
        ergogenicUse: ergogenicUse || null,
        // Medidas
        weight: num(weight),
        height: num(height),
        ...measureNums,
        // Observações
        additionalNotes: additionalNotes || null,
        truthDeclarationAccepted: declarationTruth,
        submittedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/consultoria/anamnese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId, anamnesis }),
      });
      if (res.ok) {
        toast.success("Ficha enviada!", {
          description: "A Kath e o Sidney vão montar seu plano personalizado.",
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
      {/* Indicador de passos */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn("h-1 rounded-full transition-all", i + 1 <= step ? "bg-pink flex-1" : "bg-gray-4 flex-[0.4]")}
          />
        ))}
      </div>

      {step === 1 && (
        <Section title="Prontidão para atividade física (PAR-Q+)" desc="Responda com sinceridade. Leva 1 minuto e é essencial para a sua segurança.">
          <div className="space-y-3">
            {PARQ_QUESTIONS.map((q, i) => (
              <div key={i} className="bg-bg-1 border border-gray-4 rounded-[14px] p-4">
                <p className="text-[13px] text-gray-1 mb-3 leading-relaxed">
                  <span className="text-pink font-bold mr-1">{i + 1}.</span>
                  {q}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ l: "Não", v: false }, { l: "Sim", v: true }].map((opt) => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => setParq((p) => p.map((x, idx) => (idx === i ? opt.v : x)))}
                      className={cn(
                        "p-2.5 rounded-[12px] border text-[13px] font-semibold transition-all",
                        parq[i] === opt.v
                          ? opt.v
                            ? "bg-yellow/15 border-yellow/50 text-yellow"
                            : "bg-pink-dim border-pink/40 text-pink"
                          : "bg-bg-2 border-gray-4 text-gray-2 hover:border-gray-3",
                      )}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {parqAllAnswered && (
            <div
              className={cn(
                "rounded-[14px] p-4 flex items-start gap-3 border",
                parqAnyYes ? "bg-yellow/10 border-yellow/30" : "bg-success/10 border-success/30",
              )}
            >
              {parqAnyYes ? (
                <AlertTriangle size={20} className="text-yellow shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck size={20} className="text-success shrink-0 mt-0.5" />
              )}
              <p className="text-[13px] text-gray-1 leading-relaxed">
                {parqAnyYes
                  ? "Você respondeu SIM a uma ou mais perguntas. Recomendamos procurar um médico antes de iniciar ou aumentar a intensidade dos treinos. Você pode continuar o cadastro, mas informe isso à Kath e ao Sidney."
                  : "Tudo certo! Você está liberado(a) para iniciar a atividade física. Comece devagar e aumente o ritmo aos poucos."}
              </p>
            </div>
          )}

          <Text label="Nome do responsável (apenas se você for menor de idade)" value={guardianName} onChange={setGuardianName} placeholder="Opcional" />

          <label className="flex items-start gap-3 cursor-pointer bg-bg-1 border border-gray-4 rounded-[14px] p-4">
            <input
              type="checkbox"
              checked={declarationParq}
              onChange={(e) => setDeclarationParq(e.target.checked)}
              className="accent-pink mt-0.5 w-4 h-4 shrink-0"
            />
            <span className="text-[12.5px] text-gray-2 leading-relaxed">
              Li, compreendi e preenchi este questionário. Reconheço que esta liberação é válida por
              até 12 meses e perde validade se minha condição de saúde mudar. Estou ciente de que a
              prática de exercícios envolve riscos e isento a consultoria de responsabilidade por
              lesões decorrentes da omissão de informações de saúde ou execução inadequada.
            </span>
          </label>
        </Section>
      )}

      {step === 2 && (
        <Section title="Dados pessoais e objetivos">
          <Text label="Nome completo *" value={fullName} onChange={setFullName} placeholder="Seu nome completo" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data de nascimento *">
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Sexo biológico *">
              <Pills options={SEXES} value={biologicalSex} onChange={setBiologicalSex} cols="grid-cols-3" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Text label="Profissão" value={occupation} onChange={setOccupation} placeholder="Ex: professora" />
            <Text label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="(00) 00000-0000" />
          </div>
          <Text label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" />
          <Field label="Objetivo principal *">
            <Pills options={OBJECTIVES} value={primaryObjective} onChange={setPrimaryObjective} cols="grid-cols-1 sm:grid-cols-2" />
          </Field>
          <Area label="O que você espera alcançar (curto e longo prazo)?" value={goalsText} onChange={setGoalsText} />
        </Section>
      )}

      {step === 3 && (
        <Section title="Histórico de saúde e lesões">
          <Area label="Doença crônica diagnosticada? Qual?" value={chronicDiseases} onChange={setChronicDiseases} placeholder="Ex: diabetes, hipertensão, hipotireoidismo... ou 'Não'" />
          <Area label="Medicamento de uso contínuo? Qual e dosagem?" value={medications} onChange={setMedications} placeholder="Ou 'Não'" />
          <Area label="Lesão atual ou passada (local e gravidade)?" value={injuries} onChange={setInjuries} placeholder="Articulações, coluna, músculos, tendões... ou 'Não'" />
          <Area label="Sente dor em algum movimento específico? Qual?" value={painOnMovement} onChange={setPainOnMovement} placeholder="Ou 'Não'" />
          <Area label="Já fez alguma cirurgia? Qual e quando?" value={surgeries} onChange={setSurgeries} placeholder="Ou 'Não'" />
        </Section>
      )}

      {step === 4 && (
        <Section title="Rotina de treino e estilo de vida">
          <Field label="Você pratica atividade física atualmente?">
            <Pills options={CURRENT_ACTIVITY} value={currentActivity} onChange={setCurrentActivity} cols="grid-cols-1" />
          </Field>
          <Area label="Se sim, quais atividades e há quanto tempo?" value={otherActivities} onChange={setOtherActivities} rows={2} />
          <Field label="Nível de experiência com treino *">
            <Pills options={TRAINING_LEVELS} value={trainingLevel} onChange={setTrainingLevel} cols="grid-cols-1 sm:grid-cols-2" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Dias por semana disponíveis *">
              <Pills options={WEEKLY_FREQ} value={weeklyFrequency} onChange={setWeeklyFrequency} cols="grid-cols-3 sm:grid-cols-6" />
            </Field>
            <Field label="Tempo por sessão *">
              <Pills options={SESSION_DURATION} value={sessionDuration} onChange={setSessionDuration} cols="grid-cols-2" />
            </Field>
          </div>
          <Field label="Onde você treina? *">
            <Pills options={TRAINING_LOCATION} value={trainingLocation} onChange={setTrainingLocation} cols="grid-cols-1 sm:grid-cols-2" />
          </Field>
          <Field label="Equipamentos disponíveis">
            <MultiPills options={EQUIPMENT} value={equipment} onToggle={toggleEquip} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Horas de sono / noite">
              <input type="number" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="7" className={inputCls} />
            </Field>
            <Field label="Qualidade do sono">
              <Pills options={SLEEP_QUALITY} value={sleepQuality} onChange={setSleepQuality} cols="grid-cols-3" />
            </Field>
            <Field label="Nível de estresse">
              <Pills options={STRESS} value={stressLevel} onChange={setStressLevel} cols="grid-cols-3" />
            </Field>
          </div>
        </Section>
      )}

      {step === 5 && (
        <Section title="Hábitos alimentares e suplementação">
          <Area label="Segue alguma dieta específica? Qual?" value={specificDiet} onChange={setSpecificDiet} placeholder="Vegetariana, vegana, low carb, jejum... ou 'Não'" rows={2} />
          <Area label="Alergia ou intolerância alimentar?" value={foodAllergies} onChange={setFoodAllergies} placeholder="Lactose, glúten, frutos do mar... ou 'Não'" rows={2} />
          <Area label="Alimentos que você NÃO come de jeito nenhum" value={foodsDisliked} onChange={setFoodsDisliked} rows={2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Refeições por dia *">
              <Pills options={MEALS} value={mealsPerDay} onChange={setMealsPerDay} cols="grid-cols-3" />
            </Field>
            <Field label="Consumo de água *">
              <Pills options={WATER} value={waterIntake} onChange={setWaterIntake} cols="grid-cols-2" />
            </Field>
          </div>
          <Field label="Consome bebida alcoólica?">
            <Pills options={ALCOHOL} value={alcoholConsumption} onChange={setAlcoholConsumption} cols="grid-cols-2 sm:grid-cols-4" />
          </Field>
          <Area label="Suplementos que usa atualmente" value={supplements} onChange={setSupplements} placeholder="Whey, creatina, pré-treino, vitaminas... ou 'Não'" rows={2} />
          <Area label="Uso de recursos ergogênicos hormonais (esteroides)? Quais e quando?" value={ergogenicUse} onChange={setErgogenicUse} placeholder="Ou 'Não'" rows={2} />
        </Section>
      )}

      {step === 6 && (
        <Section title="Medidas antropométricas" desc="Caso não saiba tirar alguma medida, deixe em branco e envie fotos depois.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (kg) *">
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="65" className={inputCls} />
            </Field>
            <Field label="Altura (cm) *">
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="165" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MEASURES.map((m) => (
              <Field key={m.key} label={`${m.label} (cm)`}>
                <input
                  type="number"
                  value={measures[m.key] ?? ""}
                  onChange={(e) => setMeasure(m.key, e.target.value)}
                  className={inputCls}
                />
              </Field>
            ))}
          </div>
        </Section>
      )}

      {step === 7 && (
        <Section title="Observações e confirmação">
          <Area label="Algo mais que a Kath e o Sidney devem saber?" value={additionalNotes} onChange={setAdditionalNotes} rows={3} placeholder="Preferências, dificuldades, rotina de trabalho em turnos..." />
          <label className="flex items-start gap-3 cursor-pointer bg-bg-1 border border-gray-4 rounded-[14px] p-4">
            <input type="checkbox" checked={declarationTruth} onChange={(e) => setDeclarationTruth(e.target.checked)} className="accent-pink mt-0.5 w-4 h-4 shrink-0" />
            <span className="text-[12.5px] text-gray-2 leading-relaxed">
              Declaro que todas as informações prestadas são verdadeiras e assumo a responsabilidade
              por elas.
            </span>
          </label>
        </Section>
      )}

      {/* Navegação */}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <Button variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)} className="flex-1">
            <ArrowLeft size={16} /> Voltar
          </Button>
        )}
        {step < TOTAL_STEPS ? (
          <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!valid(step)} className="flex-1">
            Continuar <ArrowRight size={16} />
          </Button>
        ) : (
          <Button size="lg" onClick={handleSubmit} disabled={loading || !valid(7)} className="flex-1">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {loading ? "Enviando..." : "Enviar ficha"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Helpers de UI ── */
const inputCls =
  "w-full bg-bg-2 border border-gray-4 rounded-[10px] text-white text-[14px] px-3 py-2.5 outline-none focus:border-pink";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {desc && <p className="text-[13px] text-gray-3 mt-1 leading-relaxed">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-gray-2 tracking-[0.04em] uppercase mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Text({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </Field>
  );
}

function Area({ label, value, onChange, placeholder, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <Field label={label}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={cn(inputCls, "resize-none")} />
    </Field>
  );
}

function Pills({ options, value, onChange, cols }: { options: string[]; value: string; onChange: (v: string) => void; cols: string }) {
  return (
    <div className={cn("grid gap-2", cols)}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "p-2.5 rounded-[12px] border text-[12.5px] font-medium text-center transition-all",
            value === o ? "bg-pink-dim border-pink/40 text-pink" : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function MultiPills({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={cn(
            "px-3 py-2 rounded-[12px] border text-[12.5px] font-medium transition-all",
            value.includes(o) ? "bg-pink-dim border-pink/40 text-pink" : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
