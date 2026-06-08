-- ============================================================================
-- MIGRATION 42: workout_videos.category — adicionar 'posterior' (Posterior de Coxa)
-- ============================================================================
--
-- Nova categoria de treino na Biblioteca de Vídeos: 'posterior' (posterior de
-- coxa / isquiotibiais). O código (constants/categories.ts, constants/fitness.ts,
-- forms e picker admin) já passa a oferecer a opção; o CHECK do DB precisa
-- aceitar o novo slug, senão insert/edit de vídeo com category='posterior'
-- falha com 23514 (violates check constraint workout_videos_category_check).
--
-- Segue o mesmo padrão da migration 40. Drop + add do constraint, sem dataloss.
-- ============================================================================

begin;

alter table public.workout_videos
  drop constraint if exists workout_videos_category_check;

alter table public.workout_videos
  add constraint workout_videos_category_check
  check (category in (
    'gluteo', 'pernas', 'quadriceps', 'posterior',
    'costas', 'ombro', 'biceps', 'triceps',
    'peito', 'abdomen',
    'superior', 'inferior',
    'hiit', 'cardio', 'funcional',
    'full', 'alongamento', 'aquecimento',
    'viagem', 'competicao'
  ));

-- Catálogo de exercícios (migration 34) compartilha o mesmo enum de categoria.
-- Mantém consistência: 'posterior' também válido em exercises.primary_category.
alter table public.exercises
  drop constraint if exists exercises_primary_category_check;

alter table public.exercises
  add constraint exercises_primary_category_check
  check (primary_category in (
    'gluteo', 'pernas', 'quadriceps', 'posterior',
    'costas', 'ombro', 'biceps', 'triceps',
    'peito', 'abdomen',
    'superior', 'inferior',
    'hiit', 'cardio', 'funcional',
    'full', 'alongamento', 'aquecimento',
    'viagem', 'competicao'
  ));

commit;
