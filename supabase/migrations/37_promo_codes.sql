-- ============================================================================
-- MIGRATION 37: promo_codes (promoção dos 15 primeiros)
-- ============================================================================
--
-- Promoção de lançamento com número limitado de slots por plano.
-- A receita do Asaas mantém o `asaas_value` da subscription cadastrado no
-- momento da criação — então quem entrar nos primeiros 15 slots paga o valor
-- promocional enquanto não cancelar/reassinar.
--
-- Modelo:
--  - 1 row por (slug, plan_tier) com max_uses + uses_count + promo_value (R$).
--  - Slug global (ex: 'LANCAMENTO') agrupa promos por plano: o admin cria as
--    4 linhas (start/evolucao/saude_completa/atleta) com mesmo slug, max=15.
--  - RPC `claim_promo_slot(slug, plan_tier)` é ATÔMICO via UPDATE...RETURNING
--    com WHERE uses_count < max_uses. Sem race condition mesmo em pico.
--
-- Fluxo no checkout (server-side):
--   1. /api/checkout/subscribe lê profile + plano selecionado.
--   2. Antes de criar subscription no Asaas, tenta `claim_promo_slot()`.
--   3. Se retornou row, usa promo.promo_value_cents/100 como `value` no Asaas.
--   4. Se retornou null (esgotou ou inativo), segue com plans.asaas_value normal.
--   5. Grava promo_code_id no profile (snapshot histórico).
--
-- Em refund: webhook PAYMENT_REFUNDED não precisa devolver o slot (decisão de
-- produto: slot consumido fica consumido). Se mudar, criar RPC `release_slot`.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Tabela promo_codes
-- ============================================================================
create table if not exists public.promo_codes (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null,
  plan_tier           text not null
                      check (plan_tier in ('start','evolucao','saude_completa','atleta')),
  promo_value_cents   int  not null check (promo_value_cents > 0),
  discount_cents      int  not null default 0,
  max_uses            int  not null check (max_uses > 0),
  uses_count          int  not null default 0,
  starts_at           timestamptz,
  ends_at             timestamptz,
  is_active           boolean not null default true,
  description         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (slug, plan_tier)
);

create index if not exists idx_promo_codes_active
  on public.promo_codes (slug, plan_tier)
  where is_active = true;

drop trigger if exists trg_promo_codes_updated_at on public.promo_codes;
create trigger trg_promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. RLS — só service_role (admin/server actions). Cliente lê pelo server.
-- ============================================================================
alter table public.promo_codes enable row level security;

drop policy if exists promo_codes_admin on public.promo_codes;
create policy promo_codes_admin on public.promo_codes
  for all to service_role using (true) with check (true);

drop policy if exists promo_codes_read_authenticated on public.promo_codes;
create policy promo_codes_read_authenticated on public.promo_codes
  for select to authenticated
  using (is_active = true);

-- ============================================================================
-- 3. RPC atômico de claim de slot
-- Retorna a linha consumida (com promo_value_cents) ou NULL se esgotado.
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
            pc.discount_cents, pc.uses_count, pc.max_uses;
end;
$$;

comment on function public.claim_promo_slot(text, text) is
  'Consome um slot da promoção (atômico via UPDATE RETURNING). NULL se esgotado/inativo.';

-- ============================================================================
-- 4. RPC apenas leitura: verifica disponibilidade SEM consumir
-- (usado por UI da landing pra mostrar "X vagas restantes" sem race)
-- ============================================================================
create or replace function public.peek_promo_slot(
  p_slug      text,
  p_plan_tier text
)
returns table (
  promo_value_cents int,
  discount_cents    int,
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
-- 5. Snapshot no profile (qual promo entrou)
-- ============================================================================
alter table public.profiles
  add column if not exists promo_code_id uuid references public.promo_codes(id);

-- ============================================================================
-- 6. Seed inicial: LANCAMENTO — 15 primeiros por plano
--    Atleta:          R$ 309,90 - R$ 25,00 = R$ 284,90
--    Saúde Completa:  R$  99,90 - R$ 20,00 = R$  79,90
--    Evolução (Perf): R$  74,90 - R$ 15,00 = R$  59,90 (nota: ficha do user dizia 75,90/60,90)
--    Treino (Start):  R$  39,90 - R$ 10,00 = R$  29,90
-- ============================================================================
insert into public.promo_codes
  (slug, plan_tier, promo_value_cents, discount_cents, max_uses, description, is_active)
values
  ('LANCAMENTO', 'atleta',         28490, 2500, 15, 'Promoção de lançamento - R$ 25,00 OFF Atleta',          true),
  ('LANCAMENTO', 'saude_completa',  7990, 2000, 15, 'Promoção de lançamento - R$ 20,00 OFF Saúde Completa',  true),
  ('LANCAMENTO', 'evolucao',        5990, 1500, 15, 'Promoção de lançamento - R$ 15,00 OFF Evolução',        true),
  ('LANCAMENTO', 'start',           2990, 1000, 15, 'Promoção de lançamento - R$ 10,00 OFF Treino',          true)
on conflict (slug, plan_tier) do nothing;

commit;
