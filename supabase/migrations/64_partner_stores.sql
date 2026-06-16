-- ============================================================================
-- MIGRATION 64: partner_stores — lojas parceiras com venda via WhatsApp externo
-- ============================================================================
-- (movida de supabase/migration_partner_stores.sql para entrar na numeracao
--  sequencial e ser aplicada por supabase db push / CI.)
-- Produtos vinculados a um parceiro exibem botão "Comprar pelo WhatsApp"
-- em vez de entrar no carrinho da KathApp.

-- ── Tabela principal ──────────────────────────────────────────────────────────
create table if not exists public.partner_stores (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  whatsapp_number  text not null,       -- formato: somente dígitos, ex: 5511999999999
  logo_url         text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.partner_stores enable row level security;

drop policy if exists partner_stores_select_active on public.partner_stores;
create policy partner_stores_select_active on public.partner_stores
  for select to authenticated
  using (is_active = true);

drop policy if exists partner_stores_admin on public.partner_stores;
create policy partner_stores_admin on public.partner_stores
  for all to service_role
  using (true) with check (true);

create index if not exists idx_partner_stores_active
  on public.partner_stores(is_active);

-- ── FK em products ────────────────────────────────────────────────────────────
alter table public.products
  add column if not exists partner_store_id uuid
    references public.partner_stores(id) on delete set null;

create index if not exists idx_products_partner_store
  on public.products(partner_store_id)
  where partner_store_id is not null;
