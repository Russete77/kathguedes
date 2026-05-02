-- ============================================
-- MIGRATION: Consultoria in-app (sem PDF)
-- Treino e dieta renderizados nativamente
-- ============================================

-- Remover colunas de PDF
ALTER TABLE public.consultations DROP COLUMN IF EXISTS workout_plan_url;
ALTER TABLE public.consultations DROP COLUMN IF EXISTS diet_plan_url;

-- Adicionar plano de treino estruturado (JSONB)
-- Formato: { weeks: [{ name: "Semana 1", days: [{ name: "Segunda", exercises: [{ name, sets, reps, rest, notes }] }] }] }
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS workout_plan jsonb;

-- Adicionar plano alimentar estruturado (JSONB)
-- Formato: { meals: [{ name: "Café da manhã", time: "07:00", foods: [{ name, quantity, unit, calories, protein, carbs, fat }] }] }
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS diet_plan jsonb;

-- Adicionar totais de macros diários
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS daily_calories int;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS daily_protein int;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS daily_carbs int;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS daily_fat int;
