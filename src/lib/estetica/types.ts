export type EsteticaServiceCategory =
  | "lavagem"
  | "polimento"
  | "vitrificacao"
  | "higienizacao"
  | "cristalizacao"
  | "outros";

export type EsteticaBookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "done"
  | "canceled"
  | "no_show";

export interface EsteticaService {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: EsteticaServiceCategory;
  duration_min: number;
  price_cents: number;
  cost_cents: number;
  compare_price: number | null;
  includes: string[];
  eligible_for_loyalty: boolean;
  requires_paid_plan: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface EsteticaBooking {
  id: string;
  user_id: string;
  service_id: string;
  scheduled_at: string;
  duration_min: number;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string | null;
  customer_name: string;
  customer_phone: string;
  status: EsteticaBookingStatus;
  price_cents: number;
  plan_discount_cents: number;
  loyalty_free: boolean;
  cashback_used_cents: number;
  total_cents: number;
  asaas_payment_id: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsteticaPortfolioItem {
  id: string;
  title: string | null;
  service_id: string | null;
  before_url: string;
  after_url: string;
  description: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

export interface EsteticaLoyaltyPhoto {
  id: string;
  user_id: string;
  booking_id: string;
  photo_url: string;
  month: string;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
}

/**
 * Calcula preço final aplicando desconto (em %).
 * O desconto deve vir de `getEsteticaDiscountPct(planTier)` em `lib/billing/plans`.
 */
export function finalPriceCents(service: Pick<EsteticaService, "price_cents">, discountPct: number): number {
  const pct = Math.max(0, Math.min(100, discountPct));
  return Math.round(service.price_cents * (100 - pct) / 100);
}

export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
