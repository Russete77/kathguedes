/**
 * Tipos da matriz de preços por tipo de moto (migration 20).
 * Espelha estetica_vehicle_types / estetica_service_prices / estetica_payment_rules.
 */

export type VehicleTypeSlug =
  | "scooter_pequena"
  | "scooter"
  | "ate_300cc"
  | "media_cilindrada"
  | "acima_800cc"
  | "naked"
  | "crossover"
  | "custom"
  | "touring"
  | "big_trail";

export interface EsteticaVehicleType {
  id: string;
  slug: VehicleTypeSlug;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface EsteticaServicePrice {
  id: string;
  service_id: string;
  vehicle_type_id: string;
  price_cents: number;
  is_active: boolean;
}

export interface EsteticaPaymentRule {
  id: string;
  service_id: string;
  allow_onsite_cash: boolean;
  allow_onsite_pix: boolean;
  allow_onsite_card: boolean;
  allow_app_prepay: boolean;
  require_app_prepay: boolean;
  prepay_pct: number;
  notes: string | null;
}

/**
 * Vista agregada que cobre o fluxo "qual tipo de moto custa quanto neste serviço".
 */
export interface ServicePricingOption {
  vehicle_type: EsteticaVehicleType;
  price_cents: number;
}

export interface ServicePricing {
  service_id: string;
  options: ServicePricingOption[];
  payment_rule: EsteticaPaymentRule | null;
}
