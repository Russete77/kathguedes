-- ============================================================================
-- 28_drop_redundant_c1_trigger.sql
--
-- Cleanup: a remediação inicial do C1 (anti self-upgrade de plano) foi escrita
-- duas vezes — `25_profiles_guard_sensitive_columns.sql` (canônica, mais
-- completa: também protege asaas_customer_id/asaas_subscription_id) e um trigger
-- redundante `trg_prevent_profile_privilege_escalation` que chegou a ser aplicado
-- em produção. Esta migration remove o redundante e mantém a #25 como única.
--
-- Salvaguarda: antes de dropar o redundante, RE-AFIRMAMOS o guard da #25 (idempotente,
-- create or replace). Assim, mesmo que a #25 nunca tenha sido aplicada nesta base,
-- o C1 NUNCA fica desprotegido após esta migration.
--
-- Idempotente: create or replace + drop if exists.
-- ============================================================================

-- 1. Re-afirma o guard canônico da #25 (cópia idempotente — fonte de verdade é a #25).
create or replace function public.guard_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) in ('service_role', 'postgres')
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.plan_tier             is distinct from old.plan_tier
     or new.subscription_status   is distinct from old.subscription_status
     or new.subscription_ends_at  is distinct from old.subscription_ends_at
     or new.asaas_customer_id     is distinct from old.asaas_customer_id
     or new.asaas_subscription_id is distinct from old.asaas_subscription_id then
    raise exception 'profiles: subscription/billing columns are not user-editable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_sensitive on public.profiles;
create trigger trg_guard_profile_sensitive
  before update on public.profiles
  for each row
  execute function public.guard_profile_sensitive_columns();

-- 2. Remove o trigger/função redundantes (aplicados via migration_sprint0_prod_blockers.sql,
--    que foi removida do repo). A #25 (re-afirmada acima) já cobre o C1.
drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
drop function if exists public.prevent_profile_privilege_escalation();
