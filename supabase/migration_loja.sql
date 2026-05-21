-- ============================================
-- MIGRATION: Loja Kath — Produtos Físicos
-- ============================================

-- ── PRODUCTS ──
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

-- ── ORDERS ──
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

-- ── INDEXES ──
create index idx_products_active on public.products(is_active, sort_order);
create index idx_orders_user on public.orders(user_id, created_at desc);
create index idx_orders_status on public.orders(status);
