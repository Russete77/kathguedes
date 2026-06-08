-- ============================================
-- MIGRATION 35: check_constraints_v2
-- ============================================
--
-- Conserta CHECK constraints e RLS policies que ficaram com referências
-- aos planos antigos (free/acesso/plano1/plano2/plano3) após migration 31.
--
-- BUG CRÍTICO descoberto pela auditoria CTO (25/05/26):
--
-- 1. RLS `messages_insert_chat` exige plan_tier IN ('plano3','atleta'),
--    mas plano3 NÃO EXISTE MAIS após migration 31. Resultado: TODOS os
--    users (incluindo saude_completa/atleta) ficam BLOQUEADOS de enviar
--    mensagem no chat. Chat 100% quebrado em prod.
--
-- 2. CHECK constraints de `required_plan` em coupons, affiliate_links e
--    moto_events ainda referenciam os 6 tiers antigos. Migrar slugs
--    antigos pros novos (mesma lógica da migration 31) e atualizar CHECK.
--
-- Migration 31 já cobriu profiles.plan_tier + workout_videos.required_plan.
-- Migration 30 já cobriu products.module + coupons.module + affiliate_links.module.
-- ============================================

begin;

-- ============================================
-- 1. coupons.required_plan: drop CHECK → migrate slugs → add CHECK → default
-- ============================================
alter table public.coupons drop constraint if exists coupons_required_plan_check;

update public.coupons set required_plan = 'start'          where required_plan in ('free', 'acesso', 'plano1');
update public.coupons set required_plan = 'evolucao'       where required_plan = 'plano2';
update public.coupons set required_plan = 'saude_completa' where required_plan = 'plano3';

alter table public.coupons add constraint coupons_required_plan_check
  check (required_plan in ('start', 'evolucao', 'saude_completa', 'atleta'));

alter table public.coupons alter column required_plan set default 'start';

-- ============================================
-- 2. affiliate_links.required_plan: idem
-- ============================================
alter table public.affiliate_links drop constraint if exists affiliate_links_required_plan_check;

update public.affiliate_links set required_plan = 'start'          where required_plan in ('free', 'acesso', 'plano1');
update public.affiliate_links set required_plan = 'evolucao'       where required_plan = 'plano2';
update public.affiliate_links set required_plan = 'saude_completa' where required_plan = 'plano3';

alter table public.affiliate_links add constraint affiliate_links_required_plan_check
  check (required_plan in ('start', 'evolucao', 'saude_completa', 'atleta'));

alter table public.affiliate_links alter column required_plan set default 'start';

-- ============================================
-- 3. moto_events.required_plan: idem (se a tabela ainda existir)
-- ============================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_name = 'moto_events' and table_schema = 'public'
  ) then
    alter table public.moto_events drop constraint if exists moto_events_required_plan_check;

    update public.moto_events set required_plan = 'start'          where required_plan in ('free', 'acesso', 'plano1');
    update public.moto_events set required_plan = 'evolucao'       where required_plan = 'plano2';
    update public.moto_events set required_plan = 'saude_completa' where required_plan = 'plano3';

    alter table public.moto_events add constraint moto_events_required_plan_check
      check (required_plan in ('start', 'evolucao', 'saude_completa', 'atleta'));

    alter table public.moto_events alter column required_plan set default 'start';
  end if;
end $$;

-- ============================================
-- 4. CRÍTICO: RLS messages_insert_chat — destrava chat dos planos novos
-- Antes: in ('plano3','atleta')  ← bloqueava TODOS os users
-- Depois: in ('saude_completa','atleta')
-- ============================================
drop policy if exists messages_insert_chat on public.messages;
create policy messages_insert_chat on public.messages
  for insert to authenticated
  with check (
    (select auth.jwt()->>'sub') = user_id
    and sender_role = 'user'
    and (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        in ('saude_completa', 'atleta')
  );

commit;
