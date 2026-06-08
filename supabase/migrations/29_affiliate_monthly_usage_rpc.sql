-- 29_affiliate_monthly_usage_rpc.sql
-- ============================================
-- RPC atômico para incrementar monthly_usage.affiliate_clicks_count
-- com gate de limite mensal (plano FREE: 3/mês; demais: unlimited via NULL).
--
-- Aditivo: apenas cria função e índice. NÃO altera dados de sócios/comissões.
-- Aplicar manualmente no painel Supabase (auplhaxwaecsppqizxej) — workflow padrão do projeto.
-- ============================================

create index if not exists idx_monthly_usage_user_month
  on public.monthly_usage(user_id, year_month);

create or replace function public.try_increment_affiliate_click(
  p_user_id    text,
  p_year_month text,
  p_limit      int  -- null = ilimitado
)
returns table (allowed boolean, new_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Garante a linha do mês (idempotente, sem inflar contador).
  insert into public.monthly_usage (user_id, year_month, affiliate_clicks_count)
  values (p_user_id, p_year_month, 0)
  on conflict (user_id, year_month) do nothing;

  -- Lock pessimista pra serializar concorrentes no mesmo (user, month).
  select affiliate_clicks_count
    into v_count
    from public.monthly_usage
   where user_id = p_user_id
     and year_month = p_year_month
     for update;

  if p_limit is not null and v_count >= p_limit then
    allowed   := false;
    new_count := v_count;
    return next;
    return;
  end if;

  update public.monthly_usage
     set affiliate_clicks_count = affiliate_clicks_count + 1
   where user_id = p_user_id
     and year_month = p_year_month
   returning affiliate_clicks_count into v_count;

  allowed   := true;
  new_count := v_count;
  return next;
  return;
end;
$$;

grant execute on function public.try_increment_affiliate_click(text, text, int)
  to authenticated, service_role;
