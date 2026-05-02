-- ============================================
-- KATHAPP — Modelo Financeiro v1.0 (2026-05-02)
-- Spec: docs/superpowers/specs/2026-05-02-modelo-financeiro-design.md
-- ============================================
-- Idempotente: usa IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- Pré-condição: zero assinantes pagos (refatoração livre)

begin;

-- ============================================
-- 1. PLANS — Configuração admin-editável de tiers
-- ============================================

create table if not exists public.plans (
  slug                  text primary key,
  name                  text not null,
  level                 int not null unique,
  price_cents           int not null,
  asaas_value           numeric(10,2) not null,
  asaas_description     text not null,
  cashback_pct          numeric(5,2) not null default 0
                        check (cashback_pct between 0 and 100),
  store_discount_pct    int not null default 0
                        check (store_discount_pct between 0 and 100),
  estetica_discount_pct int not null default 0
                        check (estetica_discount_pct between 0 and 100),
  features              jsonb not null default '{}'::jsonb,
  is_active             boolean not null default true,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated on public.plans
  for select to authenticated using (is_active = true);

drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans
  for all to service_role using (true) with check (true);

create index if not exists idx_plans_level on public.plans(level);

-- Seed
insert into public.plans (slug, name, level, price_cents, asaas_value, asaas_description, cashback_pct, store_discount_pct, estetica_discount_pct, features, sort_order) values
  ('free',   'Free',                       0,      0,   0.00, '', 0,  0,  0,
   '{"workouts_preview":3,"affiliate_clicks_per_month":3}'::jsonb, 0),
  ('acesso', 'Acesso',                     1,   1990,  19.90,
   'KathApp Acesso — Cupons + Afiliados + Estética', 2,  5,  5,
   '{"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 1),
  ('plano1', 'Plano 1 — Treino',           2,   3990,  39.90,
   'KathApp Plano 1 — Treinos completos', 3,  8,  7,
   '{"workouts":true,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 2),
  ('plano2', 'Plano 2 — Treino + Dieta',   3,   7490,  74.90,
   'KathApp Plano 2 — Treinos + Dieta', 5, 12, 10,
   '{"workouts":true,"diet":true,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 3),
  ('plano3', 'Plano 3 — Saúde Completa',   4,   9990,  99.90,
   'KathApp Plano 3 — Saúde + Acompanhamento', 7, 18, 12,
   '{"workouts":true,"diet":true,"supplements":true,"chat_sla_h":48,"reavaliation":"monthly","estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 4),
  ('atleta', 'Atleta',                     5,  30990, 309.90,
   'KathApp Atleta — Premium completo', 10, 25, 15,
   '{"workouts":true,"diet":true,"supplements":true,"juices":true,"chat_sla_h":12,"reavaliation":"biweekly","video_call_per_month":1,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 5)
on conflict (slug) do nothing;

-- ============================================
-- 2. TEAM_MEMBERS — Russo, Sidney, Kath, futuros
-- ============================================

create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text unique,
  email           text unique not null,
  full_name       text not null,
  role            text not null
                  check (role in ('owner','partner','consultant')),
  pix_key         text,
  bank_account    jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.team_members enable row level security;

drop policy if exists team_members_admin on public.team_members;
create policy team_members_admin on public.team_members
  for all to service_role using (true) with check (true);

insert into public.team_members (email, full_name, role) values
  ('kath@kathapp.com.br',   'Kath Guedes', 'owner'),
  ('russo@kathapp.com.br',  'Russo',       'partner'),
  ('sidney@kathapp.com.br', 'Sidney',      'partner')
on conflict (email) do nothing;

-- ============================================
-- 3. COMMISSION_RULES + ALLOCATIONS
-- ============================================

create table if not exists public.commission_rules (
  id                    uuid primary key default gen_random_uuid(),
  team_member_id        uuid not null references public.team_members(id) on delete cascade,
  applies_to_type       text check (applies_to_type in ('mensalidade','loja','estetica','afiliado_externo')),
  applies_to_category   text,
  pct                   numeric(5,2) not null check (pct >= 0 and pct <= 100),
  applies_from          timestamptz not null default now(),
  applies_to            timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

alter table public.commission_rules enable row level security;

drop policy if exists commission_rules_admin on public.commission_rules;
create policy commission_rules_admin on public.commission_rules
  for all to service_role using (true) with check (true);

create index if not exists idx_commission_rules_lookup
  on public.commission_rules(applies_to_type, applies_to_category, is_active);

create table if not exists public.commission_allocations (
  id                  uuid primary key default gen_random_uuid(),
  revenue_stream_id   uuid not null,
  team_member_id      uuid not null references public.team_members(id) on delete restrict,
  pct                 numeric(5,2) not null,
  amount_cents        int not null,
  status              text not null default 'draft'
                      check (status in ('draft','approved','paid','failed')),
  paid_at             timestamptz,
  payout_reference    text,
  created_at          timestamptz not null default now()
);

alter table public.commission_allocations enable row level security;

drop policy if exists commission_allocations_admin on public.commission_allocations;
create policy commission_allocations_admin on public.commission_allocations
  for all to service_role using (true) with check (true);

create index if not exists idx_commission_alloc_member
  on public.commission_allocations(team_member_id, status);
create unique index if not exists uniq_alloc_per_stream_member
  on public.commission_allocations(revenue_stream_id, team_member_id);

create unique index if not exists uniq_commission_rule_dedup
  on public.commission_rules(
    team_member_id,
    coalesce(applies_to_type, ''),
    coalesce(applies_to_category, ''),
    is_active
  );

-- Seed de regras (idempotente via UNIQUE INDEX uniq_commission_rule_dedup)
do $$
declare
  v_russo  uuid;
  v_sidney uuid;
begin
  select id into v_russo  from public.team_members where email='russo@kathapp.com.br';
  select id into v_sidney from public.team_members where email='sidney@kathapp.com.br';

  if v_russo is not null then
    insert into public.commission_rules (team_member_id, pct) values (v_russo, 25)
      on conflict (team_member_id, coalesce(applies_to_type, ''), coalesce(applies_to_category, ''), is_active) do nothing;
  end if;

  if v_sidney is not null then
    insert into public.commission_rules (team_member_id, applies_to_type, applies_to_category, pct) values
      (v_sidney, 'mensalidade', 'plano1', 30),
      (v_sidney, 'mensalidade', 'plano2', 30),
      (v_sidney, 'mensalidade', 'plano3', 30),
      (v_sidney, 'mensalidade', 'atleta', 30)
    on conflict (team_member_id, coalesce(applies_to_type, ''), coalesce(applies_to_category, ''), is_active) do nothing;
  end if;
end $$;

-- ============================================
-- 4. REVENUE_STREAMS
-- ============================================

create table if not exists public.revenue_streams (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null
                      check (type in ('mensalidade','loja','estetica','afiliado_externo')),
  category            text,
  user_id             text references public.profiles(id),
  reference_type      text not null
                      check (reference_type in ('subscription','order','booking','affiliate_payout')),
  reference_id        text not null,
  asaas_payment_id    text,
  gross_cents         int  not null check (gross_cents >= 0),
  cost_cents          int  not null default 0 check (cost_cents >= 0 and cost_cents <= gross_cents),
  net_cents           int  generated always as (gross_cents - cost_cents) stored,
  cashback_used_cents int  not null default 0 check (cashback_used_cents >= 0),
  status              text not null default 'confirmed'
                      check (status in ('pending','confirmed','refunded')),
  occurred_at         timestamptz not null,
  created_at          timestamptz not null default now()
);

alter table public.revenue_streams enable row level security;

drop policy if exists revenue_streams_admin on public.revenue_streams;
create policy revenue_streams_admin on public.revenue_streams
  for all to service_role using (true) with check (true);

create index if not exists idx_revenue_streams_type
  on public.revenue_streams(type, occurred_at desc);
create index if not exists idx_revenue_streams_user
  on public.revenue_streams(user_id, occurred_at desc);
create index if not exists idx_revenue_streams_status
  on public.revenue_streams(status);
create index if not exists idx_revenue_streams_asaas
  on public.revenue_streams(asaas_payment_id)
  where asaas_payment_id is not null;

-- FK retroativa em commission_allocations
alter table public.commission_allocations
  drop constraint if exists commission_allocations_revenue_stream_id_fkey,
  add  constraint commission_allocations_revenue_stream_id_fkey
       foreign key (revenue_stream_id)
       references public.revenue_streams(id) on delete cascade;

-- ============================================
-- 5. WALLET — créditos + saldo
-- ============================================

create table if not exists public.wallet_credits (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     text not null references public.profiles(id) on delete cascade,
  source_revenue_stream_id    uuid references public.revenue_streams(id),
  spent_on_revenue_stream_id  uuid references public.revenue_streams(id),
  amount_cents                int  not null,
  expires_at                  timestamptz,
  used_at                     timestamptz,
  created_at                  timestamptz not null default now()
);

alter table public.wallet_credits enable row level security;

drop policy if exists wallet_credits_select_own on public.wallet_credits;
create policy wallet_credits_select_own on public.wallet_credits
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wallet_credits_admin on public.wallet_credits;
create policy wallet_credits_admin on public.wallet_credits
  for all to service_role using (true) with check (true);

create index if not exists idx_wallet_credits_user_active
  on public.wallet_credits(user_id, expires_at)
  where used_at is null;

create table if not exists public.wallet_balance (
  user_id              text primary key references public.profiles(id) on delete cascade,
  active_cents         int not null default 0,
  earned_total_cents   int not null default 0,
  spent_total_cents    int not null default 0,
  expired_total_cents  int not null default 0,
  updated_at           timestamptz not null default now()
);

alter table public.wallet_balance enable row level security;

drop policy if exists wallet_balance_select_own on public.wallet_balance;
create policy wallet_balance_select_own on public.wallet_balance
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wallet_balance_admin on public.wallet_balance;
create policy wallet_balance_admin on public.wallet_balance
  for all to service_role using (true) with check (true);

-- ============================================
-- 6. MONTHLY_USAGE — limites do FREE
-- ============================================

create table if not exists public.monthly_usage (
  user_id                 text not null references public.profiles(id) on delete cascade,
  year_month              text not null check (year_month ~ '^\d{4}-\d{2}$'),
  affiliate_clicks_count  int  not null default 0,
  primary key (user_id, year_month)
);

alter table public.monthly_usage enable row level security;

drop policy if exists monthly_usage_select_own on public.monthly_usage;
create policy monthly_usage_select_own on public.monthly_usage
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists monthly_usage_admin on public.monthly_usage;
create policy monthly_usage_admin on public.monthly_usage
  for all to service_role using (true) with check (true);

-- (continua na próxima task)
commit;
