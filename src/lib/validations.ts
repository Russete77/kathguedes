import { z } from "zod";
import { WORKOUT_CATEGORY_VALUES } from "@/constants/categories";
import { normalizeImageUrl } from "@/lib/images";

// ── Plan Tiers ──
export const planTierSchema = z.enum(["start", "evolucao", "saude_completa", "atleta"]);

// ── Workouts ──
export const createWorkoutSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  youtube_id: z.string().min(1, "YouTube ID obrigatório").max(500),
  category: z.enum(WORKOUT_CATEGORY_VALUES),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  duration_minutes: z.coerce.number().int().min(1).max(300),
  required_plan: planTierSchema.default("start"),
  is_published: z.coerce.boolean().default(false),
  is_short: z.coerce.boolean().default(false),
  // Quando true, libera pro visitante sem subscription (freemium).
  // Default false — admin marca explicitamente os "carros-chefe" da Kath.
  is_free_preview: z.coerce.boolean().default(false),
  notes: z.string().max(2000).nullable().optional(),
  // Thumbnail custom (opcional) — se vazia, o card cai na thumb do YouTube.
  thumbnail_url: z.string().max(500).nullable().optional(),
  // Periodização (consultoria IA / blocos de 6 semanas) — todos opcionais.
  // preprocess: campo vazio do form ("") vira undefined (em vez de coerce→0).
  block: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(99).optional(),
  ),
  week_in_block: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(6).optional(),
  ),
  split_slot: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(60).optional(),
  ),
  track: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(60).optional(),
  ),
});

// ── Workout/Diet plan (estrutura do JSONB — valida saída da IA antes de gravar) ──
export const planExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  sets: z.coerce.number().int().min(1).max(20),
  reps: z.string().min(1).max(40),
  rest: z.string().max(40).optional().default("60s"),
  notes: z.string().max(500).optional(),
  youtube_id: z.string().max(60).optional(),
  exercise_id: z.string().max(60).optional(),
});
export const planDaySchema = z.object({
  name: z.string().min(1).max(60),
  exercises: z.array(planExerciseSchema).max(20),
});
export const planWeekSchema = z.object({
  name: z.string().min(1).max(60),
  intensity: z.enum(["leve", "moderado", "intenso", "pico"]).optional(),
  is_peak_week: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  days: z.array(planDaySchema).max(7),
});
export const workoutPlanSchema = z.object({
  weeks: z.array(planWeekSchema).min(1).max(12),
});
export const dietFoodSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.string().max(60).optional().default(""),
  calories: z.coerce.number().int().min(0).optional(),
  protein: z.coerce.number().int().min(0).optional(),
  carbs: z.coerce.number().int().min(0).optional(),
  fat: z.coerce.number().int().min(0).optional(),
});
export const dietMealSchema = z.object({
  name: z.string().min(1).max(80),
  time: z.string().max(20).optional().default(""),
  foods: z.array(dietFoodSchema).max(20),
});
export const dietPlanSchema = z.object({
  meals: z.array(dietMealSchema).max(12),
});

// ── Coupons ──
export const createCouponSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  code: z.string().min(1, "Código obrigatório").max(50).transform(v => v.toUpperCase()),
  discount_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  partner_name: z.string().min(1, "Parceiro obrigatório").max(200),
  partner_url: z.string().url("URL inválida"),
  module: z.enum(["fitness", "geral"]),
  required_plan: planTierSchema.default("start"),
  max_uses: z.coerce.number().int().min(0).nullable().optional(),
  valid_until: z.string().min(1, "Data de validade obrigatória"),
  is_flash: z.coerce.boolean().default(false),
});

// ── Affiliates ──
export const createAffiliateSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url("URL da imagem inválida").transform(normalizeImageUrl),
  module: z.enum(["fitness"]),
  category: z.string().min(1, "Categoria obrigatória").max(100),
  platform: z.enum(["amazon", "mercadolivre", "shopee", "direto"]),
  affiliate_url: z.string().url("URL do afiliado inválida"),
  required_plan: planTierSchema.default("start"),
});

