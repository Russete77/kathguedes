import { describe, it, expect, vi, beforeEach } from "vitest";

const SAMPLE_PLANS = [
  { slug: "free",   name: "Free",   level: 0, price_cents: 0,     asaas_value: 0,    asaas_description: "", cashback_pct: 0,  store_discount_pct: 0,  estetica_discount_pct: 0,  features: {}, is_active: true, sort_order: 0 },
  { slug: "acesso", name: "Acesso", level: 1, price_cents: 1990,  asaas_value: 19.9, asaas_description: "", cashback_pct: 2,  store_discount_pct: 5,  estetica_discount_pct: 5,  features: {}, is_active: true, sort_order: 1 },
  { slug: "plano1", name: "P1",     level: 2, price_cents: 3990,  asaas_value: 39.9, asaas_description: "", cashback_pct: 3,  store_discount_pct: 8,  estetica_discount_pct: 7,  features: {}, is_active: true, sort_order: 2 },
  { slug: "plano2", name: "P2",     level: 3, price_cents: 7490,  asaas_value: 74.9, asaas_description: "", cashback_pct: 5,  store_discount_pct: 12, estetica_discount_pct: 10, features: {}, is_active: true, sort_order: 3 },
  { slug: "plano3", name: "P3",     level: 4, price_cents: 9990,  asaas_value: 99.9, asaas_description: "", cashback_pct: 7,  store_discount_pct: 18, estetica_discount_pct: 12, features: {}, is_active: true, sort_order: 4 },
  { slug: "atleta", name: "AT",     level: 5, price_cents: 30990, asaas_value: 309.9,asaas_description: "", cashback_pct: 10, store_discount_pct: 25, estetica_discount_pct: 15, features: {}, is_active: true, sort_order: 5 },
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

import { _resetPlanCache } from "@/lib/billing/plans";
import { verifyWebhookToken, planTierFromValue } from "./webhook";

beforeEach(() => _resetPlanCache());

describe("verifyWebhookToken", () => {
  it("returns false when ASAAS_WEBHOOK_TOKEN env var is missing", () => {
    // config.ts returns "" when env var is not set; verifyWebhookToken returns false
    expect(verifyWebhookToken("any-token")).toBe(false);
  });

  it("returns false on null header token", () => {
    expect(verifyWebhookToken(null)).toBe(false);
  });
});

describe("planTierFromValue", () => {
  it.each([
    [0,        "free"],
    [19.9,     "acesso"],
    [39.9,     "plano1"],
    [74.9,     "plano2"],
    [99.9,     "plano3"],
    [309.9,    "atleta"],
  ])("value %f → %s", async (value, expected) => {
    expect(await planTierFromValue(value)).toBe(expected);
  });
});
