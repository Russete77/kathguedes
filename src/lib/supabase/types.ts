/**
 * Database types para Supabase.
 *
 * Em produção, gerar automaticamente com:
 * npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 *
 * Por enquanto, tipagem manual baseada no schema do PRD.
 */

export type PlanTier = "free" | "start" | "pro" | "vip";
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
export type AffiliateModule = "fitness" | "moto";
export type AffiliatePlatform =
  | "amazon"
  | "mercadolivre"
  | "shopee"
  | "direto";
export type CouponModule = "fitness" | "moto" | "geral";

// ── Row types (shared between Row/Insert/Update) ──

type ProfileFields = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
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
};

// ── Consultation plan types (in-app, sem PDF) ──

export interface ExerciseItem {
  name: string;
  sets: number;
  reps: string; // "12" ou "12-15" ou "até falha"
  rest: string; // "60s"
  notes?: string;
}

export interface TrainingDay {
  name: string; // "Segunda - Glúteo"
  exercises: ExerciseItem[];
}

export interface TrainingWeek {
  name: string; // "Semana 1"
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
  is_from_kath: boolean;
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
        Row: { id: string; user_id: string; coupon_id: string; created_at: string };
        Insert: { user_id: string; coupon_id: string };
        Update: Partial<{ user_id: string; coupon_id: string }>;
      };
    };
  };
}
