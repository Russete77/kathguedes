-- ============================================================================
-- Migration: regra de fidelidade Kath Estética — 4→5ª grátis vira 3→4ª grátis
-- (2026-05-12)
-- ============================================================================
-- Atualiza a RPC `check_loyalty_eligibility` para considerar 3 fotos
-- aprovadas no mês (antes era 4). Idempotente.
-- ============================================================================

begin;

create or replace function public.check_loyalty_eligibility(p_user_id text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_approved_count int;
  v_already_used boolean;
begin
  -- Conta fotos aprovadas do mês atual
  select count(*) into v_approved_count
  from public.estetica_loyalty_photos
  where user_id = p_user_id
    and month = v_current_month
    and approved = true;

  -- Já tem algum booking loyalty_free do mês?
  select exists(
    select 1 from public.estetica_bookings
    where user_id = p_user_id
      and loyalty_free = true
      and to_char(scheduled_at, 'YYYY-MM') = v_current_month
  ) into v_already_used;

  -- Mudança: 3 fotos (antes 4) liberam a 4ª lavagem grátis
  return v_approved_count >= 3 and not v_already_used;
end;
$$;

commit;
