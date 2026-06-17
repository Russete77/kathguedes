import type { PlanTier } from "@/lib/supabase/types";

/**
 * Níveis de plano para gating. Fonte de verdade: coluna `plans.level`
 * (definido em migration 31_plans_v2.sql). Mantido estático aqui para
 * permitir gating síncrono em Server/Client Components sem round-trip ao DB.
 * Os slugs são fixos por constraint; se um novo tier for adicionado, atualizar aqui.
 *
 * Sem FREE — todo usuário ativo paga. Quem não assinou tem subscription_status='canceled'
 * (e o gate fica no status, não no tier).
 *
 * NUNCA comparar plan_tier com slugs legados ("free"/"acesso"/"start"/"evolucao"/"saude_completa"
 * ou ainda mais antigos "vip"/"pro") — eles não existem mais. Use `hasPlanAccess` /
 * `isTopPlan` em vez de literais.
 */
export const PLAN_LEVELS: Record<PlanTier, number> = {
  start: 1,
  evolucao: 2,
  saude_completa: 3,
  atleta: 4,
};

/** Maior tier disponível (topo da escada de planos). */
export const TOP_PLAN: PlanTier = "atleta";

/** Nível numérico de um tier (0 = desconhecido / nunca cadastrado). */
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

/**
 * Lista de tiers cujo nível é <= ao nível informado (a "escada" liberada para
 * o usuário). Centraliza o bloco que estava copiado em várias páginas.
 */
export function tiersUpTo(level: number): PlanTier[] {
  return (Object.keys(PLAN_LEVELS) as PlanTier[]).filter(
    (t) => PLAN_LEVELS[t] <= level,
  );
}

/**
 * Fonte ÚNICA de verdade para "o usuário tem acesso pago agora?".
 * Verdadeiro se a assinatura está `active` OU se ainda está dentro do período
 * pago (`subscription_ends_at` no futuro — caso de quem cancelou mas mantém
 * acesso até o fim do ciclo). Use isto em TODOS os gates em vez de checar
 * `subscription_status === 'active'` solto.
 */
export function hasActiveAccess(
  profile:
    | {
        subscription_status?: string | null;
        subscription_ends_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!profile) return false;
  if (profile.subscription_status === "active") return true;
  const ends = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at)
    : null;
  return !!ends && ends.getTime() > Date.now();
}

/** Janela do trial de demonstração para usuário novo (horas após o cadastro). */
export const DEMO_TRIAL_HOURS = 24;

/**
 * true se o usuário novo ainda está dentro do trial de demonstração de 24h
 * (a partir de `profile.created_at`). Libera a biblioteca/treinos para o novo
 * usuário experimentar o app antes de pagar. NÃO libera consultoria nem loja.
 */
export function isInDemoTrial(
  profile: { created_at?: string | null } | null | undefined,
): boolean {
  if (!profile?.created_at) return false;
  const created = new Date(profile.created_at).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() < created + DEMO_TRIAL_HOURS * 60 * 60 * 1000;
}

/** Horas restantes do trial (0 se expirado / sem trial) — para banners de UI. */
export function demoTrialHoursLeft(
  profile: { created_at?: string | null } | null | undefined,
): number {
  if (!profile?.created_at) return 0;
  const created = new Date(profile.created_at).getTime();
  if (!Number.isFinite(created)) return 0;
  const msLeft = created + DEMO_TRIAL_HOURS * 60 * 60 * 1000 - Date.now();
  return msLeft > 0 ? Math.ceil(msLeft / (60 * 60 * 1000)) : 0;
}

/**
 * Acesso à BIBLIOTECA/TREINOS: tem acesso pago (hasActiveAccess) OU está dentro
 * do trial de demonstração de 24h. Use ESTE gate em fitness/biblioteca.
 * Não use para consultoria nem loja — essas continuam exigindo hasActiveAccess.
 */
export function hasLibraryAccess(
  profile:
    | {
        subscription_status?: string | null;
        subscription_ends_at?: string | null;
        created_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  return hasActiveAccess(profile) || isInDemoTrial(profile);
}
