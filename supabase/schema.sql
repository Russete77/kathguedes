-- ============================================
-- KATHAPP — Schema v1.0 (Consolidated)
-- Supabase Postgres + Clerk Third-Party Auth
-- Includes: 12 tables (profiles, workout_videos, consultations, workout_logs, affiliate_links, coupons, messages, products, orders, push_subscriptions, notifications, coupon_uses)
-- ============================================

-- ── Helper: extrair user_id do JWT do Clerk ──
-- auth.jwt()->>'sub' retorna o Clerk user ID (user_xxx)
-- Usado como default em user_id e em RLS policies

-- ── Helper: comparar plan_tier ──
-- Ordem: free=0, start=1, pro=2, vip=3
create or replace function public.plan_tier_level(tier text)
returns int
language sql
immutable
as $$
  select case tier
    when 'free'  then 0
    when 'start' then 1
    when 'pro'   then 2
    when 'vip'   then 3
    else 0
  end;
$$;


-- ============================================
-- 1. PROFILES — Usuários
-- ============================================
create table public.profiles (
  id                    text primary key,  -- Clerk user_id (user_xxx)
  full_name             text not null,
  avatar_url            text,
  plan_tier             text not null default 'free'
                        check (plan_tier in ('free', 'start', 'pro', 'vip')),
  asaas_customer_id     text unique,
  asaas_subscription_id text,
  subscription_status   text not null default 'active'
                        check (subscription_status in ('active', 'past_due', 'canceled')),
  subscription_ends_at  timestamptz,
  workout_streak        int not null default 0,
  last_workout_at       timestamptz,
  interests             text[] not null default '{}',
  created_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Usuário vê apenas seu próprio perfil
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.jwt()->>'sub') = id);

-- Usuário atualiza apenas seu próprio perfil (campos limitados)
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.jwt()->>'sub') = id)
  with check ((select auth.jwt()->>'sub') = id);

-- Insert feito pelo webhook/admin (service role), não pelo user direto
create policy "profiles_insert_service"
  on public.profiles for insert
  to service_role
  with check (true);

-- Admin pode ver todos os perfis
create policy "profiles_select_admin"
  on public.profiles for select
  to service_role
  using (true);

-- Admin pode atualizar qualquer perfil (plan_tier, subscription, etc)
create policy "profiles_update_admin"
  on public.profiles for update
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 2. WORKOUT_VIDEOS — Treinos
-- ============================================
create table public.workout_videos (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  youtube_id       text not null,
  category         text not null
                   check (category in ('gluteo', 'pernas', 'superior', 'hiit', 'full', 'viagem')),
  level            text not null
                   check (level in ('iniciante', 'intermediario', 'avancado')),
  duration_minutes int not null,
  required_plan    text not null default 'free'
                   check (required_plan in ('free', 'start', 'pro', 'vip')),
  thumbnail_url    text,
  views_count      int not null default 0,
  is_published     boolean not null default false,
  published_at     timestamptz
);

alter table public.workout_videos enable row level security;

