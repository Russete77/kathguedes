-- ============================================================================
-- MIGRATION 41: workout_videos.is_free_preview — gate de freemium
-- ============================================================================
--
-- Problema: ate aqui o gate de treinos era APENAS por tier
-- (planLevel(required_plan) > userLevel). Como todo user nasce com
-- plan_tier='start' (default do schema) e todo workout_videos.required_plan
-- nasce com default 'start' tambem, a regra `1 > 1` retornava false e o
-- visitante nao-pagante via TODO o catalogo desbloqueado.
--
-- Fix: adicionar coluna `is_free_preview` boolean. A regra de gating no app
-- passa a ser:
--   is_free_preview || (subscription_status='active' AND tier ok)
--
-- Assim quem nao pagou ve so os treinos marcados como preview; o resto
-- aparece com cadeado + CTA /planos. Quem paga, ve tudo da escada do tier.
--
-- Seed inicial: marca os 5 primeiros treinos publicados (por sort_order,
-- depois published_at) como preview. Admin troca depois via UI.
-- ============================================================================

begin;

-- 1. Coluna nova — default false pra nao quebrar treinos ja cadastrados.
alter table public.workout_videos
  add column if not exists is_free_preview boolean not null default false;

-- 2. Index parcial — queries do app filtram por is_free_preview=true muito.
create index if not exists idx_workout_videos_free_preview
  on public.workout_videos(sort_order)
  where is_free_preview = true and is_published = true;

-- 3. Seed inicial: marca os 5 primeiros publicados como preview.
--    Usa CTE com row_number() pra garantir determinismo em re-execucoes.
with ranked as (
  select id,
         row_number() over (
           order by sort_order asc nulls last,
                    published_at desc nulls last,
                    id asc
         ) as rn
  from public.workout_videos
  where is_published = true
)
update public.workout_videos w
   set is_free_preview = true
  from ranked
 where ranked.id = w.id
   and ranked.rn <= 5;

commit;
