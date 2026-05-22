-- ============================================================================
-- migration_sprint0_prod_blockers.sql
-- Sprint 0 — bloqueadores P0 de produção (auditoria 2026-05-22).
-- Aplicar manualmente no painel Supabase (workflow do projeto: sem supabase local).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- C1 — Anti self-upgrade de plano.
-- A policy `profiles_update_own` permite UPDATE em qualquer coluna do próprio
-- perfil. Com anon key + JWT do próprio usuário, qualquer um faz
--   update profiles set plan_tier = 'atleta';
-- e destrava todos os gates de plano de graça. Fechamos com um trigger
-- BEFORE UPDATE: só o service_role (webhook Asaas / admin / cron, via
-- SUPABASE_SERVICE_ROLE_KEY) pode mexer em plan_tier / subscription_status /
-- subscription_ends_at. O usuário comum (role 'authenticated') é bloqueado.
--
-- SECURITY INVOKER (default): current_user reflete o role REAL do chamador
-- (PostgREST faz SET ROLE service_role / authenticated). Não usar SECURITY
-- DEFINER aqui — mascararia current_user com o dono da função.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  -- Roles do sistema (nunca alcançáveis pela API pública) podem tudo.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if new.plan_tier is distinct from old.plan_tier
     or new.subscription_status is distinct from old.subscription_status
     or new.subscription_ends_at is distinct from old.subscription_ends_at then
    raise exception
      'Campos de plano/assinatura só podem ser alterados pelo sistema (service_role)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
create trigger trg_prevent_profile_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

-- ----------------------------------------------------------------------------
-- Double-booking — EXCLUDE constraint.
-- `get_available_slots` é só checagem de leitura: dois POSTs concorrentes (ou
-- um booking criado pelo admin, que ignora disponibilidade) podem reservar o
-- mesmo horário. A capacidade do estúdio é 1 (o RPC considera overlap entre
-- TODOS os serviços), então proibimos no DB qualquer sobreposição temporal
-- entre bookings ativos. O DB passa a ser a fonte de verdade contra colisão.
--
-- PRÉ-CHECK (rode ANTES; o ADD CONSTRAINT falha se já houver overlaps ativos):
--
--   select a.id, b.id, a.scheduled_at, b.scheduled_at
--   from public.estetica_bookings a
--   join public.estetica_bookings b
--     on a.id < b.id
--    and a.status in ('pending','confirmed','in_progress')
--    and b.status in ('pending','confirmed','in_progress')
--    and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
--     && tstzrange(b.scheduled_at, b.scheduled_at + make_interval(mins => b.duration_min));
--
-- Se retornar linhas, cancele/reagende uma das colisões antes de prosseguir.
-- ----------------------------------------------------------------------------

alter table public.estetica_bookings
  drop constraint if exists no_overlapping_bookings;

alter table public.estetica_bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_min)) with &&
  )
  where (status in ('pending', 'confirmed', 'in_progress'));
