-- ============================================================================
-- 23. WELLNESS — Lembretes de hidratação + vídeos motivacionais diários
-- ============================================================================
-- Duas features de engajamento:
--
--  • HIDRATAÇÃO: lembretes em horários customizáveis. **Somente planos pagos**
--    (gate aplicado no cron + na server action de preferências).
--  • VÍDEO MOTIVACIONAL DIÁRIO: 1 push por dia com link de YouTube curto.
--    Disponível para TODOS os planos, inclusive free.
--
-- Schema:
--  - wellness_reminders: 1 row por user com prefs. Default opt-in para vídeo
--    motivacional e opt-out para hidratação.
--  - motivational_videos: biblioteca de vídeos. Cron escolhe um por dia via
--    hash do dia (dia do ano % count) para determinismo + rotação.
-- ============================================================================

-- ── wellness_reminders ─────────────────────────────────────────────────────
create table if not exists public.wellness_reminders (
  user_id              text primary key references public.profiles(id) on delete cascade,
  -- Hidratação (planos pagos)
  hydration_enabled    boolean not null default false,
  hydration_times      time[]  not null default array['09:00','12:00','15:00','18:00']::time[],
  -- Vídeo motivacional diário (todos os planos)
  daily_video_enabled  boolean not null default true,
  daily_video_time     time    not null default '08:00',
  -- Auditoria
  last_hydration_sent  timestamptz,
  last_video_sent      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Defensive reconcile (caso tabela pré-existente parcial)
alter table public.wellness_reminders add column if not exists hydration_enabled boolean not null default false;
alter table public.wellness_reminders add column if not exists hydration_times time[] not null default array['09:00','12:00','15:00','18:00']::time[];
alter table public.wellness_reminders add column if not exists daily_video_enabled boolean not null default true;
alter table public.wellness_reminders add column if not exists daily_video_time time not null default '08:00';
alter table public.wellness_reminders add column if not exists last_hydration_sent timestamptz;
alter table public.wellness_reminders add column if not exists last_video_sent timestamptz;
alter table public.wellness_reminders add column if not exists created_at timestamptz not null default now();
alter table public.wellness_reminders add column if not exists updated_at timestamptz not null default now();

alter table public.wellness_reminders enable row level security;

-- O próprio user lê e atualiza suas prefs.
drop policy if exists wellness_reminders_select_own on public.wellness_reminders;
create policy wellness_reminders_select_own on public.wellness_reminders
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wellness_reminders_insert_own on public.wellness_reminders;
create policy wellness_reminders_insert_own on public.wellness_reminders
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wellness_reminders_update_own on public.wellness_reminders;
create policy wellness_reminders_update_own on public.wellness_reminders
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wellness_reminders_admin on public.wellness_reminders;
create policy wellness_reminders_admin on public.wellness_reminders
  for all to service_role using (true) with check (true);

drop trigger if exists wellness_reminders_touch_updated_at on public.wellness_reminders;
create trigger wellness_reminders_touch_updated_at
  before update on public.wellness_reminders
  for each row execute function public.touch_updated_at();

-- ── motivational_videos ────────────────────────────────────────────────────
-- Hard reset: uma versão anterior parcial dessa tabela existia em produção
-- com coluna `scheduled_for NOT NULL` que conflita com o seed deste arquivo.
-- Como ainda não há uso (ninguém consome de produção), dropar é seguro.
drop table if exists public.motivational_videos cascade;

create table if not exists public.motivational_videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  youtube_id  text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.motivational_videos add column if not exists title text;
alter table public.motivational_videos add column if not exists body text;
alter table public.motivational_videos add column if not exists youtube_id text;
alter table public.motivational_videos add column if not exists sort_order int not null default 0;
alter table public.motivational_videos add column if not exists is_active boolean not null default true;
alter table public.motivational_videos add column if not exists created_at timestamptz not null default now();

alter table public.motivational_videos enable row level security;

-- Todos autenticados leem os vídeos ativos (para player in-app futuro).
drop policy if exists motivational_videos_select_active on public.motivational_videos;
create policy motivational_videos_select_active on public.motivational_videos
  for select to authenticated using (is_active = true);

drop policy if exists motivational_videos_admin on public.motivational_videos;
create policy motivational_videos_admin on public.motivational_videos
  for all to service_role using (true) with check (true);

create index if not exists idx_motivational_videos_active
  on public.motivational_videos(is_active, sort_order) where is_active = true;

-- ── SEED: 5 vídeos motivacionais iniciais (admin pode substituir/adicionar) ─
-- IDs de YouTube de placeholder — substituir pelos vídeos oficiais da Kath.
-- Idempotente via DO NOTHING quando youtube_id já existir.
insert into public.motivational_videos (title, body, youtube_id, sort_order) values
  ('Comece o dia com foco',           'Mensagem rápida da Kath para arrancar a semana.',  'dQw4w9WgXcQ',  10),
  ('Mentalidade de atleta',           '60 segundos sobre persistência e disciplina.',     'dQw4w9WgXcQ',  20),
  ('Hidratar é treinar',              'Por que beber água impacta direto na performance.','dQw4w9WgXcQ',  30),
  ('Pequenas vitórias diárias',       'Como celebrar o progresso e manter o ritmo.',      'dQw4w9WgXcQ',  40),
  ('Treine como Kath',                'Dica curta para alinhar postura e contração.',     'dQw4w9WgXcQ',  50)
on conflict do nothing;
