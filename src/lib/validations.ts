import { z } from "zod";

// ── Plan Tiers ──
export const planTierSchema = z.enum(["free", "acesso", "plano1", "plano2", "plano3", "atleta"]);

// ── Workouts ──
export const createWorkoutSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  youtube_id: z.string().min(1, "YouTube ID obrigatório").max(500),
  category: z.enum([
    "gluteo", "pernas", "costas", "ombro", "biceps", "triceps",
    "peito", "abdomen", "superior", "hiit", "cardio", "funcional",
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
