import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/types";

export type PlanFeatures = {
  workouts_preview?: number;
  workouts?: boolean;
  diet?: boolean;
  supplements?: boolean;
  juices?: boolean;
  estetica_book_all?: boolean;
  affiliate_clicks_per_month?: number | "unlimited";
  chat_sla_h?: number;
  reavaliation?: "monthly" | "biweekly";
  video_call_per_month?: number;
};

export type Plan = {
  slug: PlanTier;
  name: string;
  level: number;
  price_cents: number;
  asaas_value: number;
  asaas_description: string;
  cashback_pct: number;
  store_discount_pct: number;
  estetica_discount_pct: number;
  features: PlanFeatures;
  is_active: boolean;
  sort_order: number;
};

const TTL_MS = 60_000;
let cache: { data: Plan[]; expiresAt: number } | null = null;

/** @internal — para testes */
export function _resetPlanCache(): void {
  cache = null;
}

async function loadPlans(): Promise<Plan[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("level", { ascending: true });
  if (error) throw new Error(`[billing/plans] load failed: ${error.message}`);
  return (data ?? []) as Plan[];
}

export async function getAllPlans(): Promise<Plan[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  const data = await loadPlans();
  cache = { data, expiresAt: now + TTL_MS };
  return data;
}

export async function getPlan(slug: PlanTier): Promise<Plan | null> {
  const all = await getAllPlans();
  return all.find(p => p.slug === slug) ?? null;
}

export async function getActivePlans(): Promise<Plan[]> {
  const all = await getAllPlans();
  return all.filter(p => p.is_active);
}

/**
 * Mapeia valor pago ao Asaas (em reais) → tier de plano.
 * Procura o plano com asaas_value mais proximo (<= value).
 */
export async function planTierFromValue(value: number): Promise<PlanTier> {
  const plans = await getAllPlans();
  const free = plans.find(p => p.slug === "free");
  if (!free) throw new Error("[billing/plans] FREE plan missing — seed required");
  let match: Plan = free;
  for (const p of plans) {
    if (p.asaas_value > 0 && p.asaas_value <= value && p.level > match.level) {
      match = p;
    }
  }
  return match.slug;
}

export async function getStoreDiscountPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.store_discount_pct ?? 0;
}

export async function getEsteticaDiscountPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.estetica_discount_pct ?? 0;
}

export async function getCashbackPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.cashback_pct ?? 0;
}
