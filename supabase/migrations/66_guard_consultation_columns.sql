-- ============================================================================
-- 66_guard_consultation_columns.sql
--
-- Auditoria 2026-06-16 (M2): a policy `consultations_update_own` permite UPDATE
-- na própria consultoria sem restrição de coluna. Via PostgREST (anon key + JWT
-- do usuário) o aluno podia fazer:
--     update consultations set workout_plan = ..., diet_plan = ...,
--            daily_calories = ..., status = 'delivered', notes_admin = ...
-- e ADULTERAR o plano que a Kath montou (ou se marcar como entregue).
--
-- Espelha a migration 25 (guard de profiles): trigger BEFORE UPDATE que bloqueia
-- mudança nas colunas prescritas pela Kath quando a conexão NÃO é service_role.
-- O aluno continua livre para escrever `anamnesis` e `completed_days` (progresso).
-- Admin/Kath, webhook e crons usam service_role e passam livres.
--
-- Idempotente: create or replace + drop trigger if exists.
-- ============================================================================

create or replace function public.guard_consultation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (admin/Kath, webhook, cron) e o superusuário passam livres.
  if current_setting('role', true) in ('service_role', 'postgres')
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  -- Usuário autenticado não pode alterar a prescrição nem o status/entrega.
  if new.package_type    is distinct from old.package_type
     or new.status          is distinct from old.status
     or new.workout_plan    is distinct from old.workout_plan
     or new.diet_plan       is distinct from old.diet_plan
     or new.daily_calories  is distinct from old.daily_calories
     or new.daily_protein   is distinct from old.daily_protein
     or new.daily_carbs     is distinct from old.daily_carbs
     or new.daily_fat       is distinct from old.daily_fat
     or new.notes_admin     is distinct from old.notes_admin
     or new.valid_until     is distinct from old.valid_until then
    raise exception 'consultations: only anamnesis/completed_days are user-editable'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_consultation_columns on public.consultations;
create trigger trg_guard_consultation_columns
  before update on public.consultations
  for each row
  execute function public.guard_consultation_columns();

comment on function public.guard_consultation_columns() is
  'Bloqueia o aluno (authenticated) de alterar a prescrição (workout_plan/diet_plan/daily_*/status/notes_admin/valid_until/package_type); só anamnesis/completed_days. service_role passa. Ver kathapp-auditoria-cto-2026-06-16.md M2.';
