-- 50_workout_streak_rpc.sql
-- RPC atômico para atualizar o streak de treino (workout_streak + last_workout_at).
--
-- Antes, /api/workout/complete e /api/consultoria/complete-day faziam
-- SELECT-then-UPDATE em profiles — viola a regra de contadores atômicos e tem
-- race condition em cliques concorrentes. Esta função faz SELECT ... FOR UPDATE
-- + UPDATE numa transação só, travando a linha do profile.
--
-- Regra do streak (idêntica à lógica antiga):
--   < 24h desde o último  → mantém o streak (não duplica no mesmo dia)
--   24h–48h               → incrementa
--   > 48h ou sem registro → reseta para 1
--
-- O código (src/lib/billing/streak.ts) chama esta RPC e cai num fallback inline
-- se ela ainda não existir — então é seguro aplicar a migration a qualquer momento.

create or replace function public.update_workout_streak(p_user_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last   timestamptz;
  v_streak int;
  v_new    int := 1;
  v_hours  numeric;
begin
  select workout_streak, last_workout_at
    into v_streak, v_last
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return 0;
  end if;

  if v_last is not null then
    v_hours := extract(epoch from (now() - v_last)) / 3600.0;
    if v_hours < 24 then
      v_new := greatest(coalesce(v_streak, 1), 1);
    elsif v_hours < 48 then
      v_new := coalesce(v_streak, 0) + 1;
    else
      v_new := 1;
    end if;
  end if;

  update public.profiles
     set workout_streak = v_new,
         last_workout_at = now()
   where id = p_user_id;

  return v_new;
end;
$$;

revoke all on function public.update_workout_streak(text) from public, anon, authenticated;
grant execute on function public.update_workout_streak(text) to service_role;
