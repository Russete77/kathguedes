-- ============================================================================
-- 25_profiles_guard_sensitive_columns.sql
--
-- C1 (CTO audit 2026-05-22): a policy `profiles_update_own` permite UPDATE no
-- próprio profile sem restrição de coluna. Como o cliente usa a anon key com o
-- JWT do usuário, qualquer pessoa podia fazer:
--     update profiles set plan_tier = 'atleta', subscription_status = 'active'
-- e se conceder o plano de topo de graça (todos os gates leem plan_tier).
--
-- Esta migration adiciona um trigger BEFORE UPDATE que bloqueia mudanças em
-- colunas de assinatura/billing quando a conexão NÃO é service_role
-- (webhook Asaas, admin actions e crons usam service_role e continuam livres).
--
-- Idempotente: create or replace + drop trigger if exists.
-- ============================================================================

create or replace function public.guard_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (webhook/admin/cron) e o superusuário do banco podem alterar tudo.
  -- PostgREST faz `SET LOCAL role = 'service_role'` quando a service key é usada.
  if current_setting('role', true) in ('service_role', 'postgres')
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  -- Usuário autenticado (anon/authenticated) não pode mexer em assinatura/billing.
  if new.plan_tier             is distinct from old.plan_tier
     or new.subscription_status   is distinct from old.subscription_status
     or new.subscription_ends_at  is distinct from old.subscription_ends_at
     or new.asaas_customer_id     is distinct from old.asaas_customer_id
     or new.asaas_subscription_id is distinct from old.asaas_subscription_id then
    raise exception 'profiles: subscription/billing columns are not user-editable'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_sensitive on public.profiles;
create trigger trg_guard_profile_sensitive
  before update on public.profiles
  for each row
  execute function public.guard_profile_sensitive_columns();

comment on function public.guard_profile_sensitive_columns() is
  'Bloqueia auto-upgrade de plano/assinatura por usuários autenticados; service_role passa livre. Ver docs/audit/2026-05-22-cto-audit.md C1.';
