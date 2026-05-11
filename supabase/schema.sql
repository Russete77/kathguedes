-- ============================================================================
-- KATHAPP — SCHEMA CONSOLIDADO v2.0 (2026-05-11)
-- ============================================================================
-- Snapshot completo do estado real do banco em produção, depois de aplicar
-- TODAS as migrations em supabase/migration_*.sql na ordem cronológica.
--
-- IMPORTANTE
-- ──────────
-- Este arquivo serve para bootstrap de um ambiente NOVO (dev / staging /
-- recriar do zero). Para mudanças incrementais em prod, **continue criando
-- novos migration_*.sql** — não edite este arquivo a cada feature.
-- Quando uma migration for aplicada com sucesso em prod, faça um snapshot
-- novo deste arquivo (idealmente via `pg_dump --schema-only` ou re-executando
-- migrations num banco limpo).
--
-- Stack: Supabase Postgres + Clerk Third-Party Auth.
-- RLS: ativada em todas as tabelas. JWT do Clerk via `auth.jwt()->>'sub'`.
-- Idempotente: usa IF NOT EXISTS / OR REPLACE / DROP IF EXISTS quando útil.
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTENSIONS & HELPERS
-- ============================================================================

create extension if not exists "pgcrypto";

-- updated_at trigger reutilizável
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 2. PROFILES — Usuários (PK = clerk user_id)
-- ============================================================================

create table if not exists public.profiles (
  id                    text primary key,                       -- Clerk user_id (user_xxx)
  full_name             text not null,
  avatar_url            text,
  phone                 text,
  plan_tier             text not null default 'free'
                        check (plan_tier in ('free','acesso','plano1','plano2','plano3','atleta')),
  asaas_customer_id     text unique,
  asaas_subscription_id text,
  subscription_status   text not null default 'active'
                        check (subscription_status in ('active','past_due','canceled')),
  subscription_ends_at  timestamptz,
  workout_streak        int  not null default 0,
  last_workout_at       timestamptz,
  interests             text[] not null default '{}',
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.jwt()->>'sub') = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.jwt()->>'sub') = id)
  with check ((select auth.jwt()->>'sub') = id);

drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles
  for all to service_role using (true) with check (true);

create index if not exists idx_profiles_plan_tier on public.profiles(plan_tier);
create index if not exists idx_profiles_onboarding on public.profiles(onboarding_completed) where onboarding_completed = false;

-- ============================================================================
-- 3. PLANS — Tiers admin-editáveis (fonte de verdade para preço/feature)
-- ============================================================================

