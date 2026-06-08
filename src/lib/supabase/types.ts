/**
 * Database types para Supabase.
 *
 * Em produção, gerar automaticamente com:
 * npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 *
 * Por enquanto, tipagem manual baseada no schema do PRD.
 */

export type PlanTier = "start" | "evolucao" | "saude_completa" | "atleta";
export type SubscriptionStatus = "active" | "past_due" | "canceled";
export type WorkoutCategory =
  | "gluteo"
  | "pernas"
  | "superior"
  | "hiit"
  | "full"
  | "viagem";
export type WorkoutLevel = "iniciante" | "intermediario" | "avancado";
export type ConsultationPackage =
  | "mensal"
  | "trimestral"
  | "premium"
  | "assessoria";
export type ConsultationStatus =
  | "pending"
  | "in_progress"
  | "delivered"
  | "expired";
export type AffiliateModule = "fitness";
export type AffiliatePlatform =
  | "amazon"
  | "mercadolivre"
  | "shopee"
  | "direto";
export type CouponModule = "fitness" | "geral";

// ── Row types (shared between Row/Insert/Update) ──

type ProfileFields = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  cpf: string | null;
  plan_tier: PlanTier;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_ends_at: string | null;
  workout_streak: number;
  last_workout_at: string | null;
  interests: string[];
  onboarding_completed: boolean;
  created_at: string;
};

type WorkoutVideoFields = {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: WorkoutCategory;
  level: WorkoutLevel;
  duration_minutes: number;
  required_plan: PlanTier;
  thumbnail_url: string | null;
  views_count: number;
  is_published: boolean;
  published_at: string | null;
  /** Quando true, libera o video pra qualquer user (mesmo sem subscription
   *  ativa). Usado pro freemium — ver migration 41. */
  is_free_preview: boolean;
};

// ── Consultation plan types (in-app, sem PDF) ──
//
// Tipos compartilhados entre:
// - admin/consultorias/[id]/plan-editor.tsx  (montagem do plano)
// - admin/templates/template-editor.tsx       (template reutilizável)
// - (app)/consultoria/workout-plan-viewer.tsx (renderização aluno)
// - (app)/consultoria/exercise-card.tsx       (card de exercício)
//
// IMPORTANTE: shape é JSONB no Postgres (consultations.workout_plan,
// plan_templates.data), então qualquer campo NOVO precisa ser opcional —
// senão quebra planos que já foram salvos com a shape antiga.

export interface ExerciseItem {
  name: string;
  sets: number;
  reps: string; // "12" ou "12-15" ou "até falha"
  rest: string; // "60s" — sempre string pra suportar "1min", "2min", etc.
  notes?: string;
  youtube_id?: string; // link com workout_videos.youtube_id (preenchido via "Biblioteca")
  exercise_id?: string; // FK opcional pra exercises.id (preenchido via "Catalogo")
  // ── Técnica + agrupamento (opcionais, retro-compatível) ──
  // Slugs ficam em src/constants/techniques.ts (fonte de verdade).
  technique?: string;        // "straight"|"bi_set"|"dropset"|... (default = straight)
  technique_detail?: string; // texto livre: "3 quedas: 100→70→50kg"
  group_id?: string;         // mesmo id = mesmo bloco (bi-set/tri-set)
  group_type?: string;       // "bi_set"|"tri_set"|"giant_set"|"superset"|"circuito"
  group_role?: string;       // "A"|"B"|"C"|"D" — ordem dentro do bloco
}

// ── Catalogo de exercicios (migration 34) ──

