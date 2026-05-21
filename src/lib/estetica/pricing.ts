/**
 * Helpers de consulta da matriz de preços.
 *
 * Lê das tabelas `estetica_vehicle_types`, `estetica_service_prices` e
 * `estetica_payment_rules` (migration 20). Não faz cache — caller decide.
 *
 * IMPORTANTE: usa admin client porque é chamado dentro de Server Actions
 * autenticadas (after requireAdmin()) ou em Server Components no fluxo de
 * agendamento (que precisa ler todos os tipos ativos independente do user).
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type {
  EsteticaPaymentRule,
  EsteticaVehicleType,
  ServicePricing,
  ServicePricingOption,
  VehicleTypeSlug,
} from "./pricing-types";

/**
 * Retorna todos os tipos de moto ativos, ordenados por sort_order.
 */
export async function listVehicleTypes(): Promise<EsteticaVehicleType[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_vehicle_types" as never)
    .select("id, slug, label, description, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EsteticaVehicleType[];
}

/**
 * Retorna as opções de preço para um serviço (1 row por tipo de moto suportado)
 * + a regra de pagamento associada. Se o serviço não tem nenhuma row em
 * `estetica_service_prices`, options vem vazio — caller deve permitir entrada
 * manual ou bloquear.
 */
export async function getServicePricing(serviceId: string): Promise<ServicePricing> {
  const supabase = createAdminSupabaseClient();

  const [pricesRes, ruleRes] = await Promise.all([
    supabase
      .from("estetica_service_prices" as never)
      .select(
        "price_cents, vehicle_type:estetica_vehicle_types!inner(id, slug, label, description, sort_order, is_active)",
      )
      .eq("service_id", serviceId)
      .eq("is_active", true)
      .order("price_cents", { ascending: true }),
    supabase
      .from("estetica_payment_rules" as never)
      .select(
        "id, service_id, allow_onsite_cash, allow_onsite_pix, allow_onsite_card, allow_app_prepay, require_app_prepay, prepay_pct, notes",
      )
      .eq("service_id", serviceId)
      .maybeSingle(),
  ]);

  if (pricesRes.error) throw new Error(pricesRes.error.message);
  if (ruleRes.error) throw new Error(ruleRes.error.message);

  const rows = (pricesRes.data ?? []) as unknown as Array<{
    price_cents: number;
    vehicle_type: EsteticaVehicleType;
  }>;

  const options: ServicePricingOption[] = rows
    .filter((r) => r.vehicle_type.is_active)
    .map((r) => ({ vehicle_type: r.vehicle_type, price_cents: r.price_cents }))
    .sort((a, b) => a.vehicle_type.sort_order - b.vehicle_type.sort_order);

  return {
    service_id: serviceId,
    options,
    payment_rule: (ruleRes.data ?? null) as unknown as EsteticaPaymentRule | null,
  };
}

/**
 * Lookup direto: preço de um serviço para um tipo de moto.
 * Retorna null se a combinação não estiver cadastrada.
 */
export async function getPriceFor(serviceId: string, vehicleTypeId: string): Promise<number | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_service_prices" as never)
    .select("price_cents")
    .eq("service_id", serviceId)
    .eq("vehicle_type_id", vehicleTypeId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (data as unknown as { price_cents: number }).price_cents;
}

/**
 * Resolve vehicle_type por slug (constante de código → uuid).
 */
export async function getVehicleTypeBySlug(slug: VehicleTypeSlug): Promise<EsteticaVehicleType | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estetica_vehicle_types" as never)
    .select("id, slug, label, description, sort_order, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as EsteticaVehicleType | null;
}
