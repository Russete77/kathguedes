import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { workoutPlanSchema, dietPlanSchema } from "@/lib/validations";

/**
 * Geração de RASCUNHO de consultoria por IA (lado admin).
 *
 * A IA NÃO presta a consultoria — ela monta um rascunho de alta qualidade a partir
 * da anamnese, que a Kath revisa/edita antes de entregar. Garantias:
 *  - saída validada por Zod (workoutPlanSchema/dietPlanSchema);
 *  - `youtube_id` só é aceito se existir na biblioteca (anti-alucinação);
 *  - macros calculados por nós (Harris-Benedict), não confiados à IA;
 *  - lesões/sem-equipamento viram FLAGS para revisão humana.
 *
 * Nunca lança para o chamador: retorna { ok, flags, reason } e registra log.
 * Assim o gatilho (envio de anamnese) nunca quebra por causa da IA.
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_DRAFT_MODEL || "gpt-4o-mini";

// Padrão da casa: os dias do treino são nomeados pela ordem da semana.
const WEEKDAYS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

type Anamnesis = Record<string, unknown>;

type LibraryItem = {
  youtube_id: string;
  title: string;
  category: string | null;
  level: string | null;
  split_slot: string | null;
  block: number | null;
  week_in_block: number | null;
  equipment: string[] | null;
};

export type DraftResult = {
  ok: boolean;
  flags: string[];
  reason?: string;
};

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function n(v: unknown): number | null {
  const x = typeof v === "number" ? v : parseFloat(s(v));
  return Number.isFinite(x) ? x : null;
}

/** BMR (Mifflin-St Jeor) + fator de atividade + ajuste por objetivo. */
function computeMacros(a: Anamnesis): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} | null {
  const weight = n(a.weight);
  const height = n(a.height);
  if (!weight || !height) return null;
  const sex = s(a.biologicalSex).toLowerCase();
  // idade a partir de birthDate (YYYY-... ) — fallback 30
  let age = 30;
  const bd = s(a.birthDate);
  const y = bd.match(/(\d{4})/);
  if (y) {
    const yr = parseInt(y[1], 10);
    if (yr > 1900 && yr < new Date().getFullYear()) age = new Date().getFullYear() - yr;
  }
  const isMale = sex.startsWith("m");
  const bmr = 10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161);
  const freq = n(a.weeklyFrequency) ?? 3;
  const activity = freq >= 6 ? 1.725 : freq >= 4 ? 1.55 : freq >= 2 ? 1.375 : 1.2;
  let tdee = bmr * activity;
  const obj = s(a.primaryObjective).toLowerCase();
  if (/emagre|perda|defin|cut|gordura/.test(obj)) tdee -= 400;
  else if (/hipertro|ganho|massa|bulk/.test(obj)) tdee += 300;
  const calories = Math.round(tdee);
  const protein = Math.round(weight * 2); // 2g/kg
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

async function callOpenAI(system: string, user: string): Promise<string | null> {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[consultoria/draft] OpenAI ${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("[consultoria/draft] OpenAI fetch failed:", e);
    return null;
  }
}

