-- ============================================
-- KATHAPP — Security Hardening (2026-05-08)
-- Audit refs: docs/audit/2026-05-01-cto-audit.md
-- Cobre: DB-01 (RLS webhook_events), DB-05 (delete policy loyalty),
--        DB-08 (indexes faltantes em orders)
-- ============================================
-- Idempotente: usa IF NOT EXISTS / DROP POLICY IF EXISTS

begin;

-- ============================================
-- DB-01: webhook_events — RLS admin-only
-- ============================================
-- Tabela contém histórico financeiro (payment_id + event do Asaas).
-- Antes: sem RLS — qualquer authenticated lia tudo.
-- Depois: só service_role (admin/webhook) acessa.

alter table public.webhook_events enable row level security;

drop policy if exists webhook_events_admin on public.webhook_events;
create policy webhook_events_admin on public.webhook_events
  for all to service_role using (true) with check (true);

-- Negar explicitamente authenticated/anon (defesa em profundidade)
drop policy if exists webhook_events_deny_authenticated on public.webhook_events;
create policy webhook_events_deny_authenticated on public.webhook_events
  for all to authenticated using (false) with check (false);

-- ============================================
-- DB-05: estetica_loyalty_photos — DELETE policy
-- ============================================
-- User precisa apagar foto rejeitada. Só pode apagar a própria.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='estetica_loyalty_photos') then
    execute 'drop policy if exists loyalty_photos_delete_own on public.estetica_loyalty_photos';
    execute $p$
      create policy loyalty_photos_delete_own on public.estetica_loyalty_photos
        for delete to authenticated
        using ((select auth.jwt()->>'sub') = user_id)
    $p$;
  end if;
end $$;

-- ============================================
-- DB-08: indexes faltantes em orders
-- ============================================

create index if not exists idx_orders_shipping_method
  on public.orders(shipping_method)
  where shipping_method is not null;

create index if not exists idx_orders_asaas_payment_id
  on public.orders(asaas_payment_id)
  where asaas_payment_id is not null;

commit;
