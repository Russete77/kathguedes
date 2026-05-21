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

-- ============================================
-- 7. ALTER TABLE — atualizar tabelas existentes
-- ============================================

-- 7.1 plan_tier CHECK em todas as tabelas
alter table public.profiles
  drop constraint if exists profiles_plan_tier_check;
alter table public.profiles
  add  constraint profiles_plan_tier_check
       check (plan_tier in ('free','acesso','plano1','plano2','plano3','atleta'));

alter table public.workout_videos
  drop constraint if exists workout_videos_required_plan_check;
alter table public.workout_videos
  add  constraint workout_videos_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));
alter table public.workout_videos
  add column if not exists is_free_preview boolean not null default false;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_required_plan_check;
alter table public.affiliate_links
  add  constraint affiliate_links_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));

alter table public.coupons
  drop constraint if exists coupons_required_plan_check;
alter table public.coupons
  add  constraint coupons_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));
alter table public.coupons
  add column if not exists is_public_preview boolean not null default false;

-- moto_events pode não existir em todos os ambientes (criada em migration_fixes)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='moto_events') then
    execute 'alter table public.moto_events drop constraint if exists moto_events_required_plan_check';
    execute 'alter table public.moto_events add constraint moto_events_required_plan_check check (required_plan in (''free'',''acesso'',''plano1'',''plano2'',''plano3'',''atleta''))';
  end if;
end $$;

-- 7.2 cost_cents em produtos e estética; remover discount_*
alter table public.products
  add column if not exists cost_cents int not null default 0
      check (cost_cents >= 0);
alter table public.products
  drop column if exists discount_start,
  drop column if exists discount_pro,
  drop column if exists discount_vip;

alter table public.estetica_services
  add column if not exists cost_cents int not null default 0
      check (cost_cents >= 0);
alter table public.estetica_services
  add column if not exists requires_paid_plan boolean not null default false;
alter table public.estetica_services
  drop column if exists discount_start,
  drop column if exists discount_pro,
  drop column if exists discount_vip;

-- 7.3 cashback_used_cents em orders e estetica_bookings
alter table public.orders
  add column if not exists cashback_used_cents int not null default 0
      check (cashback_used_cents >= 0);

alter table public.estetica_bookings
  add column if not exists cashback_used_cents int not null default 0
      check (cashback_used_cents >= 0);

-- 7.4 messages.sender_role substitui is_from_kath
alter table public.messages
  add column if not exists sender_role text not null default 'user'
      check (sender_role in ('user','kath','sidney','admin'));

-- backfill: se existir is_from_kath ainda
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='messages' and column_name='is_from_kath') then
    execute 'update public.messages set sender_role = case when is_from_kath then ''kath'' else ''user'' end where sender_role = ''user''';
    execute 'alter table public.messages drop column is_from_kath';
  end if;
end $$;

-- Reescrever policy de messages: agora plan_tier IN ('plano3','atleta')
drop policy if exists messages_insert_vip on public.messages;
drop policy if exists messages_insert_chat on public.messages;
create policy messages_insert_chat on public.messages
  for insert to authenticated
  with check (
    (select auth.jwt()->>'sub') = user_id
    and sender_role = 'user'
    and (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        in ('plano3','atleta')
  );

-- 7.5 Trigger updated_at em plans (admin pode editar)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- ============================================
-- 8. FUNÇÕES SQL
-- ============================================

-- 8.1 plan_tier_level dinâmico (lookup em plans)
create or replace function public.plan_tier_level(tier text) returns int
language sql stable as $$
  select coalesce((select level from public.plans where slug = tier), 0)
$$;

-- 8.2 compute_cashback_cents
create or replace function public.compute_cashback_cents(
  p_user_id text,
  p_amount_paid_cash_cents int
) returns int
language sql stable as $$
  select greatest(0, round(p_amount_paid_cash_cents * coalesce((
    select p.cashback_pct
    from public.plans p
    join public.profiles pr on pr.plan_tier = p.slug
    where pr.id = p_user_id
  ), 0) / 100.0))::int
$$;

-- 8.3 wallet_active_cents
create or replace function public.wallet_active_cents(p_user_id text) returns int
language sql stable as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.wallet_credits
  where user_id = p_user_id
    and used_at is null
    and (expires_at is null or expires_at > now())
$$;

-- 8.4 spend_wallet_cents (FIFO com lock)
create or replace function public.spend_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_revenue_stream_id uuid default null
) returns int
language plpgsql security definer as $$
declare
  v_remaining int := p_amount_cents;
  v_credit record;
  v_used_total int := 0;
begin
  if p_amount_cents <= 0 then return 0; end if;

  for v_credit in
    select id, amount_cents
    from public.wallet_credits
    where user_id = p_user_id
      and used_at is null
      and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    if v_credit.amount_cents <= v_remaining then
      update public.wallet_credits
        set used_at = now(), spent_on_revenue_stream_id = p_revenue_stream_id
        where id = v_credit.id;
      v_remaining := v_remaining - v_credit.amount_cents;
      v_used_total := v_used_total + v_credit.amount_cents;
    else
      update public.wallet_credits
        set amount_cents = amount_cents - v_remaining
        where id = v_credit.id;
      insert into public.wallet_credits
        (user_id, amount_cents, used_at, spent_on_revenue_stream_id)
      values
        (p_user_id, -v_remaining, now(), p_revenue_stream_id);
      v_used_total := v_used_total + v_remaining;
      v_remaining := 0;
    end if;
  end loop;

  insert into public.wallet_balance (user_id, spent_total_cents, active_cents)
  values (p_user_id, v_used_total, -v_used_total)
  on conflict (user_id) do update
    set spent_total_cents = wallet_balance.spent_total_cents + v_used_total,
        active_cents      = wallet_balance.active_cents - v_used_total,
        updated_at        = now();

  return v_used_total;
