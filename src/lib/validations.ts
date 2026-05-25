import { z } from "zod";

// ── Plan Tiers ──
export const planTierSchema = z.enum(["free", "acesso", "plano1", "plano2", "plano3", "atleta"]);

// ── Workouts ──
export const createWorkoutSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  youtube_id: z.string().min(1, "YouTube ID obrigatório").max(500),
  category: z.enum([
    "gluteo", "pernas", "quadriceps", "costas", "ombro", "biceps", "triceps",
    "peito", "abdomen", "superior", "inferior", "hiit", "cardio", "funcional",
    "full", "alongamento", "aquecimento", "viagem", "competicao",
  ]),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  duration_minutes: z.coerce.number().int().min(1).max(300),
  required_plan: planTierSchema.default("free"),
  is_published: z.coerce.boolean().default(false),
  is_short: z.coerce.boolean().default(false),
  notes: z.string().max(2000).nullable().optional(),
});

// ── Coupons ──
export const createCouponSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  code: z.string().min(1, "Código obrigatório").max(50).transform(v => v.toUpperCase()),
  discount_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  partner_name: z.string().min(1, "Parceiro obrigatório").max(200),
  partner_url: z.string().url("URL inválida"),
  module: z.enum(["fitness", "moto", "geral"]),
  required_plan: planTierSchema.default("free"),
  max_uses: z.coerce.number().int().min(0).nullable().optional(),
  valid_until: z.string().min(1, "Data de validade obrigatória"),
  is_flash: z.coerce.boolean().default(false),
});

// ── Affiliates ──
export const createAffiliateSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url("URL da imagem inválida"),
  module: z.enum(["fitness", "moto"]),
  category: z.string().min(1, "Categoria obrigatória").max(100),
  platform: z.enum(["amazon", "mercadolivre", "shopee", "direto"]),
  affiliate_url: z.string().url("URL do afiliado inválida"),
  required_plan: planTierSchema.default("free"),
});

// ── Products ──
export const createProductSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url("URL da imagem inválida"),
  price_cents: z.coerce.number().int().min(1, "Preço em centavos deve ser maior que zero"),
  cost_cents: z.coerce.number().int().min(0).default(0),
  compare_price: z.coerce.number().int().min(0).nullable().optional(),
  category: z.string().min(1, "Categoria obrigatória").max(100),
  module: z.enum(["fitness", "moto", "geral"]).default("geral"),
  stock: z.coerce.number().int().min(0).default(0),
  // Peso e dimensões para cálculo de frete
  weight_kg: z.coerce.number().min(0.01).default(0.5),
  height_cm: z.coerce.number().int().min(1).default(10),
  width_cm: z.coerce.number().int().min(1).default(20),
  length_cm: z.coerce.number().int().min(1).default(30),
});

// ── Estetica Services ──
export const createEsteticaServiceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  category: z.enum(["lavagem", "polimento", "vitrificacao", "higienizacao", "cristalizacao", "outros"]),
  duration_min: z.coerce.number().int().min(15).max(480).default(60),
  price_cents: z.coerce.number().int().min(1, "Preço em centavos deve ser maior que zero"),
  cost_cents: z.coerce.number().int().min(0).default(0),
  compare_price: z.coerce.number().int().min(0).nullable().optional(),
  includes: z.array(z.string()).default([]),
  eligible_for_loyalty: z.coerce.boolean().default(true),
  requires_paid_plan: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

// ── Estetica Booking criado pelo admin (cliente sem conta no app) ──
export const adminBookingSchema = z.object({
  service_id: z.string().uuid("Serviço obrigatório"),
  vehicle_type_id: z.string().uuid("Tipo de moto obrigatório"),
  scheduled_at: z.string().min(10, "Data/hora obrigatórias"),
  customer_name: z.string().min(2, "Nome obrigatório").max(120),
  customer_phone: z.string().min(8, "Telefone obrigatório").max(20),
  vehicle_brand: z.string().min(1, "Marca obrigatória").max(80),
  vehicle_model: z.string().min(1, "Modelo obrigatório").max(120),
  vehicle_plate: z.string().min(4, "Placa obrigatória").max(15),
  vehicle_color: z.string().max(40).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ── Estetica Walk-in (atendimento presencial) ──
export const walkinServiceSchema = z.object({
  // placa já normalizada (uppercase, sem traço/espaço) — Mercosul ou antigo
  plate: z
    .string()
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, "Placa inválida (use ABC1D23 ou ABC1234)"),
  customer_name: z.string().min(2, "Nome do cliente obrigatório").max(200),
  customer_phone: z.string().min(8, "Telefone obrigatório").max(20),
  customer_cpf: z.string().max(20).nullable().optional(),
  customer_email: z.string().email("E-mail inválido").max(200).nullable().optional().or(z.literal("").transform(() => null)),
  vehicle_brand: z.string().max(80).nullable().optional(),
  vehicle_model: z.string().max(80).nullable().optional(),
  vehicle_color: z.string().max(40).nullable().optional(),
  vehicle_year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  service_id: z.string().uuid("Serviço inválido").nullable().optional(),
  vehicle_type_id: z.string().uuid("Tipo de moto inválido").nullable().optional(),
  price_cents: z.coerce.number().int().min(0, "Preço inválido"),
  payment_method: z.enum([
    "dinheiro",
    "pix",
    "cartao_debito",
    "cartao_credito",
    "transferencia",
    "outro",
  ]),
  payment_status: z.enum(["pago", "pendente", "isento"]).default("pago"),
  notes: z.string().max(2000).nullable().optional(),
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
