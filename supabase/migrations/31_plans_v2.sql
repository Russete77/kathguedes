-- ============================================
-- MIGRATION 31: plans_v2
-- ============================================
--
-- Reformula sistema de planos: 6 tiers antigos → 4 tiers novos (sem FREE).
--
-- Mapeamento:
--   free            → start           (subscription_status='canceled' — não tem acesso até assinar)
--   acesso          → start           (subscription_status='canceled' — tinha R$19,90, agora plano mínimo é R$39,90)
--   plano1   R$39,9 → start    R$39,9 (rename direto, preço igual)
--   plano2   R$74,9 → evolucao R$74,9 (rename direto)
--   plano3   R$99,9 → saude_completa R$99,9 (rename direto)
--   atleta  R$309,9 → atleta  R$309,9 (mantém slug, atualiza features)
--
-- Decisão: mantém todos os usuários (em produção testando, ninguém público). FREE/acesso
-- viram 'start' com subscription_status='canceled' para que percam acesso pago mas não
-- percam a conta.
--
-- Gate de affiliate clicks (3/mês no FREE) morre — todos os planos têm unlimited.
-- Features `workouts_preview`, `affiliate_clicks_per_month` removidas do JSONB.
-- ============================================

begin;

-- ============================================
-- 0. Desabilitar trigger guard_profile_sensitive durante a migration
-- (criada em migration 25 — bloqueia UPDATE de plan_tier/subscription_status
--  fora de service_role/postgres. SQL Editor do Supabase roda como
--  supabase_admin e bate na proteção. Reabilitamos no fim.)
-- ============================================
alter table public.profiles disable trigger trg_guard_profile_sensitive;

-- ============================================
-- 1. Marcar usuários FREE/acesso como canceled ANTES do remap
-- (depois não dá pra distinguir mais)
-- ============================================
update public.profiles
   set subscription_status = 'canceled'
 where plan_tier in ('free', 'acesso')
   and subscription_status != 'canceled';

-- ============================================
-- 2. DROP CHECK constraints ANTES de remappear os slugs
-- (os UPDATEs nos passos 4-5 violariam a CHECK antiga que só aceita
--  ('free','acesso','plano1','plano2','plano3','atleta'))
-- ============================================
alter table public.profiles       drop constraint if exists profiles_plan_tier_check;
alter table public.workout_videos drop constraint if exists workout_videos_required_plan_check;

-- ============================================
-- 3. Inserir novos slugs com levels temporários (10/11/12) — atleta já existe
-- ============================================
insert into public.plans
  (slug, name, level, price_cents, asaas_value, asaas_description, cashback_pct, store_discount_pct, features, sort_order, is_active)
values
  ('start', 'Start', 10, 3990, 39.90,
   'Kath Treinos Start — Biblioteca completa de treinos',
   3, 8,
   '{"workouts":true}'::jsonb,
   1, true),
  ('evolucao', 'Evolução', 11, 7490, 74.90,
   'Kath Treinos Evolução — Treinos + Plano alimentar',
   5, 12,
   '{"workouts":true,"diet":true,"evolution_tracking":true}'::jsonb,
   2, true),
  ('saude_completa', 'Saúde Completa', 12, 9990, 99.90,
   'Kath Treinos Saúde Completa — Treinador + Anamnese + Suplementação',
   7, 18,
   '{"workouts":true,"diet":true,"supplements":true,"anamnese_based_diet":true,"chat_sla_h":48,"chat_priority":true,"reavaliation":"monthly","hydration_alerts":true,"daily_motivation":true,"vip_group":true,"premium_content":true}'::jsonb,
   3, true)
on conflict (slug) do nothing;

-- ============================================
-- 4. Remap usuários: profiles.plan_tier
-- ============================================
update public.profiles set plan_tier = 'start'          where plan_tier in ('free', 'acesso', 'plano1');
update public.profiles set plan_tier = 'evolucao'       where plan_tier = 'plano2';
update public.profiles set plan_tier = 'saude_completa' where plan_tier = 'plano3';
-- atleta fica

-- ============================================
-- 5. Remap workout_videos.required_plan
-- ============================================
update public.workout_videos set required_plan = 'start'          where required_plan in ('free', 'acesso', 'plano1');
update public.workout_videos set required_plan = 'evolucao'       where required_plan = 'plano2';
update public.workout_videos set required_plan = 'saude_completa' where required_plan = 'plano3';

-- ============================================
-- 6. Atualizar atleta (mantém slug, atualiza name + asaas_description + features)
-- ============================================
update public.plans set
  name = 'Atleta',
  asaas_description = 'Kath Treinos Atleta — Preparação para competição (Bikini)',
  cashback_pct = 10,
  store_discount_pct = 25,
  features = '{"workouts":true,"diet":true,"supplements":true,"juices":true,"chat_sla_h":12,"chat_priority":true,"reavaliation":"weekly","video_call_per_month":1,"whatsapp_daily":true,"photo_analysis":true,"peak_week":true,"competition_planning":true,"stage_coaching":true,"athlete_group":true,"hydration_alerts":true,"daily_motivation":true,"premium_content":true}'::jsonb
where slug = 'atleta';

-- ============================================
-- 7. Deletar slugs antigos (libera levels 0-4)
-- ============================================
delete from public.plans where slug in ('free', 'acesso', 'plano1', 'plano2', 'plano3');

-- ============================================
-- 8. Renumerar levels: start=1, evolucao=2, saude_completa=3, atleta=4
-- (level tem UNIQUE constraint — fazer em ordem que evite colisão)
-- ============================================
update public.plans set level = 1 where slug = 'start';
update public.plans set level = 2 where slug = 'evolucao';
update public.plans set level = 3 where slug = 'saude_completa';
update public.plans set level = 4 where slug = 'atleta';

-- Também atualizar sort_order pra refletir ordem visual (1-based)
update public.plans set sort_order = 1 where slug = 'start';
update public.plans set sort_order = 2 where slug = 'evolucao';
update public.plans set sort_order = 3 where slug = 'saude_completa';
update public.plans set sort_order = 4 where slug = 'atleta';

-- ============================================
-- 9. ADD CHECK constraints novos + novo DEFAULT em profiles.plan_tier
-- ============================================
alter table public.profiles add constraint profiles_plan_tier_check
  check (plan_tier in ('start', 'evolucao', 'saude_completa', 'atleta'));

alter table public.profiles alter column plan_tier set default 'start';

-- ============================================
-- 10. ADD CHECK constraints novos + novo DEFAULT em workout_videos.required_plan
-- ============================================
alter table public.workout_videos add constraint workout_videos_required_plan_check
  check (required_plan in ('start', 'evolucao', 'saude_completa', 'atleta'));

alter table public.workout_videos alter column required_plan set default 'start';

-- ============================================
-- 11. Drop RPC try_increment_affiliate_click (gate FREE de 3 cliques/mês morre)
-- ============================================
drop function if exists public.try_increment_affiliate_click(text, text, int);
drop function if exists public.try_increment_affiliate_click(text, text, integer);

-- ============================================
-- 12. Drop table monthly_usage (era só pra rastrear gate de FREE)
-- ============================================
drop table if exists public.monthly_usage cascade;

-- ============================================
-- 13. Reabilitar trigger guard_profile_sensitive
-- ============================================
alter table public.profiles enable trigger trg_guard_profile_sensitive;

commit;
