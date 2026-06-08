-- ============================================
-- MIGRATION 33: workout_sort_order
-- ============================================
--
-- Adiciona coluna `sort_order` em workout_videos para permitir admin
-- reordenar treinos via UI (botões ↑↓), sem precisar mexer em
-- published_at manualmente via SQL.
--
-- Convenção: menor sort_order = aparece primeiro (ASC).
-- Inicialização: row_number() sobre published_at DESC, então a ordem
-- inicial fica idêntica à atual (mais recente = sort_order 1).
--
-- Após esta migration, queries em /fitness e /admin/treinos devem usar:
--   order by sort_order asc, published_at desc
-- ============================================

begin;

-- ============================================
-- 1. Adicionar coluna sort_order
-- ============================================
alter table public.workout_videos
  add column if not exists sort_order int not null default 0;

-- ============================================
-- 2. Inicializar sort_order com base no published_at atual
-- (mantém ordem visual idêntica à pré-migration)
-- ============================================
update public.workout_videos
   set sort_order = ranked.rank
  from (
    select id,
           row_number() over (order by published_at desc nulls last, id) as rank
      from public.workout_videos
  ) as ranked
 where workout_videos.id = ranked.id;

-- ============================================
-- 3. Index pra ordenação rápida
-- ============================================
create index if not exists idx_workout_videos_sort
  on public.workout_videos(sort_order asc, published_at desc nulls last);

commit;