export type ExerciseRow = {
  id: string;
  name: string;
  primary_category: string;
  level: string | null;
  secondary_groups: string[];
  equipment: string[];
  default_sets: number;
  default_reps: string;
  default_rest: number;
  notes: string | null;
  workout_video_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export interface TrainingDay {
  name: string; // "Segunda - Glúteo"
  exercises: ExerciseItem[];
}

export type WeekIntensity = "leve" | "moderado" | "intenso" | "pico";

export interface TrainingWeek {
  name: string; // "Semana 1 — Adaptação"
  intensity?: WeekIntensity;
  is_peak_week?: boolean;
  notes?: string;
  days: TrainingDay[];
}

export interface WorkoutPlan {
  weeks: TrainingWeek[];
}

export interface FoodItem {
  name: string;
  quantity: string; // "150g", "1 unidade"
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface Meal {
  name: string; // "Café da manhã"
  time: string; // "07:00"
  foods: FoodItem[];
}

export interface DietPlan {
  meals: Meal[];
}

type ConsultationFields = {
  id: string;
  user_id: string;
  package_type: ConsultationPackage;
  status: ConsultationStatus;
  anamnesis: Record<string, unknown> | null;
  workout_plan: WorkoutPlan | null;
  diet_plan: DietPlan | null;
  daily_calories: number | null;
  daily_protein: number | null;
  daily_carbs: number | null;
  daily_fat: number | null;
  notes_admin: string | null;
  valid_until: string;
  created_at: string;
};

type WorkoutLogFields = {
  id: string;
  user_id: string;
  workout_id: string;
  completed_at: string;
  duration_actual: number | null;
};

type AffiliateLinkFields = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  module: AffiliateModule;
  category: string;
  platform: AffiliatePlatform;
  affiliate_url: string;
  required_plan: PlanTier;
  clicks_count: number;
  is_active: boolean;
  sort_order: number;
};

type CouponFields = {
  id: string;
  title: string;
  code: string;
  discount_pct: number | null;
  partner_name: string;
  partner_url: string;
  module: CouponModule;
  required_plan: PlanTier;
  max_uses: number | null;
  uses_count: number;
  valid_until: string;
  is_flash: boolean;
  is_active: boolean;
};

type MessageFields = {
  id: string;
  user_id: string;
  body: string;
  sender_role: "user" | "kath" | "sidney" | "admin";
  is_read: boolean;
  created_at: string;
};

// ── Loja ──

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "canceled";

export interface ProductVariant {
  name: string;
  stock: number;
}

export interface OrderItem {
  product_id: string;
  title: string;
  variant: string | null;
  quantity: number;
  price_cents: number;
}

export interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

type ProductFields = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  price_cents: number;
  compare_price: number | null;
  category: string;
  module: string;
  variants: ProductVariant[];
  stock: number;
  discount_start: number;
  discount_pro: number;
  discount_vip: number;
  is_active: boolean;
  sort_order: number;
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  created_at: string;
};

