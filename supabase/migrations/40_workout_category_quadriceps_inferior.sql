-- ============================================================================
-- MIGRATION 40: workout_videos.category — adicionar 'quadriceps' e 'inferior'
-- ============================================================================
--
-- O CHECK constraint original (schema.sql) só permitia:
--   gluteo, pernas, costas, ombro, biceps, triceps, peito, abdomen,
--   superior, hiit, cardio, funcional, full, alongamento, aquecimento,
--   viagem, competicao
--
-- O código (constants/categories.ts, forms admin, picker) já oferecia
-- 'quadriceps' e 'inferior' há tempos, mas o CHECK do DB nunca foi atualizado.
-- Resultado: edit/insert de treino com essas categorias falha com 23514:
--   "violates check constraint workout_videos_category_check".
--
-- Esta migration drop+add do constraint com a lista expandida. Sem dataloss.
-- ============================================================================

begin;

alter table public.workout_videos
  drop constraint if exists workout_videos_category_check;

alter table public.workout_videos
  add constraint workout_videos_category_check
  check (category in (
    'gluteo', 'pernas', 'quadriceps',
    'costas', 'ombro', 'biceps', 'triceps',
    'peito', 'abdomen',
    'superior', 'inferior',
    'hiit', 'cardio', 'funcional',
    'full', 'alongamento', 'aquecimento',
    'viagem', 'competicao'
  ));

commit;
