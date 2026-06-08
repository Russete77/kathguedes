-- ============================================
-- MIGRATION 36: audit_logs
-- ============================================
--
-- Resolve Critico 5 da auditoria CTO (25/05/26): "sem audit logs em
-- operações financeiras". Sem rastreabilidade, incidente (plano alterado
-- por bug ou ação maliciosa, refund não esperado, payout duplicado) e
-- impossivel de investigar.
--
-- Solução: tabela audit_logs + trigger function genérica + triggers AFTER
-- INSERT/UPDATE/DELETE em tabelas financeiras/sensíveis.
--
-- Tabelas auditadas:
-- - profiles (plan_tier, subscription_*, asaas_*)
-- - revenue_streams (toda mudança — incluindo refund)
-- - wallet_credits (cashback ganho/gasto/revogado)
-- - commission_allocations (status changes — draft/approved/paid/failed)
-- - plans (alterações de preço/features pelo admin)
-- - orders (status changes, refund)
--
-- O actor é capturado via auth.jwt()->>'sub' (Clerk user_id) ou 'service_role'
-- quando webhook/cron. As mudanças vão em JSONB { col: {old, new}, ... } só
-- pras colunas que mudaram (em UPDATE).
-- ============================================

begin;

-- ============================================
-- 1. Tabela audit_logs
-- ============================================
create table if not exists public.audit_logs (
  id           bigserial primary key,
  table_name   text not null,
  operation    text not null check (operation in ('insert', 'update', 'delete')),
  row_id       text,
  actor        text not null,
  changes      jsonb not null default '{}'::jsonb,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- ============================================
-- 2. Indexes para queries comuns
-- ============================================
create index if not exists idx_audit_logs_table_row
  on public.audit_logs(table_name, row_id, created_at desc);

create index if not exists idx_audit_logs_actor
  on public.audit_logs(actor, created_at desc);

create index if not exists idx_audit_logs_created
  on public.audit_logs(created_at desc);

-- ============================================
-- 3. RLS — só service_role (admin) le/escreve
-- (Trigger function roda em SECURITY DEFINER, bypassa RLS no insert)
-- ============================================
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin on public.audit_logs;
create policy audit_logs_admin on public.audit_logs
  for all to service_role using (true) with check (true);

-- ============================================
-- 4. Função genérica de audit trigger
--
-- Captura OLD/NEW, computa diff (só colunas mudadas em UPDATE), e insere
-- em audit_logs. Para INSERT/DELETE, captura row inteira.
-- ============================================
create or replace function public.fn_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    text;
  v_row_id   text;
  v_changes  jsonb := '{}'::jsonb;
  v_old      jsonb;
  v_new      jsonb;
  v_key      text;
begin
  -- Captura ator: Clerk user_id se tiver JWT, senão 'service_role' (webhook/cron/admin)
  v_actor := coalesce(
    (current_setting('request.jwt.claims', true)::jsonb)->>'sub',
    current_setting('role', true),
    'unknown'
  );

  -- Captura row_id (suporta uuid + text + bigint)
  if tg_op = 'DELETE' then
    v_row_id := coalesce(
      (to_jsonb(old) ->> 'id'),
      (to_jsonb(old) ->> 'slug'),
      ''
    );
    v_changes := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_row_id := coalesce(
      (to_jsonb(new) ->> 'id'),
      (to_jsonb(new) ->> 'slug'),
      ''
    );
    v_changes := to_jsonb(new);
  else -- UPDATE
    v_row_id := coalesce(
      (to_jsonb(new) ->> 'id'),
      (to_jsonb(new) ->> 'slug'),
      ''
    );
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    -- Computa diff: só colunas que mudaram
    for v_key in select jsonb_object_keys(v_new) loop
      if v_old -> v_key is distinct from v_new -> v_key then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
        );
      end if;
    end loop;
    -- Se nenhuma coluna mudou (caso raro), pula
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.audit_logs (table_name, operation, row_id, actor, changes)
  values (tg_table_name, lower(tg_op), v_row_id, v_actor, v_changes);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ============================================
-- 5. Triggers AFTER em tabelas sensíveis
-- ============================================

-- profiles: plan_tier, subscription_*, asaas_*
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.fn_audit_trigger();

-- revenue_streams: toda mudança (criação, refund)
drop trigger if exists trg_audit_revenue_streams on public.revenue_streams;
create trigger trg_audit_revenue_streams
  after insert or update or delete on public.revenue_streams
  for each row execute function public.fn_audit_trigger();

-- wallet_credits: cashback ganho/gasto/revogado/expirado
drop trigger if exists trg_audit_wallet_credits on public.wallet_credits;
create trigger trg_audit_wallet_credits
  after insert or update or delete on public.wallet_credits
  for each row execute function public.fn_audit_trigger();

-- commission_allocations: status changes (draft→approved→paid→failed)
drop trigger if exists trg_audit_commission_allocations on public.commission_allocations;
create trigger trg_audit_commission_allocations
  after insert or update or delete on public.commission_allocations
  for each row execute function public.fn_audit_trigger();

-- plans: admin altera preço, features, cashback_pct
drop trigger if exists trg_audit_plans on public.plans;
create trigger trg_audit_plans
  after insert or update or delete on public.plans
  for each row execute function public.fn_audit_trigger();

-- orders: status changes (pending→paid→shipped→delivered→canceled)
drop trigger if exists trg_audit_orders on public.orders;
create trigger trg_audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.fn_audit_trigger();

commit;
