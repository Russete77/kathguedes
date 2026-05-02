-- ============================================
-- MIGRATION: Notifications + Push Subscriptions
-- ============================================

-- ── Push Subscriptions (Web Push tokens) ──
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references public.profiles(id) on delete cascade,
  subscription jsonb not null,  -- { endpoint, keys: { p256dh, auth } }
  created_at   timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_select_own"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "push_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "push_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "push_admin"
  on public.push_subscriptions for all
  to service_role
  using (true)
  with check (true);

-- ── In-App Notifications ──
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  icon       text,           -- lucide icon name
  url        text,           -- deep link no app
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notif_select_own"
  on public.notifications for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "notif_update_own"
  on public.notifications for update
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "notif_admin"
  on public.notifications for all
  to service_role
  using (true)
  with check (true);

-- ── Indexes ──
create index idx_push_user on public.push_subscriptions(user_id);
create index idx_notif_user on public.notifications(user_id, is_read, created_at desc);
