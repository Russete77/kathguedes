-- 52_consultoria_ia_periodizacao.sql
-- Base para a consultoria assistida por IA + periodização em blocos de 6 semanas.
--
-- 1) Metadados de periodização nos vídeos da biblioteca (a IA e os blocos-modelo
--    usam isto para escolher os vídeos certos por bloco/semana/dia da divisão).
-- 2) Mapa de splits por frequência semanal (config editável pelo admin).
-- 3) Colunas de rascunho de IA na consultoria (sem novo status — "rascunho IA"
--    = status in_progress + ai_draft_generated_at preenchido).

-- ── 1. workout_videos: periodização ──
alter table public.workout_videos
  add column if not exists block          int,           -- mesociclo (1,2,3…); troca a cada 6 semanas
  add column if not exists week_in_block   int,           -- 1..6 (exercícios mudam dentro do bloco)
  add column if not exists split_slot      text,          -- dia da divisão (ex.: 'gluteo','superior','fullbody_a')
  add column if not exists track           text;          -- trilha (ex.: 'iniciante','intermediario','hipertrofia')

create index if not exists idx_workout_videos_periodization
  on public.workout_videos(track, block, week_in_block, split_slot);

-- ── 2. training_splits: mapa frequência → lista de split_slots ──
create table if not exists public.training_splits (
  frequency  int primary key check (frequency between 1 and 7),
  slots      text[] not null,            -- ex.: ['gluteo','superior','quadriceps','posterior']
  label      text,                       -- nome amigável (ex.: 'Upper/Lower 4x')
  updated_at timestamptz not null default now()
);

alter table public.training_splits enable row level security;

drop policy if exists training_splits_select on public.training_splits;
create policy training_splits_select on public.training_splits
  for select to authenticated using (true);

drop policy if exists training_splits_admin on public.training_splits;
create policy training_splits_admin on public.training_splits
  for all to service_role using (true) with check (true);

-- Seed inicial de exemplo (o admin ajusta na tela de config). Edite à vontade.
insert into public.training_splits (frequency, slots, label) values
  (3, array['fullbody_a','fullbody_b','fullbody_c'],                       'Full Body 3x'),
  (4, array['inferior_gluteo','superior','inferior_posterior','superior'], 'Inferior/Superior 4x'),
  (5, array['gluteo','superior','quadriceps','posterior','fullbody'],      'Foco 5x'),
  (6, array['push','pull','legs','push','pull','legs'],                    'PPL 6x')
on conflict (frequency) do nothing;

-- ── 3. consultations: rascunho de IA ──
alter table public.consultations
  add column if not exists ai_draft_generated_at timestamptz,
  add column if not exists ai_flags              jsonb;   -- avisos p/ revisão (lesão/equipamento)

create index if not exists idx_consultations_ai_draft
  on public.consultations(ai_draft_generated_at)
  where ai_draft_generated_at is not null;
