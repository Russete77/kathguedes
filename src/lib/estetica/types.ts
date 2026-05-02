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
  compare_price: number | null;
  discount_start: number;
  discount_pro: number;
  discount_vip: number;
  includes: string[];
  eligible_for_loyalty: boolean;
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

export function planDiscount(service: EsteticaService, planTier: string): number {
  if (planTier === "vip") return service.discount_vip;
  if (planTier === "pro") return service.discount_pro;
  if (planTier === "start") return service.discount_start;
  return 0;
}

export function finalPriceCents(service: EsteticaService, planTier: string): number {
  const disc = planDiscount(service, planTier);
  return Math.round(service.price_cents * (1 - disc / 100));
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
