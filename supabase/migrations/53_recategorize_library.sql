-- 53_recategorize_library.sql
-- Reorganização das categorias da biblioteca (pedido Russo, 2026-06-01):
--   - "pernas" deixa de existir → vídeos migram para "inferior".
--   - nova categoria "panturrilha" (grupamento) + move o vídeo "Panturrilha" pra ela.
--   - "Stiff" sai de glúteo → "posterior".
--   - "Cadeira Abdutora" → "gluteo".
--   - "Passada"/"Afundo" → "quadriceps" (se existirem; senão no-op → precisam ser
--     gravados/upados).
--
-- Estratégia: dropa os CHECKs de categoria, roda os UPDATEs (inclui recategorização
-- por título via ILIKE), re-sincroniza exercises pelos vídeos vinculados, e recria os
-- CHECKs já com o conjunto final (sem 'pernas', com 'panturrilha').
--
-- Os UPDATEs por título são best-effort — confira no admin (/admin/treinos/tag) depois.

begin;

-- 1. Solta os CHECKs (nomes convencionais; if exists pra ser idempotente).
alter table public.workout_videos drop constraint if exists workout_videos_category_check;
alter table public.exercises       drop constraint if exists exercises_primary_category_check;

-- 2. Merge pernas → inferior.
update public.workout_videos set category = 'inferior'        where category = 'pernas';
update public.exercises       set primary_category = 'inferior' where primary_category = 'pernas';

-- 3. Recategorizações por título (workout_videos).
update public.workout_videos set category = 'panturrilha'
  where title ilike '%panturrilha%';
update public.workout_videos set category = 'posterior'
  where category = 'gluteo' and title ilike '%stiff%';
update public.workout_videos set category = 'gluteo'
  where title ilike '%abdutora%';
update public.workout_videos set category = 'quadriceps'
  where title ilike '%passada%' or title ilike '%afundo%';

-- 4. Re-sincroniza o catálogo de exercícios pelo vídeo vinculado (a biblioteca é a
--    fonte de verdade — migration 44). Exercícios sem vídeo vinculado ficam como estão.
update public.exercises e
   set primary_category = w.category
  from public.workout_videos w
 where e.workout_video_id = w.id
   and e.primary_category is distinct from w.category;

-- 5. Recria os CHECKs com o conjunto final de categorias.
alter table public.workout_videos add constraint workout_videos_category_check
  check (category in (
    'gluteo','quadriceps','posterior','panturrilha','costas','ombro','biceps','triceps',
    'peito','abdomen','superior','inferior','hiit','cardio','funcional',
    'full','alongamento','aquecimento','viagem','competicao'
  ));

alter table public.exercises add constraint exercises_primary_category_check
  check (primary_category in (
    'gluteo','quadriceps','posterior','panturrilha','costas','ombro','biceps','triceps',
    'peito','abdomen','superior','inferior','hiit','cardio','funcional',
    'full','alongamento','aquecimento','viagem','competicao'
  ));

commit;
