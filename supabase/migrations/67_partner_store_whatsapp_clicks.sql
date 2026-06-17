-- ============================================================================
-- MIGRATION 67: partner_store_whatsapp_clicks
-- ----------------------------------------------------------------------------
-- 1) Backfill: garante DDI 55 em números brasileiros cadastrados sem código
--    de país (10/11 dígitos) — sintoma do bug "Não foi possível abrir este
--    link" no app mobile do WhatsApp.
-- 2) Tabela de tracking de cliques no botão "Comprar pelo WhatsApp" usado
--    no admin para medir conversão de parceiros e produtos.
-- ============================================================================

-- ── 1) Backfill dos números existentes ───────────────────────────────────────
-- Remove caracteres não numéricos e prefixa 55 quando faltar DDI brasileiro.
update public.partner_stores
set whatsapp_number = regexp_replace(whatsapp_number, '\D', '', 'g')
where whatsapp_number ~ '\D';

update public.partner_stores
set whatsapp_number = '55' || whatsapp_number
where length(whatsapp_number) in (10, 11)
  and whatsapp_number !~ '^55';

-- ── 2) Tabela de cliques ─────────────────────────────────────────────────────
create table if not exists public.partner_store_whatsapp_clicks (
  id                uuid primary key default gen_random_uuid(),
  partner_store_id  uuid not null
    references public.partner_stores(id) on delete cascade,
  product_id        uuid
    references public.products(id) on delete set null,
  user_id           uuid
    references auth.users(id) on delete set null,
  price_cents       integer,
  created_at        timestamptz not null default now()
);

create index if not exists idx_ps_whatsapp_clicks_store_created
  on public.partner_store_whatsapp_clicks(partner_store_id, created_at desc);

create index if not exists idx_ps_whatsapp_clicks_product_created
  on public.partner_store_whatsapp_clicks(product_id, created_at desc)
  where product_id is not null;

create index if not exists idx_ps_whatsapp_clicks_created
  on public.partner_store_whatsapp_clicks(created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.partner_store_whatsapp_clicks enable row level security;

-- Apenas o service_role escreve/lê. O insert vem da API route
-- (/api/loja/whatsapp-click), que usa o admin client. Usuários NÃO inserem
-- direto do browser — assim evitamos spam/contagem inflada.
drop policy if exists ps_whatsapp_clicks_admin on public.partner_store_whatsapp_clicks;
create policy ps_whatsapp_clicks_admin on public.partner_store_whatsapp_clicks
  for all to service_role
  using (true) with check (true);

-- ── View agregada por loja (conveniência p/ o admin) ─────────────────────────
create or replace view public.partner_store_whatsapp_click_stats as
select
  ps.id                                                         as partner_store_id,
  ps.name                                                       as partner_store_name,
  count(c.*)                                                    as clicks_total,
  count(c.*) filter (where c.created_at >= now() - interval '7 days')  as clicks_7d,
  count(c.*) filter (where c.created_at >= now() - interval '30 days') as clicks_30d,
  max(c.created_at)                                             as last_click_at
from public.partner_stores ps
left join public.partner_store_whatsapp_clicks c
  on c.partner_store_id = ps.id
group by ps.id, ps.name;

-- A view roda com permissões do criador (definer-like) — RLS na tabela base
-- já restringe ao service_role, então o acesso à view também passa pela API.
