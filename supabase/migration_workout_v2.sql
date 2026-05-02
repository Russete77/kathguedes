-- ============================================
-- MIGRATION: Workout v2 — mais categorias + shorts support
-- ============================================

-- Remover constraint antiga de category
ALTER TABLE public.workout_videos DROP CONSTRAINT IF EXISTS workout_videos_category_check;

-- Nova constraint com categorias expandidas
ALTER TABLE public.workout_videos ADD CONSTRAINT workout_videos_category_check
  CHECK (category IN (
    'gluteo', 'pernas', 'costas', 'ombro', 'biceps', 'triceps',
    'peito', 'abdomen', 'superior', 'hiit', 'cardio', 'funcional',
    'full', 'alongamento', 'aquecimento', 'viagem', 'competicao'
  ));

-- Adicionar campo is_short (YouTube Shorts = aspecto 9:16)
ALTER TABLE public.workout_videos ADD COLUMN IF NOT EXISTS is_short boolean NOT NULL DEFAULT false;

-- Adicionar campo para notas do treino (dicas da Kath)
ALTER TABLE public.workout_videos ADD COLUMN IF NOT EXISTS notes text;

-- Adicionar campo para equipamentos necessários
ALTER TABLE public.workout_videos ADD COLUMN IF NOT EXISTS equipment text[];
