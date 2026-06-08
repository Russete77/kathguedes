-- ============================================================================
-- MIGRATION 38: notification_schedules (admin-driven push schedules)
-- ============================================================================
--
-- Substitui o modelo antigo onde o user escolhia horário e conteúdo (videos
-- motivacionais + lembretes de hidratação livremente configurados em
-- wellness_reminders). Decisão de produto (26/05/26): o admin define tudo
-- (horário + conteúdo + público-alvo), e o user só liga/desliga cada schedule.
--
-- Mantém compat com wellness_reminders (não dropa) — o cron pode ler de ambas
-- durante a transição. UI nova lê notification_schedules + user_notification_prefs.
--
-- Modelo:
--   notification_schedules     — gerencia o admin. Cada linha = 1 push job.
--   user_notification_prefs    — toggle por user/schedule. Persiste a escolha.
--
-- Exemplo seed:
--   - Vídeo motivacional diário 08:00 (todos os planos)
--   - Hidratação 09:00, 12:00, 15:00, 18:00 (saude_completa + atleta)
--   - Lembrete de treino 18:00 (todos)
-- ============================================================================

begin;

-- ============================================================================
-- 1. Tabela notification_schedules (admin define)
-- ============================================================================
create table if not exists public.notification_schedules (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  body            text not null,
  icon            text,
  url             text not null default '/dashboard',
  -- Horários no dia (HH:MM:SS local). Ex: ['08:00','12:00'] = 2 pushes/dia.
  times           time[] not null default array['08:00']::time[],
  -- Plans elegíveis (vazio = todos). Ex: array['saude_completa','atleta'].
  eligible_plans  text[] not null default '{}'::text[],
  -- Toggle default quando o user vê a 1a vez. true = opt-out (já vem ligado).
  default_enabled boolean not null default true,
  -- Categoria pra UI agrupar (ex: 'motivacional', 'hidratacao', 'treino').
  category        text not null default 'geral',
  sort_order      int  not null default 0,
  is_active       boolean not null default true,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_notif_schedules_active
  on public.notification_schedules (is_active, sort_order)
  where is_active = true;

drop trigger if exists trg_notif_schedules_updated_at on public.notification_schedules;
create trigger trg_notif_schedules_updated_at
  before update on public.notification_schedules
  for each row execute function public.set_updated_at();

alter table public.notification_schedules enable row level security;

drop policy if exists notif_schedules_select_authenticated on public.notification_schedules;
create policy notif_schedules_select_authenticated on public.notification_schedules
  for select to authenticated using (is_active = true);

drop policy if exists notif_schedules_admin on public.notification_schedules;
create policy notif_schedules_admin on public.notification_schedules
  for all to service_role using (true) with check (true);

-- ============================================================================
-- 2. Tabela user_notification_prefs (toggle do user)
-- ============================================================================
create table if not exists public.user_notification_prefs (
  user_id     text not null references public.profiles(id) on delete cascade,
  schedule_id uuid not null references public.notification_schedules(id) on delete cascade,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (user_id, schedule_id)
);

create index if not exists idx_user_notif_prefs_user
  on public.user_notification_prefs (user_id);

drop trigger if exists trg_user_notif_prefs_updated_at on public.user_notification_prefs;
create trigger trg_user_notif_prefs_updated_at
  before update on public.user_notification_prefs
  for each row execute function public.set_updated_at();

alter table public.user_notification_prefs enable row level security;

drop policy if exists user_notif_prefs_select_own on public.user_notification_prefs;
create policy user_notif_prefs_select_own on public.user_notification_prefs
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists user_notif_prefs_upsert_own on public.user_notification_prefs;
create policy user_notif_prefs_upsert_own on public.user_notification_prefs
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists user_notif_prefs_update_own on public.user_notification_prefs;
create policy user_notif_prefs_update_own on public.user_notification_prefs
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists user_notif_prefs_admin on public.user_notification_prefs;
create policy user_notif_prefs_admin on public.user_notification_prefs
  for all to service_role using (true) with check (true);

-- ============================================================================
-- 3. Seed inicial — reproduz o modelo antigo nas categorias certas
-- ============================================================================
insert into public.notification_schedules
  (slug, title, body, icon, url, times, eligible_plans, default_enabled, category, sort_order, description)
values
  ('motivacional-diario',
   'Vídeo motivacional do dia',
   'Sua dose diária de motivação chegou. Bora treinar?',
   'PlayCircle', '/motivacional',
   array['08:00']::time[], '{}'::text[], true, 'motivacional', 1,
   'Push diário com vídeo curto da Kath. Disponível em todos os planos.'),
  ('hidratacao',
   'Hora da água',
   'Lembre de se hidratar. Pequenos goles, grandes resultados.',
   'Droplets', '/dashboard',
   array['09:00','12:00','15:00','18:00']::time[],
   array['saude_completa','atleta'], false, 'hidratacao', 2,
   'Lembretes de hidratação. Disponível para Saúde Completa e Atleta.'),
  ('lembrete-treino',
   'Bora treinar?',
   'Streak é consistência. Não quebra hoje.',
   'Flame', '/fitness',
   array['18:00']::time[], '{}'::text[], true, 'treino', 3,
   'Lembrete diário de treino. Todos os planos.')
on conflict (slug) do nothing;

commit;
