-- ============================================================================
-- MIGRATION 61: planos mensais + promo PRIMEIROS20 (10% OFF)
-- ============================================================================
--
-- 1. Adiciona colunas de preco mensal na tabela plans.
-- 2. Adiciona coluna discount_pct em promo_codes (suporte a desconto percentual).
-- 3. Ajusta constraint de promo_codes para permitir promo_value_cents=0 quando
--    discount_pct > 0.
-- 4. Atualiza RPCs claim_promo_slot e peek_promo_slot para retornar discount_pct.
-- 5. Seed: PRIMEIROS20 — 10% OFF para os 20 primeiros clientes por plano.
--
-- Logica de billing mensal:
--   PIX / BOLETO -> subscription Asaas com cycle MONTHLY (renova todo mes)
--   CREDIT_CARD  -> pagamento avulso com value (sem parcelamento; user reassina
--                   todo mes — estrategia para empurrar clientes para semestral/anual)
-- ============================================================================

begin;

-- ============================================================================
-- 1. Colunas de preco mensal nos planos
-- ============================================================================
alter table public.plans
  add column if not exists monthly_mensal_cents int not null default 0,
  add column if not exists asaas_value_mensal   numeric(10,2) not null default 0;

-- Treino (start)         — R$69,90/mes
update public.plans set monthly_mensal_cents = 6990, asaas_value_mensal = 69.90 where slug = 'start';
-- Performance (evolucao) — R$99,90/mes
update public.plans set monthly_mensal_cents = 9990, asaas_value_mensal = 99.90 where slug = 'evolucao';
-- Saude Completa         — R$129,90/mes
update public.plans set monthly_mensal_cents = 12990, asaas_value_mensal = 129.90 where slug = 'saude_completa';
-- Atleta                 — R$349,90/mes
update public.plans set monthly_mensal_cents = 34990, asaas_value_mensal = 349.90 where slug = 'atleta';

-- ============================================================================
-- 2. Coluna discount_pct em promo_codes
-- ============================================================================
alter table public.promo_codes
  add column if not exists discount_pct int not null default 0
  check (discount_pct >= 0 and discount_pct < 100);

-- ============================================================================
-- 3. Ajustar constraint: promo_value_cents > 0 OU discount_pct > 0
--    A constraint padrao gerada pelo CHECK inline chama-se
--    promo_codes_promo_value_cents_check.
-- ============================================================================
alter table public.promo_codes
  drop constraint if exists promo_codes_promo_value_cents_check;

alter table public.promo_codes
  add constraint promo_codes_value_check
  check (promo_value_cents > 0 or discount_pct > 0);

-- ============================================================================
-- 4. RPC claim_promo_slot — agora retorna discount_pct
-- ============================================================================
create or replace function public.claim_promo_slot(
  p_slug      text,
  p_plan_tier text
)
returns table (
  id                uuid,
  slug              text,
  plan_tier         text,
  promo_value_cents int,
  discount_cents    int,
  discount_pct      int,
  uses_count        int,
  max_uses          int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.promo_codes pc
     set uses_count = pc.uses_count + 1,
         updated_at = now()
   where pc.slug = p_slug
     and pc.plan_tier = p_plan_tier
     and pc.is_active = true
     and pc.uses_count < pc.max_uses
     and (pc.starts_at is null or pc.starts_at <= now())
     and (pc.ends_at   is null or pc.ends_at   >  now())
  returning pc.id, pc.slug, pc.plan_tier, pc.promo_value_cents,
            pc.discount_cents, pc.discount_pct, pc.uses_count, pc.max_uses;
end;
$$;

comment on function public.claim_promo_slot(text, text) is
  'Consome um slot atomico via UPDATE RETURNING. Retorna null se esgotado/inativo.';

-- ============================================================================
-- 4b. RPC peek_promo_slot — tambem retorna discount_pct
-- ============================================================================
create or replace function public.peek_promo_slot(
  p_slug      text,
  p_plan_tier text
)
returns table (
  promo_value_cents int,
  discount_cents    int,
  discount_pct      int,
  uses_count        int,
  max_uses          int,
  remaining         int
)
language sql
stable
security definer
set search_path = public
as $$
  select promo_value_cents,
         discount_cents,
         discount_pct,
         uses_count,
         max_uses,
         (max_uses - uses_count) as remaining
    from public.promo_codes
   where slug = p_slug
     and plan_tier = p_plan_tier
     and is_active = true
     and (starts_at is null or starts_at <= now())
     and (ends_at   is null or ends_at   >  now())
   limit 1;
$$;

-- ============================================================================
-- 5. Seed: PRIMEIROS20 — 10% OFF para os 20 primeiros clientes por plano
--    promo_value_cents = 0 (nao usado; desconto e percentual via discount_pct)
-- ============================================================================
insert into public.promo_codes
  (slug, plan_tier, promo_value_cents, discount_pct, max_uses, description, is_active)
values
  ('PRIMEIROS20', 'start',          0, 10, 20, '10% OFF primeiros 20 clientes - Treino',         true),
  ('PRIMEIROS20', 'evolucao',       0, 10, 20, '10% OFF primeiros 20 clientes - Performance',    true),
  ('PRIMEIROS20', 'saude_completa', 0, 10, 20, '10% OFF primeiros 20 clientes - Saude Completa', true),
  ('PRIMEIROS20', 'atleta',         0, 10, 20, '10% OFF primeiros 20 clientes - Atleta',         true)
on conflict (slug, plan_tier) do nothing;

commit;
