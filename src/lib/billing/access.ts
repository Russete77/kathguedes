import type { PlanTier } from "@/lib/supabase/types";

/**
 * Níveis de plano para gating. Fonte de verdade: coluna `plans.level`
 * (CHECK em `migration_modelo_financeiro.sql`). Mantido estático aqui para
 * permitir gating síncrono em Server/Client Components sem round-trip ao DB.
 * Os slugs são fixos por constraint; se um novo tier for adicionado, atualizar aqui.
 *
 * NUNCA comparar plan_tier com slugs legados ("vip"/"pro"/"start") — eles não
 * existem mais. Use `hasPlanAccess` / `isTopPlan` em vez de literais.
 */
export const PLAN_LEVELS: Record<PlanTier, number> = {
  free: 0,
  acesso: 1,
  plano1: 2,
  plano2: 3,
  plano3: 4,
  atleta: 5,
};

/** Maior tier disponível (topo da escada de planos). */
export const TOP_PLAN: PlanTier = "atleta";

/** Nível numérico de um tier (0 = free / desconhecido). */
export function planLevel(tier: PlanTier | string | null | undefined): number {
  if (!tier) return 0;
  return PLAN_LEVELS[tier as PlanTier] ?? 0;
}

/** true se `tier` tem nível >= ao do tier mínimo exigido. */
export function hasPlanAccess(
  tier: PlanTier | string | null | undefined,
  required: PlanTier,
): boolean {
  return planLevel(tier) >= planLevel(required);
}

/** true se `tier` é o tier mais alto (não há upgrade possível). */
export function isTopPlan(tier: PlanTier | string | null | undefined): boolean {
  return planLevel(tier) >= planLevel(TOP_PLAN);
}
