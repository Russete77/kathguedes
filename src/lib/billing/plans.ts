import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/types";

export type PlanFeatures = {
  workouts_preview?: number;
  workouts?: boolean;
  diet?: boolean;
  supplements?: boolean;
  juices?: boolean;
  affiliate_clicks_per_month?: number | "unlimited";
  chat_sla_h?: number;
  reavaliation?: "monthly" | "biweekly";
  video_call_per_month?: number;
};

/** Ciclos de cobrança. Mensal e mais caro para induzir semestral/anual. */
export type BillingCycle = "semestral" | "anual" | "mensal";

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  semestral: 6,
  anual: 12,
  mensal: 1,
};

export type Plan = {
  slug: PlanTier;
  name: string;
  level: number;
  // price_cents/asaas_value = valor "a partir de" (/mês no plano anual) — display/SEO.
  price_cents: number;
  asaas_value: number;
  asaas_description: string;
  cashback_pct: number;
  store_discount_pct: number;
  features: PlanFeatures;
  is_active: boolean;
  sort_order: number;
  // ── Preços por ciclo (migration 43 + 61) ──
  monthly_semestral_cents: number;
  total_semestral_cents: number;
  monthly_anual_cents: number;
  total_anual_cents: number;
  asaas_value_semestral: number;
  asaas_value_anual: number;
  monthly_mensal_cents: number;
  asaas_value_mensal: number;
};

/**
 * Resolve os números de um plano para um ciclo: /mês (display), total à vista
 * (centavos) e o valor em reais a cobrar no Asaas.
 */
export function getCyclePrice(plan: Plan, cycle: BillingCycle): {
  monthlyCents: number;
  totalCents: number;
  asaasValue: number;
  months: number;
} {
  if (cycle === "anual") {
    return {
      monthlyCents: plan.monthly_anual_cents,
      totalCents: plan.total_anual_cents,
      asaasValue: plan.asaas_value_anual,
      months: 12,
    };
  }
  if (cycle === "mensal") {
    return {
      monthlyCents: plan.monthly_mensal_cents,
      totalCents: plan.monthly_mensal_cents,
      asaasValue: plan.asaas_value_mensal,
      months: 1,
    };
  }
  return {
    monthlyCents: plan.monthly_semestral_cents,
    totalCents: plan.total_semestral_cents,
    asaasValue: plan.asaas_value_semestral,
    months: 6,
  };
}

const TTL_MS = 60_000;
let cache: { data: Plan[]; expiresAt: number } | null = null;
let inflight: Promise<Plan[]> | null = null;

/** @internal — para testes */
export function _resetPlanCache(): void {
  cache = null;
  inflight = null;
}

async function loadPlans(): Promise<Plan[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("level", { ascending: true });
  if (error) throw new Error(`[billing/plans] load failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("[billing/plans] plans table is empty — run seed");
  }
  // database.types.ts ainda não tem as colunas de ciclo (migration 43) — cast
  // via unknown até os types serem regenerados.
  return data as unknown as Plan[];
}

export async function getAllPlans(): Promise<Plan[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  if (inflight) return inflight;
  inflight = loadPlans()
    .then(data => {
      cache = { data, expiresAt: Date.now() + TTL_MS };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function getPlan(slug: PlanTier): Promise<Plan | null> {
  const all = await getAllPlans();
  return all.find(p => p.slug === slug) ?? null;
}

export async function getActivePlans(): Promise<Plan[]> {
  const all = await getAllPlans();
  return all.filter(p => p.is_active);
}

export async function getStoreDiscountPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.store_discount_pct ?? 0;
}

export async function getCashbackPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.cashback_pct ?? 0;
}
