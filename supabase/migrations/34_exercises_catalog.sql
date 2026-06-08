-- ============================================
-- MIGRATION 34: exercises_catalog
-- ============================================
--
-- Cria catalogo de exercicios (tabela `exercises`) — resolve Gap CTO 2.
--
-- Hoje exercicios sao texto livre dentro do JSONB de plan_templates e
-- consultations.workout_plan ('{ name: "Agachamento", sets, reps, rest }').
-- Isso gera:
-- - "Agachamento" vs "agachamento" vs "AGACHAMENTO" = 3 exercicios diferentes
-- - Sem validacao de nome
-- - Sem relatorios "qual exercicio e mais usado"
-- - Sem hierarquia categoria → grupo secundario
--
-- Tabela `exercises` vira fonte de verdade:
-- - name UNIQUE (case-sensitive — admin valida via UI)
-- - primary_category usa mesmo enum que workout_videos
-- - secondary_groups (text[]) pra hierarquia multi-grupo (ex: "Hip Thrust" e
--   gluteo mas tambem pega posterior)
-- - equipment (text[]) pra filtrar por equipamento (ex: "barra,banco")
-- - workout_video_id (FK opcional) pra linkar com biblioteca de treinos
-- - default_sets/reps/rest pra preencher automaticamente ao adicionar em plano
--
-- O JSONB de templates/consultations pode opcionalmente referenciar
-- exercise_id (string uuid) pra rastreabilidade. Nao e FK estrita (esta em
-- JSONB), mas permite analytics futuros.
-- ============================================

begin;

-- ============================================
-- 1. Tabela exercises
-- ============================================
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  primary_category  text not null check (primary_category in (
    'gluteo','pernas','quadriceps','costas','ombro','biceps','triceps',
    'peito','abdomen','superior','inferior','hiit','cardio','funcional',
    'full','alongamento','aquecimento','viagem','competicao'
  )),
  secondary_groups  text[] not null default '{}',
  equipment         text[] not null default '{}',
  default_sets      int not null default 3,
  default_reps      text not null default '10-12',
  default_rest      int not null default 60,
  notes             text,
  workout_video_id  uuid references public.workout_videos(id) on delete set null,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================
-- 2. Indexes
-- ============================================
create index if not exists idx_exercises_category
  on public.exercises(primary_category, sort_order) where is_active = true;

create index if not exists idx_exercises_video
  on public.exercises(workout_video_id) where workout_video_id is not null;

-- ============================================
-- 3. Trigger updated_at (reusa set_updated_at definida em schema.sql)
-- ============================================
drop trigger if exists trg_exercises_updated_at on public.exercises;
create trigger trg_exercises_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- ============================================
-- 4. RLS
-- ============================================
alter table public.exercises enable row level security;

drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated on public.exercises
  for select to authenticated using (is_active = true);

drop policy if exists exercises_admin on public.exercises;
create policy exercises_admin on public.exercises
  for all to service_role using (true) with check (true);

-- ============================================
-- 5. SEED inicial — ~45 exercicios cobrindo grupos principais
-- ============================================
insert into public.exercises
  (name, primary_category, secondary_groups, equipment, default_sets, default_reps, default_rest, sort_order)
