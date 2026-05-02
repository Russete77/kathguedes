import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Plan } from "./plans";

const SAMPLE_PLANS: Plan[] = [
  { slug: "free",   name: "Free",                       level: 0, price_cents: 0,     asaas_value: 0,    asaas_description: "", cashback_pct: 0,  store_discount_pct: 0,  estetica_discount_pct: 0,  features: { workouts_preview: 3, affiliate_clicks_per_month: 3 }, is_active: true, sort_order: 0 },
  { slug: "acesso", name: "Acesso",                     level: 1, price_cents: 1990,  asaas_value: 19.9, asaas_description: "X", cashback_pct: 2,  store_discount_pct: 5,  estetica_discount_pct: 5,  features: {}, is_active: true, sort_order: 1 },
  { slug: "plano1", name: "Plano 1 — Treino",           level: 2, price_cents: 3990,  asaas_value: 39.9, asaas_description: "X", cashback_pct: 3,  store_discount_pct: 8,  estetica_discount_pct: 7,  features: {}, is_active: true, sort_order: 2 },
  { slug: "plano2", name: "Plano 2 — Treino + Dieta",   level: 3, price_cents: 7490,  asaas_value: 74.9, asaas_description: "X", cashback_pct: 5,  store_discount_pct: 12, estetica_discount_pct: 10, features: {}, is_active: true, sort_order: 3 },
  { slug: "plano3", name: "Plano 3 — Saude Completa",   level: 4, price_cents: 9990,  asaas_value: 99.9, asaas_description: "X", cashback_pct: 7,  store_discount_pct: 18, estetica_discount_pct: 12, features: {}, is_active: true, sort_order: 4 },
  { slug: "atleta", name: "Atleta",                     level: 5, price_cents: 30990, asaas_value: 309.9,asaas_description: "X", cashback_pct: 10, store_discount_pct: 25, estetica_discount_pct: 15, features: {}, is_active: true, sort_order: 5 },
];

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: SAMPLE_PLANS, error: null }),
      }),
    }),
  }),
}));

import { _resetPlanCache, getAllPlans, getPlan, planTierFromValue, getStoreDiscountPct, getEsteticaDiscountPct, getCashbackPct } from "./plans";

beforeEach(() => _resetPlanCache());

describe("plans cache", () => {
  it("getAllPlans retorna todos os 6 planos", async () => {
    const plans = await getAllPlans();
    expect(plans.map(p => p.slug)).toEqual(["free","acesso","plano1","plano2","plano3","atleta"]);
  });

  it("getPlan retorna plano por slug", async () => {
    const p = await getPlan("plano3");
    expect(p?.price_cents).toBe(9990);
  });

  it("getPlan retorna null para slug inexistente", async () => {
    const p = await getPlan("inexistente" as never);
    expect(p).toBeNull();
  });
});

describe("planTierFromValue", () => {
  it.each([
    [0,        "free"],
    [10,       "free"],
    [19.89,    "free"],
    [19.9,     "acesso"],
    [20,       "acesso"],
    [39.89,    "acesso"],
    [39.9,     "plano1"],
    [74.9,     "plano2"],
    [99.9,     "plano3"],
    [309.9,    "atleta"],
    [500,      "atleta"],
  ])("value %f → %s", async (value, expected) => {
    const tier = await planTierFromValue(value);
    expect(tier).toBe(expected);
  });
});

describe("discount lookups", () => {
  it.each([
    ["free",   0],
    ["acesso", 5],
    ["plano1", 8],
    ["plano2", 12],
    ["plano3", 18],
    ["atleta", 25],
  ])("getStoreDiscountPct(%s) → %d", async (slug, expected) => {
    expect(await getStoreDiscountPct(slug as never)).toBe(expected);
  });

  it.each([
    ["free",   0],
    ["acesso", 5],
    ["plano1", 7],
    ["plano2", 10],
    ["plano3", 12],
    ["atleta", 15],
  ])("getEsteticaDiscountPct(%s) → %d", async (slug, expected) => {
    expect(await getEsteticaDiscountPct(slug as never)).toBe(expected);
  });

  it.each([
    ["free",   0],
    ["acesso", 2],
    ["plano1", 3],
    ["plano2", 5],
    ["plano3", 7],
    ["atleta", 10],
  ])("getCashbackPct(%s) → %d", async (slug, expected) => {
    expect(await getCashbackPct(slug as never)).toBe(expected);
  });
});