-- Assinante vê treinos publicados onde seu plan_tier >= required_plan
create policy "workouts_select_by_plan"
  on public.workout_videos for select
  to authenticated
  using (
    is_published = true
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

-- Admin (service_role) tem acesso total
create policy "workouts_admin"
  on public.workout_videos for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 3. CONSULTATIONS — Consultorias
-- ============================================
create table public.consultations (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references public.profiles(id),
  package_type     text not null
                   check (package_type in ('mensal', 'trimestral', 'premium', 'assessoria')),
  status           text not null default 'pending'
                   check (status in ('pending', 'in_progress', 'delivered', 'expired')),
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

-- Usuário vê apenas suas consultorias
create policy "consultations_select_own"
  on public.consultations for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- Usuário pode inserir (comprar) consultoria
create policy "consultations_insert_own"
  on public.consultations for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

-- Usuário pode atualizar (ex: preencher anamnese)
create policy "consultations_update_own"
  on public.consultations for update
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

-- Admin acesso total
create policy "consultations_admin"
  on public.consultations for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 4. WORKOUT_LOGS — Histórico de Treinos
-- ============================================
create table public.workout_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null default (auth.jwt()->>'sub') references public.profiles(id),
  workout_id      uuid not null references public.workout_videos(id),
  completed_at    timestamptz not null default now(),
  duration_actual int
);

alter table public.workout_logs enable row level security;

-- Usuário vê apenas seus logs
create policy "logs_select_own"
  on public.workout_logs for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- Usuário insere apenas seus logs
create policy "logs_insert_own"
  on public.workout_logs for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

-- Admin acesso total
create policy "logs_admin"
  on public.workout_logs for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 5. AFFILIATE_LINKS — Produtos Afiliados
-- ============================================
create table public.affiliate_links (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  image_url     text not null,
  module        text not null check (module in ('fitness', 'moto')),
  category      text not null,
  platform      text not null
                check (platform in ('amazon', 'mercadolivre', 'shopee', 'direto')),
  affiliate_url text not null,
  required_plan text not null default 'free'
                check (required_plan in ('free', 'start', 'pro', 'vip')),
  clicks_count  int not null default 0,
  is_active     boolean not null default true,
  sort_order    int not null default 0
);

alter table public.affiliate_links enable row level security;

-- Assinante vê links ativos onde plan_tier >= required_plan
create policy "affiliates_select_by_plan"
  on public.affiliate_links for select
  to authenticated
  using (
    is_active = true
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

-- Admin acesso total
create policy "affiliates_admin"
  on public.affiliate_links for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 6. COUPONS — Cupons de Desconto
-- ============================================
create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  code          text unique not null,
  discount_pct  int,
  partner_name  text not null,
  partner_url   text not null,
  module        text not null check (module in ('fitness', 'moto', 'geral')),
  required_plan text not null default 'free'
                check (required_plan in ('free', 'start', 'pro', 'vip')),
  max_uses      int,
  uses_count    int not null default 0,
  valid_until   timestamptz not null,
  is_flash      boolean not null default false,
  is_active     boolean not null default true
);

alter table public.coupons enable row level security;

-- Assinante vê cupons ativos e não expirados onde plan_tier >= required_plan
create policy "coupons_select_by_plan"
  on public.coupons for select
  to authenticated
  using (
    is_active = true
    and valid_until > now()
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );

-- Admin acesso total
create policy "coupons_admin"
  on public.coupons for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 7. MESSAGES — Chat VIP
-- ============================================
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default (auth.jwt()->>'sub') references public.profiles(id),
  body         text not null,
  is_from_kath boolean not null default false,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Usuário VIP vê apenas suas mensagens
create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- Usuário VIP pode enviar mensagem (plan_tier = vip)
create policy "messages_insert_vip"
  on public.messages for insert
  to authenticated
  with check (
    (select auth.jwt()->>'sub') = user_id
    and (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub')) = 'vip'
  );

-- Admin acesso total (Kath responde)
create policy "messages_admin"
  on public.messages for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 8. PRODUCTS — Loja (Produtos Físicos)
-- ============================================
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  image_url       text not null,
  price_cents     int not null,               -- preço em centavos (ex: 4990 = R$49,90)
  compare_price   int,                        -- preço antigo riscado (centavos)
  category        text not null,              -- sticker, camiseta, acessório, etc
  module          text not null default 'geral'
                  check (module in ('fitness', 'moto', 'geral')),
  variants        jsonb not null default '[]', -- [{ name: "P", stock: 10 }, { name: "M", stock: 5 }]
  stock           int not null default 0,      -- estoque total (soma das variantes)
  discount_start  int not null default 0,      -- % desconto p/ plano START
  discount_pro    int not null default 0,      -- % desconto p/ plano PRO
  discount_vip    int not null default 0,      -- % desconto p/ plano VIP
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.products enable row level security;

-- Qualquer autenticado vê produtos ativos
create policy "products_select_active"
  on public.products for select
  to authenticated
  using (is_active = true);

-- Admin acesso total
create policy "products_admin"
  on public.products for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 9. ORDERS — Pedidos da Loja
-- ============================================
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references public.profiles(id),
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'shipped', 'delivered', 'canceled')),
  items           jsonb not null,             -- [{ product_id, title, variant, quantity, price_cents }]
  subtotal_cents  int not null,
  discount_cents  int not null default 0,
  total_cents     int not null,
  shipping_info   jsonb,                      -- { name, address, city, state, zip, phone }
  tracking_code   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Usuário vê apenas seus pedidos
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- Usuário insere pedido
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