// ── Products ──
export const createProductSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url("URL da imagem inválida").transform(normalizeImageUrl),
  price_cents: z.coerce.number().int().min(1, "Preço em centavos deve ser maior que zero"),
  cost_cents: z.coerce.number().int().min(0).default(0),
  compare_price: z.coerce.number().int().min(0).nullable().optional(),
  category: z.string().min(1, "Categoria obrigatória").max(100),
  module: z.enum(["fitness", "geral"]).default("geral"),
  stock: z.coerce.number().int().min(0).default(0),
  // Peso e dimensões para cálculo de frete
  weight_kg: z.coerce.number().min(0.01).default(0.5),
  height_cm: z.coerce.number().int().min(1).default(10),
  width_cm: z.coerce.number().int().min(1).default(20),
  length_cm: z.coerce.number().int().min(1).default(30),
  // Loja parceira — se preenchido, produto vai para WhatsApp externo (não entra no carrinho)
  partner_store_id: z.preprocess(
    (v) => (v === "" || v === "__none__" || v == null ? null : v),
    z.string().uuid().nullable().optional(),
  ),
});

// ── Partner Stores ──
export const createPartnerStoreSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  // Aceita formatos com ou sem + e espaços — guarda só dígitos
  whatsapp_number: z.string()
    .min(10, "Número inválido")
    .max(20)
    .transform((v) => v.replace(/\D/g, "")),
  logo_url: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().url("URL inválida").nullable().optional(),
  ),
});

// ── Consultation ──
export const updateConsultationSchema = z.object({
  workout_plan: z.unknown().optional(),
  diet_plan: z.unknown().optional(),
  daily_calories: z.coerce.number().int().min(0).optional(),
  daily_protein: z.coerce.number().int().min(0).optional(),
  daily_carbs: z.coerce.number().int().min(0).optional(),
  daily_fat: z.coerce.number().int().min(0).optional(),
  status: z.enum(["pending", "in_progress", "delivered", "expired"]).optional(),
  notes_admin: z.string().max(5000).optional(),
});

// ── Anamnese (form de consultoria) ──
// passthrough(): o form vive evoluindo (perguntas novas a cada sprint) e o dado mora em
// JSONB. Strict() quebraria a cada campo novo. Limitamos tamanhos nos campos conhecidos e
// deixamos o resto passar — invariantes de segurança vêm do gate de tamanho total abaixo.
export const anamneseSchema = z.object({
  fullName: z.string().trim().max(200).nullable().optional(),
  birthDate: z.string().trim().max(20).nullable().optional(),
  biologicalSex: z.string().trim().max(40).nullable().optional(),
  weight: z.coerce.number().nonnegative().max(500).nullable().optional(),
  height: z.coerce.number().nonnegative().max(300).nullable().optional(),
  waistCircumference: z.coerce.number().nonnegative().max(500).nullable().optional(),
  hipCircumference: z.coerce.number().nonnegative().max(500).nullable().optional(),
  primaryObjective: z.string().trim().max(500).nullable().optional(),
  secondaryObjective: z.string().trim().max(500).nullable().optional(),
  trainingLevel: z.string().trim().max(80).nullable().optional(),
  additionalNotes: z.string().trim().max(5000).nullable().optional(),
  submittedAt: z.string().trim().max(40).nullable().optional(),
}).passthrough();

export const submitAnamneseSchema = z.object({
  consultationId: z.string().uuid(),
  anamnesis: anamneseSchema,
});

// ── Order Status ──
export const updateOrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "paid", "shipped", "delivered", "canceled"]),
  trackingCode: z.string().max(100).optional(),
});

// ── Helper to parse FormData ──
export function parseFormData<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    raw[key] = value === "" ? null : value;
  });
  return schema.parse(raw);
}