create table if not exists public.plans (
  slug                  text primary key,
  name                  text not null,
  level                 int  not null unique,
  price_cents           int  not null,
  asaas_value           numeric(10,2) not null,
  asaas_description     text not null,
  cashback_pct          numeric(5,2) not null default 0 check (cashback_pct between 0 and 100),
  store_discount_pct    int  not null default 0 check (store_discount_pct between 0 and 100),
  estetica_discount_pct int  not null default 0 check (estetica_discount_pct between 0 and 100),
  features              jsonb not null default '{}'::jsonb,
  is_active             boolean not null default true,
  sort_order            int  not null default 0,
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

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Seed inicial
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

-- Helper SQL: plan_tier_level dinâmico (lookup em plans)
create or replace function public.plan_tier_level(tier text) returns int
language sql stable as $$
  select coalesce((select level from public.plans where slug = tier), 0)
$$;

-- ============================================================================
-- 4. WORKOUT_VIDEOS — Treinos
-- ============================================================================

create table if not exists public.workout_videos (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  notes            text,
  youtube_id       text not null,
  category         text not null
                   check (category in (
                     'gluteo','pernas','costas','ombro','biceps','triceps',
                     'peito','abdomen','superior','hiit','cardio','funcional',
                     'full','alongamento','aquecimento','viagem','competicao'
                   )),
  level            text not null
                   check (level in ('iniciante','intermediario','avancado')),
  duration_minutes int  not null,
  required_plan    text not null default 'free'
                   check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta')),
  thumbnail_url    text,
  views_count      int  not null default 0,
  is_published     boolean not null default false,
  is_short         boolean not null default false,
  is_free_preview  boolean not null default false,
  equipment        text[],
  published_at     timestamptz
);

alter table public.workout_videos enable row level security;

drop policy if exists workouts_select_by_plan on public.workout_videos;
create policy workouts_select_by_plan on public.workout_videos
  for select to authenticated
  using (
    is_published = true
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

drop policy if exists workouts_admin on public.workout_videos;
create policy workouts_admin on public.workout_videos
  for all to service_role using (true) with check (true);

create index if not exists idx_workout_videos_category on public.workout_videos(category);
create index if not exists idx_workout_videos_published on public.workout_videos(is_published, published_at desc);

-- ============================================================================
-- 5. CONSULTATIONS — Consultorias (in-app, sem PDF)
-- ============================================================================

create table if not exists public.consultations (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references public.profiles(id),
  package_type     text not null
                   check (package_type in ('mensal','trimestral','premium','assessoria')),
  status           text not null default 'pending'
                   check (status in ('pending','in_progress','delivered','expired')),
  anamnesis        jsonb,
  workout_plan     jsonb,
  diet_plan        jsonb,
  daily_calories   int,
  daily_protein    int,
  daily_carbs      int,
  daily_fat        int,
  notes_admin      text,
  valid_until      timestamptz not null,
  created_at       timestamptz not null default now()
);

alter table public.consultations enable row level security;

drop policy if exists consultations_select_own on public.consultations;
create policy consultations_select_own on public.consultations
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists consultations_insert_own on public.consultations;
create policy consultations_insert_own on public.consultations
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists consultations_update_own on public.consultations;
create policy consultations_update_own on public.consultations
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists consultations_admin on public.consultations;
create policy consultations_admin on public.consultations
  for all to service_role using (true) with check (true);

create index if not exists idx_consultations_user on public.consultations(user_id);
create index if not exists idx_consultations_status on public.consultations(status);
create index if not exists idx_consultations_anamnesis on public.consultations((anamnesis is not null));

-- ============================================================================
-- 6. WORKOUT_LOGS — Histórico de treinos
-- ============================================================================

create table if not exists public.workout_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null default (auth.jwt()->>'sub') references public.profiles(id),
  workout_id      uuid not null references public.workout_videos(id),
  completed_at    timestamptz not null default now(),
  duration_actual int
);

alter table public.workout_logs enable row level security;

drop policy if exists logs_select_own on public.workout_logs;
create policy logs_select_own on public.workout_logs
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists logs_insert_own on public.workout_logs;
create policy logs_insert_own on public.workout_logs
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists logs_admin on public.workout_logs;
create policy logs_admin on public.workout_logs
  for all to service_role using (true) with check (true);

create index if not exists idx_workout_logs_user on public.workout_logs(user_id);
create index if not exists idx_workout_logs_completed on public.workout_logs(completed_at desc);

-- ============================================================================
-- 7. AFFILIATE_LINKS — Produtos afiliados
-- ============================================================================

create table if not exists public.affiliate_links (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  image_url     text not null,
  module        text not null check (module in ('fitness','moto')),
  category      text not null,
  platform      text not null check (platform in ('amazon','mercadolivre','shopee','direto')),
  affiliate_url text not null,
  required_plan text not null default 'free'
                check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta')),
  clicks_count  int  not null default 0,
  is_active     boolean not null default true,
  sort_order    int  not null default 0
);

alter table public.affiliate_links enable row level security;

drop policy if exists affiliates_select_by_plan on public.affiliate_links;
create policy affiliates_select_by_plan on public.affiliate_links
  for select to authenticated
  using (
    is_active = true
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

drop policy if exists affiliates_admin on public.affiliate_links;
create policy affiliates_admin on public.affiliate_links
  for all to service_role using (true) with check (true);

create index if not exists idx_affiliate_links_module on public.affiliate_links(module, is_active);

-- ============================================================================
-- 8. COUPONS — Cupons e rastreio por user
-- ============================================================================

create table if not exists public.coupons (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  code               text unique not null,
  discount_pct       int,
  partner_name       text not null,
  partner_url        text not null,
  module             text not null check (module in ('fitness','moto','geral')),
  required_plan      text not null default 'free'
                     check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta')),
  max_uses           int,
  uses_count         int  not null default 0,
  valid_until        timestamptz not null,
  is_flash           boolean not null default false,
  is_public_preview  boolean not null default false,
  is_active          boolean not null default true
);

alter table public.coupons enable row level security;

drop policy if exists coupons_select_by_plan on public.coupons;
create policy coupons_select_by_plan on public.coupons
  for select to authenticated
  using (
    is_active = true
    and valid_until > now()
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons
  for all to service_role using (true) with check (true);

create index if not exists idx_coupons_module on public.coupons(module, is_active);
create index if not exists idx_coupons_valid on public.coupons(valid_until);

create table if not exists public.coupon_uses (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  user_id    text not null references public.profiles(id) on delete cascade,
  used_at    timestamptz not null default now(),
  unique (coupon_id, user_id)
);

alter table public.coupon_uses enable row level security;

drop policy if exists coupon_uses_select_own on public.coupon_uses;
create policy coupon_uses_select_own on public.coupon_uses
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists coupon_uses_insert_own on public.coupon_uses;
create policy coupon_uses_insert_own on public.coupon_uses
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists coupon_uses_admin on public.coupon_uses;
create policy coupon_uses_admin on public.coupon_uses
  for all to service_role using (true) with check (true);

create index if not exists idx_coupon_uses_user on public.coupon_uses(user_id);
create index if not exists idx_coupon_uses_coupon on public.coupon_uses(coupon_id);

-- ============================================================================
-- 9. MESSAGES — Chat VIP (planos plano3/atleta)
-- ============================================================================

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default (auth.jwt()->>'sub') references public.profiles(id),
  body         text not null,
  sender_role  text not null default 'user'
               check (sender_role in ('user','kath','sidney','admin')),
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists messages_insert_chat on public.messages;
create policy messages_insert_chat on public.messages
  for insert to authenticated
  with check (
    (select auth.jwt()->>'sub') = user_id
    and sender_role = 'user'
    and (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        in ('plano3','atleta')
  );

drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages
  for all to service_role using (true) with check (true);

create index if not exists idx_messages_user on public.messages(user_id, created_at desc);
create index if not exists idx_messages_user_is_read on public.messages(user_id, is_read);

-- ============================================================================
-- 10. PRODUCTS / ORDERS — Loja
-- ============================================================================

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  image_url       text not null,
  price_cents     int  not null,
  cost_cents      int  not null default 0 check (cost_cents >= 0),
  compare_price   int,
  category        text not null,
  module          text not null default 'geral' check (module in ('fitness','moto','geral')),
  variants        jsonb not null default '[]',
  stock           int  not null default 0,
  weight_kg       numeric(6,2) default 0.5,
  height_cm       integer default 10,
  width_cm        integer default 20,
  length_cm       integer default 30,
  is_active       boolean not null default true,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists products_select_active on public.products;
create policy products_select_active on public.products
  for select to authenticated using (is_active = true);

drop policy if exists products_admin on public.products;
create policy products_admin on public.products
  for all to service_role using (true) with check (true);

create index if not exists idx_products_active on public.products(is_active, sort_order);

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               text not null references public.profiles(id),
  status                text not null default 'pending'
                        check (status in ('pending','paid','shipped','delivered','canceled')),
  items                 jsonb not null,
  subtotal_cents        int not null,
  discount_cents        int not null default 0,
  shipping_cost_cents   int not null default 0,
  shipping_method       text,
  estimated_delivery    text,
  shipping_label_url    text,
  melhor_envio_order_id text,
  total_cents           int not null,
  cashback_used_cents   int not null default 0 check (cashback_used_cents >= 0),
  shipping_info         jsonb,
  tracking_code         text,
  asaas_payment_id      text,
  payment_method        text,
  payment_id            text,
  paid_at               timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders
  for all to service_role using (true) with check (true);

create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_user_status on public.orders(user_id, status);
create index if not exists idx_orders_asaas_payment on public.orders(asaas_payment_id) where asaas_payment_id is not null;
create index if not exists idx_orders_asaas_payment_id on public.orders(asaas_payment_id) where asaas_payment_id is not null;
create index if not exists idx_orders_shipping_method on public.orders(shipping_method) where shipping_method is not null;

-- ============================================================================
-- 11. PUSH SUBSCRIPTIONS + NOTIFICATIONS
-- ============================================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references public.profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_select_own on public.push_subscriptions;
create policy push_select_own on public.push_subscriptions
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists push_insert_own on public.push_subscriptions;
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists push_admin on public.push_subscriptions;
create policy push_admin on public.push_subscriptions
  for all to service_role using (true) with check (true);

create index if not exists idx_push_user on public.push_subscriptions(user_id);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  icon       text,
  url        text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists notif_admin on public.notifications;
create policy notif_admin on public.notifications
  for all to service_role using (true) with check (true);

create index if not exists idx_notif_user on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_notifications_created_at on public.notifications(user_id, created_at desc);

-- ============================================================================
-- 12. PLAN_TEMPLATES — Templates de treino/dieta editáveis no admin
-- ============================================================================

create table if not exists public.plan_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('workout','diet')),
  description text,
  data        jsonb not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.plan_templates enable row level security;

drop policy if exists templates_admin on public.plan_templates;
create policy templates_admin on public.plan_templates
  for all to service_role using (true) with check (true);

create index if not exists idx_plan_templates_type on public.plan_templates(type, is_active);

-- ============================================================================
-- 13. WEBHOOK_EVENTS — Idempotência (admin-only)
-- ============================================================================

create table if not exists public.webhook_events (
  payment_id   text primary key,
  event        text not null,
  processed_at timestamptz default now()
);

alter table public.webhook_events enable row level security;

drop policy if exists webhook_events_admin on public.webhook_events;
create policy webhook_events_admin on public.webhook_events
  for all to service_role using (true) with check (true);

drop policy if exists webhook_events_deny_authenticated on public.webhook_events;
create policy webhook_events_deny_authenticated on public.webhook_events
  for all to authenticated using (false) with check (false);

-- ============================================================================
-- 14. MOTO_EVENTS / CHALLENGES
-- ============================================================================

create table if not exists public.moto_events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,
  event_date            timestamptz not null,
  location              text,
  location_url          text,
  image_url             text,
  max_participants      int,
  current_participants  int  default 0,
  required_plan         text default 'free'
                        check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta')),
  is_active             boolean default true,
  created_at            timestamptz default now()
);

alter table public.moto_events enable row level security;

drop policy if exists moto_events_authenticated on public.moto_events;
create policy moto_events_authenticated on public.moto_events
  for select to authenticated using (is_active = true);

drop policy if exists moto_events_admin on public.moto_events;
create policy moto_events_admin on public.moto_events
  for all to service_role using (true) with check (true);

create index if not exists idx_moto_events_date on public.moto_events(event_date desc);

create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  type          text not null check (type in ('streak','volume','custom')),
  target_value  int  not null,
  start_date    timestamptz not null,
  end_date      timestamptz not null,
  reward_text   text,
  image_url     text,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

alter table public.challenges enable row level security;

drop policy if exists challenges_authenticated on public.challenges;
create policy challenges_authenticated on public.challenges
  for select to authenticated using (is_active = true);

drop policy if exists challenges_admin on public.challenges;
create policy challenges_admin on public.challenges
  for all to service_role using (true) with check (true);

create table if not exists public.challenge_participants (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  user_id       text not null references public.profiles(id) on delete cascade,
  current_value int  default 0,
  completed_at  timestamptz,
  joined_at     timestamptz default now(),
  unique (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

drop policy if exists challenge_participants_select_own on public.challenge_participants;
create policy challenge_participants_select_own on public.challenge_participants
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists challenge_participants_insert_own on public.challenge_participants;
create policy challenge_participants_insert_own on public.challenge_participants
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists challenge_participants_update_own on public.challenge_participants;
create policy challenge_participants_update_own on public.challenge_participants
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists challenge_participants_admin on public.challenge_participants;
create policy challenge_participants_admin on public.challenge_participants
  for all to service_role using (true) with check (true);

-- ============================================================================
-- 15. KATH ESTÉTICA — Serviços / Agendamentos / Schedule / Portfólio / Fidelidade
-- ============================================================================

create table if not exists public.estetica_services (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  image_url       text,
  category        text not null
                  check (category in ('lavagem','polimento','vitrificacao','higienizacao','cristalizacao','outros')),
  duration_min    int  not null default 60,
  price_cents     int  not null,
  cost_cents      int  not null default 0 check (cost_cents >= 0),
  compare_price   int,
  includes        text[] not null default '{}',
  eligible_for_loyalty boolean not null default true,
  requires_paid_plan   boolean not null default false,
  is_active       boolean not null default true,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.estetica_services enable row level security;

drop policy if exists estetica_services_select_active on public.estetica_services;
create policy estetica_services_select_active on public.estetica_services
  for select to authenticated using (is_active = true);

drop policy if exists estetica_services_admin on public.estetica_services;
create policy estetica_services_admin on public.estetica_services
  for all to service_role using (true) with check (true);

create index if not exists idx_estetica_services_active on public.estetica_services(is_active, sort_order);
create index if not exists idx_estetica_services_category on public.estetica_services(category);

create table if not exists public.estetica_schedule (
  day_of_week  int primary key check (day_of_week between 0 and 6),
  opens_at     time,
  closes_at    time,
  is_closed    boolean not null default false,
  slot_minutes int  not null default 60
);

alter table public.estetica_schedule enable row level security;

drop policy if exists estetica_schedule_select_all on public.estetica_schedule;
create policy estetica_schedule_select_all on public.estetica_schedule
  for select to authenticated using (true);

drop policy if exists estetica_schedule_admin on public.estetica_schedule;
create policy estetica_schedule_admin on public.estetica_schedule
  for all to service_role using (true) with check (true);

insert into public.estetica_schedule (day_of_week, opens_at, closes_at, is_closed, slot_minutes) values
  (0, null, null, true, 60),
  (1, null, null, true, 60),
  (2, '08:00', '18:00', false, 60),
  (3, '08:00', '18:00', false, 60),
  (4, '08:00', '18:00', false, 60),
  (5, '08:00', '18:00', false, 60),
  (6, '08:00', '17:00', false, 60)
on conflict (day_of_week) do nothing;

create table if not exists public.estetica_slots_blocked (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.estetica_slots_blocked enable row level security;

drop policy if exists estetica_slots_blocked_select_all on public.estetica_slots_blocked;
create policy estetica_slots_blocked_select_all on public.estetica_slots_blocked
  for select to authenticated using (true);

drop policy if exists estetica_slots_blocked_admin on public.estetica_slots_blocked;
create policy estetica_slots_blocked_admin on public.estetica_slots_blocked
  for all to service_role using (true) with check (true);

create index if not exists idx_estetica_slots_blocked_range on public.estetica_slots_blocked(starts_at, ends_at);

create table if not exists public.estetica_bookings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null references public.profiles(id),
  service_id          uuid not null references public.estetica_services(id),
  scheduled_at        timestamptz not null,
  duration_min        int  not null,
  vehicle_brand       text not null,
  vehicle_model       text not null,
  vehicle_plate       text not null,
  vehicle_color       text,
  customer_name       text not null,
  customer_phone      text not null,
  status              text not null default 'pending'
                      check (status in ('pending','confirmed','in_progress','done','canceled','no_show')),
  price_cents         int  not null,
  plan_discount_cents int  not null default 0,
  loyalty_free        boolean not null default false,
  total_cents         int  not null,
  cashback_used_cents int  not null default 0 check (cashback_used_cents >= 0),
  asaas_payment_id    text,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.estetica_bookings enable row level security;

drop policy if exists estetica_bookings_select_own on public.estetica_bookings;
create policy estetica_bookings_select_own on public.estetica_bookings
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists estetica_bookings_admin on public.estetica_bookings;
create policy estetica_bookings_admin on public.estetica_bookings
  for all to service_role using (true) with check (true);

create index if not exists idx_estetica_bookings_user on public.estetica_bookings(user_id, created_at desc);
create index if not exists idx_estetica_bookings_status on public.estetica_bookings(status);
create index if not exists idx_estetica_bookings_scheduled on public.estetica_bookings(scheduled_at);
create index if not exists idx_estetica_bookings_service on public.estetica_bookings(service_id);

drop trigger if exists estetica_bookings_touch_updated_at on public.estetica_bookings;
create trigger estetica_bookings_touch_updated_at
  before update on public.estetica_bookings
  for each row execute function public.touch_updated_at();

create table if not exists public.estetica_portfolio (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  service_id  uuid references public.estetica_services(id) on delete set null,
  before_url  text not null,
  after_url   text not null,
  description text,
  is_featured boolean not null default false,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.estetica_portfolio enable row level security;

drop policy if exists estetica_portfolio_select_all on public.estetica_portfolio;
create policy estetica_portfolio_select_all on public.estetica_portfolio
  for select to authenticated using (true);

drop policy if exists estetica_portfolio_admin on public.estetica_portfolio;
create policy estetica_portfolio_admin on public.estetica_portfolio
  for all to service_role using (true) with check (true);

create index if not exists idx_estetica_portfolio_featured on public.estetica_portfolio(is_featured, sort_order);

create table if not exists public.estetica_loyalty_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.profiles(id) on delete cascade,
  booking_id  uuid not null references public.estetica_bookings(id) on delete cascade,
  photo_url   text not null,
  month       text not null,
  approved    boolean not null default false,
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (booking_id)
);

alter table public.estetica_loyalty_photos enable row level security;

drop policy if exists estetica_loyalty_select_own on public.estetica_loyalty_photos;
create policy estetica_loyalty_select_own on public.estetica_loyalty_photos
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists estetica_loyalty_insert_own on public.estetica_loyalty_photos;
create policy estetica_loyalty_insert_own on public.estetica_loyalty_photos
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists loyalty_photos_delete_own on public.estetica_loyalty_photos;
create policy loyalty_photos_delete_own on public.estetica_loyalty_photos
  for delete to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists estetica_loyalty_admin on public.estetica_loyalty_photos;
create policy estetica_loyalty_admin on public.estetica_loyalty_photos
  for all to service_role using (true) with check (true);

create index if not exists idx_estetica_loyalty_user_month
  on public.estetica_loyalty_photos(user_id, month, approved);

-- ============================================================================
-- 16. MODELO FINANCEIRO — Team / Commissions / Revenue / Wallet
-- ============================================================================

create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text unique,
  email           text unique not null,
  full_name       text not null,
  role            text not null check (role in ('owner','partner','consultant')),
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

create unique index if not exists uniq_commission_rule_dedup
  on public.commission_rules(
    team_member_id,
    coalesce(applies_to_type, ''),
    coalesce(applies_to_category, ''),
    is_active
  );

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

create index if not exists idx_revenue_streams_type on public.revenue_streams(type, occurred_at desc);
create index if not exists idx_revenue_streams_user on public.revenue_streams(user_id, occurred_at desc);
create index if not exists idx_revenue_streams_status on public.revenue_streams(status);
create index if not exists idx_revenue_streams_asaas
  on public.revenue_streams(asaas_payment_id) where asaas_payment_id is not null;

create table if not exists public.commission_allocations (
  id                  uuid primary key default gen_random_uuid(),
  revenue_stream_id   uuid not null references public.revenue_streams(id) on delete cascade,
  team_member_id      uuid not null references public.team_members(id) on delete restrict,
  pct                 numeric(5,2) not null,
  amount_cents        int  not null,
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

-- Wallet (cashback)
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
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wallet_credits_admin on public.wallet_credits;
create policy wallet_credits_admin on public.wallet_credits
  for all to service_role using (true) with check (true);

create index if not exists idx_wallet_credits_user_active
  on public.wallet_credits(user_id, expires_at) where used_at is null;

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
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wallet_balance_admin on public.wallet_balance;
create policy wallet_balance_admin on public.wallet_balance
  for all to service_role using (true) with check (true);

create table if not exists public.monthly_usage (
  user_id                 text not null references public.profiles(id) on delete cascade,
  year_month              text not null check (year_month ~ '^\d{4}-\d{2}$'),
  affiliate_clicks_count  int  not null default 0,
  primary key (user_id, year_month)
);

alter table public.monthly_usage enable row level security;

drop policy if exists monthly_usage_select_own on public.monthly_usage;
create policy monthly_usage_select_own on public.monthly_usage
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists monthly_usage_admin on public.monthly_usage;
create policy monthly_usage_admin on public.monthly_usage
  for all to service_role using (true) with check (true);

-- ============================================================================
-- 17. RPCs / FUNCTIONS / TRIGGERS — comportamento atômico do app
-- ============================================================================

-- 17.1 increment_affiliate_clicks
create or replace function public.increment_affiliate_clicks(link_id uuid)
returns void
language plpgsql security definer as $$
begin
  update public.affiliate_links
  set clicks_count = clicks_count + 1
  where id = link_id and is_active = true;
end;
$$;

-- 17.2 increment_coupon_uses
create or replace function public.increment_coupon_uses(coupon_id uuid)
returns void
language plpgsql security definer as $$
begin
  update public.coupons
  set uses_count = uses_count + 1
  where id = coupon_id
    and is_active = true
    and (max_uses is null or uses_count < max_uses);
end;
$$;

-- 17.3 increment_views trigger
create or replace function public.increment_views()
returns trigger
language plpgsql security definer as $$
begin
  update public.workout_videos
  set views_count = views_count + 1
  where id = NEW.workout_id;
  return NEW;
end;
$$;

drop trigger if exists on_workout_log_insert on public.workout_logs;
create trigger on_workout_log_insert
  after insert on public.workout_logs
  for each row execute function public.increment_views();

-- 17.4 decrement_stock_batch / increment_stock_batch (loja checkout)
create or replace function public.decrement_stock_batch(p_items jsonb)
returns void language plpgsql security definer as $$
declare v_item record;
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
declare v_item record;
begin
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;
end;
$$;

create or replace function public.decrement_stock(p_product_id uuid, p_quantity int)
returns void language plpgsql security definer as $$
begin
  update public.products
    set stock = stock - p_quantity
    where id = p_product_id and stock >= p_quantity;
  if not found then
    raise exception 'Estoque insuficiente para o produto %', p_product_id;
  end if;
end;
$$;

create or replace function public.increment_stock(p_product_id uuid, p_quantity int)
returns void language plpgsql security definer as $$
begin
  update public.products set stock = stock + p_quantity where id = p_product_id;
end;
$$;

-- 17.5 Wallet — credit / spend / expire / compute_cashback
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

create or replace function public.wallet_active_cents(p_user_id text) returns int
language sql stable as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.wallet_credits
  where user_id = p_user_id
    and used_at is null
    and (expires_at is null or expires_at > now())
$$;

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

-- 17.6 compute_commissions (splits)
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

-- 17.7 Estética — slots + loyalty
create or replace function public.check_loyalty_eligibility(p_user_id text)
returns boolean
language plpgsql security definer as $$
declare
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_approved_count int;
  v_already_used boolean;
begin
  select count(*) into v_approved_count
  from public.estetica_loyalty_photos
  where user_id = p_user_id and month = v_current_month and approved = true;

  select exists(
    select 1 from public.estetica_bookings
    where user_id = p_user_id
      and loyalty_free = true
      and to_char(scheduled_at, 'YYYY-MM') = v_current_month
  ) into v_already_used;

  return v_approved_count >= 4 and not v_already_used;
end;
$$;

create or replace function public.lazy_cleanup_loyalty_photos(p_user_id text)
returns int
language plpgsql security definer as $$
declare
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_deleted int;
begin
  delete from public.estetica_loyalty_photos
  where user_id = p_user_id and month < v_current_month;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.get_available_slots(
  p_date date, p_duration_min int
) returns timestamptz[]
language plpgsql security definer as $$
declare
  v_dow int := extract(dow from p_date)::int;
  v_schedule record;
  v_slot timestamptz;
  v_end_slot timestamptz;
  v_slots timestamptz[] := '{}';
  v_day_end timestamptz;
begin
  select * into v_schedule from public.estetica_schedule where day_of_week = v_dow;
  if v_schedule is null or v_schedule.is_closed then
    return v_slots;
  end if;

  v_slot := (p_date + v_schedule.opens_at)::timestamptz;
  v_day_end := (p_date + v_schedule.closes_at)::timestamptz;

  while v_slot + (p_duration_min || ' minutes')::interval <= v_day_end loop
    v_end_slot := v_slot + (p_duration_min || ' minutes')::interval;

    if not exists (
      select 1 from public.estetica_bookings
      where status in ('pending','confirmed','in_progress')
        and tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval)
            && tstzrange(v_slot, v_end_slot)
    ) and not exists (
      select 1 from public.estetica_slots_blocked
      where tstzrange(starts_at, ends_at) && tstzrange(v_slot, v_end_slot)
    ) then
      v_slots := array_append(v_slots, v_slot);
    end if;

    v_slot := v_slot + (v_schedule.slot_minutes || ' minutes')::interval;
  end loop;

  return v_slots;
end;
$$;

-- ============================================================================
-- 18. STORAGE BUCKETS — estética portfólio (público) + loyalty (privado)
-- ============================================================================

insert into storage.buckets (id, name, public) values ('estetica-portfolio', 'estetica-portfolio', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('estetica-loyalty', 'estetica-loyalty', false)
  on conflict (id) do nothing;

drop policy if exists estetica_portfolio_read_public on storage.objects;
create policy estetica_portfolio_read_public on storage.objects
  for select to public using (bucket_id = 'estetica-portfolio');

drop policy if exists estetica_portfolio_write_admin on storage.objects;
create policy estetica_portfolio_write_admin on storage.objects
  for insert to service_role with check (bucket_id = 'estetica-portfolio');

drop policy if exists estetica_portfolio_delete_admin on storage.objects;
create policy estetica_portfolio_delete_admin on storage.objects
  for delete to service_role using (bucket_id = 'estetica-portfolio');

drop policy if exists estetica_loyalty_read_own on storage.objects;
create policy estetica_loyalty_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'estetica-loyalty'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

drop policy if exists estetica_loyalty_write_own on storage.objects;
create policy estetica_loyalty_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'estetica-loyalty'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

drop policy if exists estetica_loyalty_delete_own on storage.objects;
create policy estetica_loyalty_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'estetica-loyalty'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

drop policy if exists estetica_loyalty_admin on storage.objects;
create policy estetica_loyalty_admin on storage.objects
  for all to service_role
  using (bucket_id = 'estetica-loyalty')
  with check (bucket_id = 'estetica-loyalty');

commit;

-- ============================================================================
-- FIM. Para mudanças incrementais, crie um novo `migration_*.sql` em vez de
-- editar este arquivo. Quando aplicar em prod, regenere este snapshot.
-- ============================================================================