-- Admin acesso total
create policy "orders_admin"
  on public.orders for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 10. PUSH_SUBSCRIPTIONS — Web Push Tokens
-- ============================================
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references public.profiles(id) on delete cascade,
  subscription jsonb not null,  -- { endpoint, keys: { p256dh, auth } }
  created_at   timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_select_own"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "push_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "push_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "push_admin"
  on public.push_subscriptions for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 11. NOTIFICATIONS — In-App Notifications
-- ============================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  icon       text,           -- lucide icon name
  url        text,           -- deep link no app
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notif_select_own"
  on public.notifications for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "notif_update_own"
  on public.notifications for update
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "notif_admin"
  on public.notifications for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- 12. COUPON_USES — Rastreamento de uso de cupom por usuário
-- ============================================
create table public.coupon_uses (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  user_id    text not null references public.profiles(id) on delete cascade,
  used_at    timestamptz not null default now(),
  unique(coupon_id, user_id)  -- cada user usa cada cupom só 1 vez
);

alter table public.coupon_uses enable row level security;

create policy "coupon_uses_select_own"
  on public.coupon_uses for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "coupon_uses_insert_own"
  on public.coupon_uses for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "coupon_uses_admin"
  on public.coupon_uses for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- RPC — Affiliate Clicks Increment
-- ============================================

-- Atomic increment for affiliate clicks
create or replace function public.increment_affiliate_clicks(link_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.affiliate_links
  set clicks_count = clicks_count + 1
  where id = link_id
    and is_active = true;
end;
$$;


-- ============================================
-- 13. PLAN_TEMPLATES — Templates de Treino e Dieta
-- ============================================
create table public.plan_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('workout', 'diet')),
  description text,
  data        jsonb not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.plan_templates enable row level security;

create policy "templates_admin"
  on public.plan_templates for all
  to service_role
  using (true)
  with check (true);


-- ============================================
-- INDEXES — Performance
-- ============================================
create index idx_profiles_plan_tier on public.profiles(plan_tier);
create index idx_workout_videos_category on public.workout_videos(category);
create index idx_workout_videos_published on public.workout_videos(is_published, published_at desc);
create index idx_consultations_user on public.consultations(user_id);
create index idx_consultations_status on public.consultations(status);
create index idx_workout_logs_user on public.workout_logs(user_id);
create index idx_workout_logs_completed on public.workout_logs(completed_at desc);
create index idx_affiliate_links_module on public.affiliate_links(module, is_active);
create index idx_coupons_module on public.coupons(module, is_active);
create index idx_coupons_valid on public.coupons(valid_until);
create index idx_messages_user on public.messages(user_id, created_at desc);
create index idx_products_active on public.products(is_active, sort_order);
create index idx_orders_user on public.orders(user_id, created_at desc);
create index idx_orders_status on public.orders(status);
create index idx_push_user on public.push_subscriptions(user_id);
create index idx_notif_user on public.notifications(user_id, is_read, created_at desc);
create index idx_coupon_uses_user on public.coupon_uses(user_id);
create index idx_coupon_uses_coupon on public.coupon_uses(coupon_id);
create index idx_consultations_anamnesis on public.consultations((anamnesis is not null));
create index idx_plan_templates_type on public.plan_templates(type, is_active);


-- ============================================
-- TRIGGERS — Automações
-- ============================================

-- Auto-increment views_count quando workout_log é inserido
create or replace function public.increment_views()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.workout_videos
  set views_count = views_count + 1
  where id = NEW.workout_id;
  return NEW;
end;
$$;

create trigger on_workout_log_insert
  after insert on public.workout_logs
  for each row
  execute function public.increment_views();

-- Auto-increment uses_count quando cupom é usado via API
create or replace function public.increment_coupon_uses(coupon_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.coupons
  set uses_count = uses_count + 1
  where id = coupon_id
    and is_active = true
    and (max_uses is null or uses_count < max_uses);
end;
$$;