end;
$$;

-- 8.5 credit_wallet_cents
create or replace function public.credit_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_source_stream_id uuid,
  p_validity_days int default 120
) returns void
language plpgsql security definer as $$
begin
  if p_amount_cents <= 0 then return; end if;

  insert into public.wallet_credits
    (user_id, source_revenue_stream_id, amount_cents, expires_at)
  values
    (p_user_id, p_source_stream_id, p_amount_cents, now() + (p_validity_days || ' days')::interval);

  insert into public.wallet_balance (user_id, active_cents, earned_total_cents)
  values (p_user_id, p_amount_cents, p_amount_cents)
  on conflict (user_id) do update
    set active_cents       = wallet_balance.active_cents + p_amount_cents,
        earned_total_cents = wallet_balance.earned_total_cents + p_amount_cents,
        updated_at         = now();
end;
$$;

-- 8.6 expire_wallet_credits
create or replace function public.expire_wallet_credits() returns int
language plpgsql security definer as $$
declare
  v_total int := 0;
  v_user record;
begin
  for v_user in
    select user_id, sum(amount_cents) as total
    from public.wallet_credits
    where used_at is null and expires_at < now()
    group by user_id
  loop
    update public.wallet_credits
      set used_at = now()
      where user_id = v_user.user_id and used_at is null and expires_at < now();
    update public.wallet_balance
      set active_cents = active_cents - v_user.total,
          expired_total_cents = expired_total_cents + v_user.total,
          updated_at = now()
      where user_id = v_user.user_id;
    v_total := v_total + v_user.total;
  end loop;
  return v_total;
end;
$$;

-- 8.7 compute_commissions
create or replace function public.compute_commissions(p_revenue_stream_id uuid) returns int
language plpgsql security definer as $$
declare
  v_stream record;
  v_rule record;
  v_owner_id uuid;
  v_explicit_total int := 0;
  v_explicit_pct numeric := 0;
  v_owner_amount int;
  v_owner_pct numeric;
  v_count int := 0;
  v_amount int;
begin
  select * into v_stream from public.revenue_streams where id = p_revenue_stream_id;
  if not found or v_stream.status <> 'confirmed' then return 0; end if;

  for v_rule in
    select cr.team_member_id, cr.pct
    from public.commission_rules cr
    join public.team_members tm on tm.id = cr.team_member_id
    where cr.is_active = true
      and tm.is_active = true
      and tm.role <> 'owner'
      and (cr.applies_from <= now())
      and (cr.applies_to is null or cr.applies_to > now())
      and (cr.applies_to_type is null or cr.applies_to_type = v_stream.type)
      and (cr.applies_to_category is null or cr.applies_to_category = v_stream.category)
    order by
      (cr.applies_to_type is not null) desc,
      (cr.applies_to_category is not null) desc
  loop
    v_amount := round(v_stream.net_cents * v_rule.pct / 100.0)::int;
    insert into public.commission_allocations
      (revenue_stream_id, team_member_id, pct, amount_cents)
    values
      (p_revenue_stream_id, v_rule.team_member_id, v_rule.pct, v_amount)
    on conflict (revenue_stream_id, team_member_id) do nothing;
    v_explicit_total := v_explicit_total + v_amount;
    v_explicit_pct   := v_explicit_pct + v_rule.pct;
    v_count := v_count + 1;
  end loop;

  select id into v_owner_id from public.team_members
    where role = 'owner' and is_active = true limit 1;
  if v_owner_id is not null then
    v_owner_amount := v_stream.net_cents - v_explicit_total - v_stream.cashback_used_cents;
    v_owner_pct    := 100 - v_explicit_pct;
    insert into public.commission_allocations
      (revenue_stream_id, team_member_id, pct, amount_cents)
    values
      (p_revenue_stream_id, v_owner_id, v_owner_pct, v_owner_amount)
    on conflict (revenue_stream_id, team_member_id) do nothing;
    v_count := v_count + 1;
  end if;

  return v_count;
end;
$$;

-- 8.8 decrement_stock_batch / increment_stock_batch (usadas pelo /api/loja/checkout)
create or replace function public.decrement_stock_batch(p_items jsonb)
returns void language plpgsql security definer as $$
declare
  v_item record;
begin
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    update public.products
      set stock = stock - v_item.quantity
      where id = v_item.product_id and stock >= v_item.quantity;
    if not found then
      raise exception 'out_of_stock_or_invalid: %', v_item.product_id;
    end if;
  end loop;
end;
$$;

create or replace function public.increment_stock_batch(p_items jsonb)
returns void language plpgsql security definer as $$
declare
  v_item record;
begin
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;
end;
$$;

commit;