export async function runConsultationDraft(
  consultationId: string,
): Promise<DraftResult> {
  const flags: string[] = [];
  const supabase = createAdminSupabaseClient();

  // 1. Consulta + anamnese
  const { data: consultation } = await supabase
    .from("consultations")
    .select("id, status, anamnesis, workout_plan")
    .eq("id", consultationId)
    .single();

  if (!consultation) return { ok: false, reason: "consultation_not_found", flags };
  if (!consultation.anamnesis) return { ok: false, reason: "no_anamnesis", flags };
  // Não sobrescreve um plano já entregue.
  if (consultation.status === "delivered")
    return { ok: false, reason: "already_delivered", flags };

  const a = consultation.anamnesis as Anamnesis;
  const freq = n(a.weeklyFrequency) ?? 3;
  const equipment = Array.isArray(a.equipment) ? (a.equipment as string[]) : [];
  const injuries = s(a.injuries).trim();
  // Respostas negativas ("não", "nenhuma", "sem", "n/a"…) NÃO são lesão — só
  // viram flag quando há de fato algo relatado.
  const NEGATIVE = /^(n[aã]o|nenhum|nada|sem|nunca|n\/a|na|0|ok|tudo|sauda)/i;
  const hasInjuries = injuries.length > 0 && !NEGATIVE.test(injuries);
  const track = s(a.trainingLevel).toLowerCase() || null;

  // 2. Mapa de splits (tabela nova — acesso sem tipo gerado)
  const splitsClient = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          col: string,
          val: number,
        ) => { maybeSingle: () => Promise<{ data: { slots: string[] } | null }> };
      };
    };
  };
  const { data: splitRow } = await splitsClient
    .from("training_splits")
    .select("slots")
    .eq("frequency", freq)
    .maybeSingle();
  const splitSlots: string[] = splitRow?.slots ?? [];

  // 3. Catálogo da biblioteca (publicados). Resiliente: tenta com as colunas de
  //    periodização (migration 52); se elas ainda não existem no banco, a query
  //    daria erro e "esvaziaria" a biblioteca — então cai para um SELECT só com
  //    colunas garantidas. Assim a IA funciona mesmo antes da migration (sem a
  //    fidelidade de bloco), e ganha periodização quando a 52 for aplicada.
  const FULL_COLS =
    "youtube_id, title, category, level, split_slot, block, week_in_block, equipment";
  const SAFE_COLS = "youtube_id, title, category, level, equipment";

  let libRaw: unknown[] | null = null;

  // 3a. Com periodização + filtro por track (se houver e a coluna existir).
  if (track) {
    const r = await supabase
      .from("workout_videos")
      .select(FULL_COLS)
      .eq("is_published", true)
      .eq("track", track)
      .limit(200);
    if (!r.error) libRaw = (r.data as unknown[]) ?? [];
  }

  // 3b. Sem track / vazio → todos publicados. Tenta FULL; se faltar coluna, SAFE.
  if (!libRaw || libRaw.length === 0) {
    const full = await supabase
      .from("workout_videos")
      .select(FULL_COLS)
      .eq("is_published", true)
      .limit(200);
    if (full.error) {
      const safe = await supabase
        .from("workout_videos")
        .select(SAFE_COLS)
        .eq("is_published", true)
        .limit(200);
      libRaw = (safe.data as unknown[]) ?? [];
    } else {
      libRaw = (full.data as unknown[]) ?? [];
    }
  }

  const library = (libRaw ?? []) as LibraryItem[];
  if (library.length === 0) return { ok: false, reason: "empty_library", flags };
  const validIds = new Set(library.map((v) => v.youtube_id));

  // 4. Prompt — macros calculados por nós e enviados como meta pra IA distribuir.
  const targetMacros = computeMacros(a);
  const system = [
    "Você é assistente de uma consultoria fitness brasileira (Kath Guedes).",
    "Monte um RASCUNHO de plano de TREINO e de DIETA personalizado a partir da anamnese.",
    "Responda SOMENTE em JSON válido no formato:",
    '{"weeks":[{"name":"Semana 1","intensity":"leve|moderado|intenso|pico","is_peak_week":false,"days":[{"name":"Segunda — Glúteo","exercises":[{"name":"...","sets":3,"reps":"12","rest":"60s","youtube_id":"<id da biblioteca>"}]}]}],"diet_plan":{"meals":[{"name":"Café da manhã","time":"07:00","foods":[{"name":"Ovos mexidos","quantity":"3 unidades"}]}]}}',
    "Regras de TREINO:",
    "- Use APENAS youtube_id que estejam na lista da biblioteca fornecida.",
    "- Monte um bloco de 6 semanas (weeks 1..6). Os exercícios DEVEM evoluir ao longo das semanas (progressão de volume/intensidade) e podem variar dentro do bloco.",
    "- NOMEIE OS DIAS NA ORDEM DA SEMANA: Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo — um por treino, conforme a frequência. O foco muscular (split_slot) vem DEPOIS do dia, ex.: 'Segunda — Glúteo'. NUNCA use só o grupamento como nome do dia.",
    "- Os dias de cada semana seguem os split_slots fornecidos para a frequência do aluno.",
    "- Respeite lesões e o equipamento disponível: não escolha exercícios incompatíveis.",
    "- 4 a 7 exercícios por dia.",
    "Regras de DIETA (diet_plan.meals):",
    "- Use o número de refeições de alimentacao.refeicoes_por_dia (ex.: '4–5' = 5 refeições). Na dúvida, monte 5. Horários plausíveis (Café da manhã, Lanche, Almoço, Lanche da tarde, Jantar, Ceia).",
    "- Cada refeição tem 2 a 5 alimentos com quantidade em medidas caseiras ou g/ml.",
    "- Some os alimentos para se APROXIMAR das metas_diarias fornecidas (calorias e, sobretudo, proteína). As metas JÁ refletem o objetivo (déficit p/ emagrecimento, superávit p/ hipertrofia).",
    "- OBRIGATÓRIO: NUNCA inclua itens de alimentacao.alergias_intolerancias nem de alimentacao.nao_come_de_jeito_nenhum.",
    "- Respeite alimentacao.dieta_especifica (ex.: vegetariana, vegana, low carb, jejum) na escolha dos alimentos.",
    "- Adapte ao objetivo do aluno (anamnese.objetivo): mais proteína e menos carbo refinado para definição/emagrecimento; mais energia para hipertrofia.",
    "- Comida brasileira, acessível e simples.",
  ].join("\n");

  const user = JSON.stringify({
    anamnese: {
      objetivo: s(a.primaryObjective),
      objetivo_detalhe: s(a.goalsText),
      nivel: s(a.trainingLevel),
      frequencia_semanal: freq,
      duracao_sessao: s(a.sessionDuration),
      local: s(a.trainingLocation),
      equipamento: equipment,
      lesoes: hasInjuries ? injuries : "nenhuma",
      dor_movimento: s(a.painOnMovement),
    },
    metas_diarias: targetMacros
      ? {
          calorias: targetMacros.calories,
          proteina_g: targetMacros.protein,
          carboidrato_g: targetMacros.carbs,
          gordura_g: targetMacros.fat,
        }
      : null,
    alimentacao: {
      dieta_especifica: s((a as Record<string, unknown>).specificDiet),
      alergias_intolerancias: s((a as Record<string, unknown>).foodAllergies),
      nao_come_de_jeito_nenhum: s((a as Record<string, unknown>).foodsDisliked),
      refeicoes_por_dia: s((a as Record<string, unknown>).mealsPerDay),
      suplementos: s((a as Record<string, unknown>).supplements),
    },
    split_slots_da_semana: splitSlots,
    biblioteca: library.map((v) => ({
      youtube_id: v.youtube_id,
      titulo: v.title,
      categoria: v.category,
      nivel: v.level,
      split_slot: v.split_slot,
      week_in_block: v.week_in_block,
      equipamento: v.equipment ?? [],
    })),
  });

  const raw = await callOpenAI(system, user);
  if (!raw) return { ok: false, reason: "ai_unavailable", flags };

  // 5. Parse + validação
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "ai_invalid_json", flags };
  }
  const parsed = workoutPlanSchema.safeParse(parsedJson);
  if (!parsed.success) return { ok: false, reason: "ai_schema_invalid", flags };

  // 6. Saneamento: nomeia os dias pela ordem da semana (padrão da casa) e
  //    remove youtube_id que não existe na biblioteca (anti-alucinação).
  const weekdayName = (dayIndex: number, original: string): string => {
    const weekday = WEEKDAYS[dayIndex] ?? `Dia ${dayIndex + 1}`;
    // remove um eventual prefixo de dia da semana que a IA já tenha colocado,
    // mantendo só o foco muscular como sufixo.
    const focus = (original ?? "")
      .replace(
        /^(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\s*(feira)?\s*[—\-:·]?\s*/i,
        "",
      )
      .trim();
    return focus ? `${weekday} — ${focus}` : weekday;
  };

  let strippedVideos = 0;
  const weeks = parsed.data.weeks.map((w) => ({
    ...w,
    days: w.days.map((d, di) => ({
      ...d,
      name: weekdayName(di, d.name),
      exercises: d.exercises.map((ex) => {
        if (ex.youtube_id && !validIds.has(ex.youtube_id)) {
          strippedVideos++;
          return { ...ex, youtube_id: undefined };
        }
        return ex;
      }),
    })),
  }));
  if (strippedVideos > 0)
    flags.push(`${strippedVideos} exercício(s) sem vídeo válido — revisar/anexar.`);
  if (hasInjuries)
    flags.push(`Aluno relatou lesões ("${injuries.slice(0, 80)}") — revisar contraindicações.`);
  if (splitSlots.length === 0)
    flags.push(`Sem split configurado para ${freq}x/semana — revisar divisão.`);

  // 7. Dieta: macros calculados por nós; refeições propostas pela IA (opcional/best-effort)
  const macros = computeMacros(a);
  let dietPlan: { meals: unknown[] } = { meals: [] };
  // tenta extrair meals se a IA tiver mandado (não obrigatório no schema do treino)
  const maybeMeals = (parsedJson as { diet_plan?: unknown; meals?: unknown });
  const dietCandidate =
    (maybeMeals.diet_plan as unknown) ?? (maybeMeals.meals ? { meals: maybeMeals.meals } : null);
  if (dietCandidate) {
    const dp = dietPlanSchema.safeParse(dietCandidate);
    if (dp.success) dietPlan = dp.data;
  }

  // 8. Grava rascunho (workout_plan/diet_plan/macros) + marca ai_draft.
  //    ai_draft_generated_at/ai_flags são colunas novas (migration 52) — cast.
  const updatePayload: Record<string, unknown> = {
    workout_plan: { weeks },
    diet_plan: dietPlan,
    ai_draft_generated_at: new Date().toISOString(),
    ai_flags: flags,
  };
  if (macros) {
    updatePayload.daily_calories = macros.calories;
    updatePayload.daily_protein = macros.protein;
    updatePayload.daily_carbs = macros.carbs;
    updatePayload.daily_fat = macros.fat;
  }
  const { error } = await supabase
    .from("consultations")
    .update(updatePayload as never)
    .eq("id", consultationId);
  if (error) {
    console.error("[consultoria/draft] update failed:", error.message);
    return { ok: false, reason: "db_update_failed", flags };
  }

  return { ok: true, flags };
}