type OrderFields = {
  id: string;
  user_id: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal_cents: number;
  discount_cents: number;
  shipping_cost_cents: number;
  shipping_method: string | null;
  estimated_delivery: string | null;
  total_cents: number;
  shipping_info: ShippingInfo | null;
  tracking_code: string | null;
  asaas_payment_id: string | null;
  melhor_envio_order_id: string | null;
  shipping_label_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Billing / financeiro ──

export type PlanRow = {
  slug: PlanTier;
  name: string;
  level: number;
  price_cents: number;
  asaas_value: number;
  asaas_description: string;
  cashback_pct: number;
  store_discount_pct: number;
  features: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TeamRole = "owner" | "partner" | "consultant";
export type TeamMemberRow = {
  id: string;
  clerk_user_id: string | null;
  email: string;
  full_name: string;
  role: TeamRole;
  pix_key: string | null;
  bank_account: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
};

export type RevenueStreamType = "mensalidade" | "loja" | "afiliado_externo";
export type RevenueReferenceType = "subscription" | "order" | "affiliate_payout";
export type RevenueStreamStatus = "pending" | "confirmed" | "refunded";
export type RevenueStreamRow = {
  id: string;
  type: RevenueStreamType;
  category: string | null;
  user_id: string | null;
  reference_type: RevenueReferenceType;
  reference_id: string;
  asaas_payment_id: string | null;
  gross_cents: number;
  cost_cents: number;
  net_cents: number; // generated column
  cashback_used_cents: number;
  status: RevenueStreamStatus;
  occurred_at: string;
  created_at: string;
};

export type CommissionRuleRow = {
  id: string;
  team_member_id: string;
  applies_to_type: RevenueStreamType | null;
  applies_to_category: string | null;
  pct: number;
  applies_from: string;
  applies_to: string | null;
  is_active: boolean;
  created_at: string;
};

export type CommissionAllocationStatus = "draft" | "approved" | "paid" | "failed";
export type CommissionAllocationRow = {
  id: string;
  revenue_stream_id: string;
  team_member_id: string;
  pct: number;
  amount_cents: number;
  status: CommissionAllocationStatus;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
};

export type WalletCreditRow = {
  id: string;
  user_id: string;
  source_revenue_stream_id: string | null;
  spent_on_revenue_stream_id: string | null;
  amount_cents: number;
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
};

export type WalletBalanceRow = {
  user_id: string;
  active_cents: number;
  earned_total_cents: number;
  spent_total_cents: number;
  expired_total_cents: number;
  updated_at: string;
};

export type MonthlyUsageRow = {
  user_id: string;
  year_month: string;
  affiliate_clicks_count: number;
};

// ── Eventos moto / desafios ──

export type MotoEventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  location_url: string | null;
  image_url: string | null;
  max_participants: number | null;
  current_participants: number;
  required_plan: PlanTier;
  is_active: boolean;
  created_at: string;
};

export type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  type: "streak" | "volume" | "custom";
  target_value: number;
  start_date: string;
  end_date: string;
  reward_text: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type ChallengeParticipantRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  current_value: number;
  completed_at: string | null;
  joined_at: string;
};

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: {
        Row: ProfileFields;
        Insert: Partial<ProfileFields> & Pick<ProfileFields, "id" | "full_name">;
        Update: Partial<ProfileFields>;
      };
      workout_videos: {
        Row: WorkoutVideoFields;
        Insert: Partial<WorkoutVideoFields> &
          Pick<WorkoutVideoFields, "title" | "youtube_id" | "category" | "level" | "duration_minutes">;
        Update: Partial<WorkoutVideoFields>;
      };
      consultations: {
        Row: ConsultationFields;
        Insert: Partial<ConsultationFields> &
          Pick<ConsultationFields, "user_id" | "package_type" | "valid_until">;
        Update: Partial<ConsultationFields>;
      };
      workout_logs: {
        Row: WorkoutLogFields;
        Insert: Partial<WorkoutLogFields> &
          Pick<WorkoutLogFields, "user_id" | "workout_id">;
        Update: Partial<WorkoutLogFields>;
      };
      affiliate_links: {
        Row: AffiliateLinkFields;
        Insert: Partial<AffiliateLinkFields> &
          Pick<AffiliateLinkFields, "title" | "image_url" | "module" | "category" | "platform" | "affiliate_url">;
        Update: Partial<AffiliateLinkFields>;
      };
      coupons: {
        Row: CouponFields;
        Insert: Partial<CouponFields> &
          Pick<CouponFields, "title" | "code" | "partner_name" | "partner_url" | "module" | "valid_until">;
        Update: Partial<CouponFields>;
      };
      messages: {
        Row: MessageFields;
        Insert: Partial<MessageFields> &
          Pick<MessageFields, "user_id" | "body">;
        Update: Partial<MessageFields>;
      };
      products: {
        Row: ProductFields;
        Insert: Partial<ProductFields> &
          Pick<ProductFields, "title" | "image_url" | "price_cents" | "category">;
        Update: Partial<ProductFields>;
      };
      orders: {
        Row: OrderFields;
        Insert: Partial<OrderFields> &
          Pick<OrderFields, "user_id" | "items" | "subtotal_cents" | "total_cents">;
        Update: Partial<OrderFields>;
      };
      webhook_events: {
        Row: { payment_id: string; event: string; created_at: string };
        Insert: { payment_id: string; event: string };
        Update: Partial<{ payment_id: string; event: string }>;
      };
      push_subscriptions: {
        Row: { id: string; user_id: string; endpoint: string; keys: Record<string, string>; created_at: string };
        Insert: Partial<{ id: string; created_at: string }> & { user_id: string; endpoint: string; keys: Record<string, string> };
        Update: Partial<{ endpoint: string; keys: Record<string, string> }>;
      };
      notifications: {
        Row: { id: string; user_id: string; title: string; body: string; icon: string | null; url: string | null; is_read: boolean; created_at: string };
        Insert: Partial<{ id: string; is_read: boolean; created_at: string }> & { user_id: string; title: string; body: string };
        Update: Partial<{ is_read: boolean }>;
      };
      plan_templates: {
        Row: { id: string; name: string; description: string | null; type: string; data: unknown; is_active: boolean; created_at: string };
        Insert: Partial<{ id: string; is_active: boolean; created_at: string }> & { name: string; type: string; data: unknown };
        Update: Partial<{ name: string; description: string | null; type: string; data: unknown; is_active: boolean }>;
      };
      coupon_uses: {
        Row: { id: string; user_id: string; coupon_id: string; used_at: string };
        Insert: { user_id: string; coupon_id: string };
        Update: Partial<{ user_id: string; coupon_id: string }>;
      };
      plans: {
        Row: PlanRow;
        Insert: Partial<PlanRow> & Pick<PlanRow, "slug" | "name" | "level" | "price_cents" | "asaas_value" | "asaas_description">;
        Update: Partial<PlanRow>;
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: Partial<TeamMemberRow> & Pick<TeamMemberRow, "email" | "full_name" | "role">;
        Update: Partial<TeamMemberRow>;
      };
      commission_rules: {
        Row: CommissionRuleRow;
        Insert: Partial<CommissionRuleRow> & Pick<CommissionRuleRow, "team_member_id" | "pct">;
        Update: Partial<CommissionRuleRow>;
      };
      commission_allocations: {
        Row: CommissionAllocationRow;
        Insert: Partial<CommissionAllocationRow> &
          Pick<CommissionAllocationRow, "revenue_stream_id" | "team_member_id" | "pct" | "amount_cents">;
        Update: Partial<CommissionAllocationRow>;
      };
      revenue_streams: {
        Row: RevenueStreamRow;
        Insert: Partial<RevenueStreamRow> &
          Pick<RevenueStreamRow, "type" | "reference_type" | "reference_id" | "gross_cents" | "occurred_at">;
        Update: Partial<RevenueStreamRow>;
      };
      wallet_credits: {
        Row: WalletCreditRow;
        Insert: Partial<WalletCreditRow> & Pick<WalletCreditRow, "user_id" | "amount_cents">;
        Update: Partial<WalletCreditRow>;
      };
      wallet_balance: {
        Row: WalletBalanceRow;
        Insert: Partial<WalletBalanceRow> & Pick<WalletBalanceRow, "user_id">;
        Update: Partial<WalletBalanceRow>;
      };
      monthly_usage: {
        Row: MonthlyUsageRow;
        Insert: Partial<MonthlyUsageRow> & Pick<MonthlyUsageRow, "user_id" | "year_month">;
        Update: Partial<MonthlyUsageRow>;
      };
      moto_events: {
        Row: MotoEventRow;
        Insert: Partial<MotoEventRow> & Pick<MotoEventRow, "title" | "event_date">;
        Update: Partial<MotoEventRow>;
      };
      challenges: {
        Row: ChallengeRow;
        Insert: Partial<ChallengeRow> &
          Pick<ChallengeRow, "title" | "type" | "target_value" | "start_date" | "end_date">;
        Update: Partial<ChallengeRow>;
      };
      challenge_participants: {
        Row: ChallengeParticipantRow;
        Insert: Partial<ChallengeParticipantRow> &
          Pick<ChallengeParticipantRow, "challenge_id" | "user_id">;
        Update: Partial<ChallengeParticipantRow>;
      };
    };
  };
}