values
  -- Gluteo
  ('Hip Thrust',                'gluteo',  '{posterior}',                  '{barra,banco}',    4, '12-15', 90, 1),
  ('Hip Thrust Unilateral',     'gluteo',  '{posterior}',                  '{banco}',          3, '10-12', 90, 2),
  ('Gluteo 4 Apoios (Coice)',   'gluteo',  '{}',                           '{caneleira}',      3, '15',    60, 3),
  ('Elevacao Pelvica no Solo',  'gluteo',  '{}',                           '{}',               3, '15-20', 45, 4),
  ('Abducao na Maquina',        'gluteo',  '{}',                           '{maquina}',        3, '15',    60, 5),
  ('Cadeira Abdutora',          'gluteo',  '{}',                           '{maquina}',        3, '15',    60, 6),
  ('Coice no Cabo',             'gluteo',  '{}',                           '{polia,caneleira}',3, '15',    60, 7),

  -- Pernas (quadriceps + posterior)
  ('Agachamento Livre',         'pernas',  '{quadriceps,gluteo}',          '{barra,rack}',     4, '8-10',  120, 10),
  ('Agachamento Bulgaro',       'pernas',  '{quadriceps,gluteo}',          '{halter,banco}',   4, '8-10',  120, 11),
  ('Leg Press 45',              'pernas',  '{quadriceps,gluteo}',          '{maquina}',        4, '10-12', 90, 12),
  ('Leg Press Obliquo',         'pernas',  '{quadriceps}',                 '{maquina}',        3, '10-12', 90, 13),
  ('Hack Machine',              'pernas',  '{quadriceps,gluteo}',          '{maquina}',        4, '10-12', 90, 14),
  ('Cadeira Extensora',         'pernas',  '{quadriceps}',                 '{maquina}',        3, '12-15', 60, 15),
  ('Stiff Leg Deadlift',        'pernas',  '{posterior}',                  '{barra,halter}',   3, '10-12', 90, 16),
  ('Stiff Deadlift',            'pernas',  '{posterior,gluteo}',           '{barra,halter}',   3, '10-12', 90, 17),
  ('Leg Curl Deitado',          'pernas',  '{posterior}',                  '{maquina}',        4, '10-12', 60, 18),
  ('Leg Curl Sentado',          'pernas',  '{posterior}',                  '{maquina}',        3, '12',    60, 19),
  ('Cadeira Adutora',           'pernas',  '{}',                           '{maquina}',        3, '15',    60, 20),
  ('Panturrilha em Pe',         'pernas',  '{panturrilha}',                '{maquina}',        4, '15-20', 45, 21),
  ('Panturrilha Sentado',       'pernas',  '{panturrilha}',                '{maquina}',        3, '15-20', 45, 22),
  ('Avanco com Halteres',       'pernas',  '{quadriceps,gluteo}',          '{halter}',         3, '10-12', 60, 23),

  -- Costas
  ('Puxada na Maquina',         'costas',  '{biceps}',                     '{maquina}',        4, '8-10',  90, 30),
  ('Puxada Supinada',           'costas',  '{biceps}',                     '{maquina}',        4, '8-10',  90, 31),
  ('Remada Curvada',            'costas',  '{}',                           '{barra,halter}',   4, '8-10',  90, 32),
  ('Remada Cavalinho',          'costas',  '{}',                           '{barra,polia}',    4, '10',    90, 33),
  ('Barra Fixa',                'costas',  '{biceps}',                     '{}',               3, '6-10',  120, 34),
  ('Pulldown Triangulo',        'costas',  '{biceps}',                     '{polia}',          3, '10-12', 60, 35),

  -- Peito
  ('Supino Reto',               'peito',   '{ombro,triceps}',              '{barra,banco}',    4, '8-10',  120, 40),
  ('Supino Inclinado',          'peito',   '{ombro,triceps}',              '{barra,banco}',    4, '8-10',  120, 41),
  ('Crucifixo Inclinado',       'peito',   '{}',                           '{halter,banco}',   3, '12',    60, 42),
  ('Voador Peitoral',           'peito',   '{}',                           '{maquina}',        3, '12',    60, 43),

  -- Ombro
  ('Desenvolvimento com Halteres','ombro', '{triceps}',                    '{halter,banco}',   4, '8-10',  90, 50),
  ('Elevacao Lateral',          'ombro',   '{}',                           '{halter}',         3, '12',    45, 51),
  ('Elevacao Frontal',          'ombro',   '{}',                           '{halter,barra}',   3, '12',    45, 52),
  ('Crucifixo Inverso',         'ombro',   '{costas}',                     '{halter,maquina}', 3, '12',    45, 53),

  -- Biceps
  ('Rosca Direta',              'biceps',  '{}',                           '{barra,halter}',   3, '10-12', 60, 60),
  ('Rosca Inversa',             'biceps',  '{}',                           '{barra}',          3, '12',    60, 61),
  ('Rosca Martelo',             'biceps',  '{}',                           '{halter}',         3, '10-12', 60, 62),
  ('Flexao de Isquiotibiais',   'biceps',  '{}',                           '{maquina}',        3, '12',    60, 63),

  -- Triceps
  ('Triceps Pulley',            'triceps', '{}',                           '{polia}',          3, '10-12', 60, 70),
  ('Triceps Testa',             'triceps', '{}',                           '{barra,halter}',   3, '10-12', 60, 71),
  ('Mergulho em Paralelas',     'triceps', '{peito,ombro}',                '{}',               3, '8-10',  90, 72),

  -- Abdomen
  ('Prancha Frontal',           'abdomen', '{core}',                       '{}',               3, '45s',   30, 80),
  ('Abdominal Crunch',          'abdomen', '{}',                           '{}',               3, '15-20', 30, 81),
  ('Russian Twist',             'abdomen', '{obliquos}',                   '{halter}',         3, '20',    30, 82),

  -- HIIT / Cardio
  ('Burpee',                    'hiit',    '{full}',                       '{}',               4, '15',    30, 90),
  ('Mountain Climber',          'hiit',    '{abdomen}',                    '{}',               4, '30s',   30, 91),
  ('Pular Corda',               'cardio',  '{}',                           '{corda}',          3, '60s',   30, 92),
  ('Polichinelo',               'hiit',    '{}',                           '{}',               4, '30s',   30, 93),
  ('Sprint na Esteira',         'cardio',  '{}',                           '{esteira}',        4, '20s',   60, 94)
on conflict (name) do nothing;

commit;
