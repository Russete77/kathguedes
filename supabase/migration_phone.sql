-- Adicionar coluna phone na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
