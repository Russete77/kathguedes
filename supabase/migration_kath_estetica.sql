-- ============================================
-- KATH GUEDES ESTÉTICA AUTOMOTIVA
-- Schema + RLS + Storage + RPCs
-- ============================================
-- Tabelas: estetica_services, estetica_bookings,
--          estetica_schedule, estetica_slots_blocked,
--          estetica_portfolio, estetica_loyalty_photos
-- Storage: estetica-portfolio (público), estetica-loyalty (privado)
-- Fidelidade: 4 fotos aprovadas/mês → 5ª lavagem grátis
-- Lazy cleanup: ao inserir foto, apaga as do mês anterior do mesmo user
-- ============================================


-- ============================================
-- 1. ESTETICA_SERVICES — Catálogo de serviços
-- ============================================
create table public.estetica_services (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  image_url       text,
  category        text not null
                  check (category in ('lavagem', 'polimento', 'vitrificacao', 'higienizacao', 'cristalizacao', 'outros')),
  duration_min    int not null default 60,        -- duração pra alocar slot no agendamento
  price_cents     int not null,
  compare_price   int,                            -- preço "de/por"
  discount_start  int not null default 0,
  discount_pro    int not null default 0,
  discount_vip    int not null default 0,
  includes        text[] not null default '{}',   -- lista do que inclui
  eligible_for_loyalty boolean not null default true,  -- se conta no programa 4→5ª grátis
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.estetica_services enable row level security;

-- Qualquer autenticado vê serviços ativos
create policy "estetica_services_select_active"
  on public.estetica_services for select
  to authenticated
  using (is_active = true);

-- Admin total
create policy "estetica_services_admin"
  on public.estetica_services for all
  to service_role
  using (true)
  with check (true);

create index idx_estetica_services_active on public.estetica_services(is_active, sort_order);
create index idx_estetica_services_category on public.estetica_services(category);


-- ============================================
-- 2. ESTETICA_SCHEDULE — Horário de funcionamento semanal
-- ============================================
create table public.estetica_schedule (
  day_of_week  int primary key check (day_of_week between 0 and 6), -- 0=domingo
  opens_at     time,
  closes_at    time,
  is_closed    boolean not null default false,
  slot_minutes int not null default 60             -- granularidade de slots
);

alter table public.estetica_schedule enable row level security;

create policy "estetica_schedule_select_all"
  on public.estetica_schedule for select
  to authenticated
  using (true);

create policy "estetica_schedule_admin"
  on public.estetica_schedule for all
  to service_role
  using (true)
  with check (true);

-- Seed padrão: ter-sab 8h-18h, seg e dom fechado
insert into public.estetica_schedule (day_of_week, opens_at, closes_at, is_closed, slot_minutes) values
  (0, null, null, true, 60),
  (1, null, null, true, 60),
  (2, '08:00', '18:00', false, 60),
  (3, '08:00', '18:00', false, 60),
  (4, '08:00', '18:00', false, 60),
  (5, '08:00', '18:00', false, 60),
  (6, '08:00', '17:00', false, 60);


-- ============================================
-- 3. ESTETICA_SLOTS_BLOCKED — Bloqueios avulsos (folgas, feriados)
-- ============================================
create table public.estetica_slots_blocked (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.estetica_slots_blocked enable row level security;

create policy "estetica_slots_blocked_select_all"
  on public.estetica_slots_blocked for select
  to authenticated
  using (true);

create policy "estetica_slots_blocked_admin"
  on public.estetica_slots_blocked for all
  to service_role
  using (true)
  with check (true);

create index idx_estetica_slots_blocked_range on public.estetica_slots_blocked(starts_at, ends_at);


-- ============================================
-- 4. ESTETICA_BOOKINGS — Agendamentos
-- ============================================
create table public.estetica_bookings (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references public.profiles(id),
  service_id      uuid not null references public.estetica_services(id),
  scheduled_at    timestamptz not null,
  duration_min    int not null,                   -- snapshot do service.duration_min
  vehicle_brand   text not null,
  vehicle_model   text not null,
  vehicle_plate   text not null,
  vehicle_color   text,
  customer_name   text not null,
  customer_phone  text not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'in_progress', 'done', 'canceled', 'no_show')),
  price_cents     int not null,                   -- preço base snapshot server-side
  plan_discount_cents int not null default 0,     -- desconto aplicado pelo plan_tier
  loyalty_free    boolean not null default false, -- 5ª lavagem grátis (4 fotos aprovadas)
  total_cents     int not null,                   -- price - plan_discount (se loyalty_free, total=0)
  asaas_payment_id text,
  paid_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.estetica_bookings enable row level security;

create policy "estetica_bookings_select_own"
  on public.estetica_bookings for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- Insert via server action (admin client) — não expomos direto
create policy "estetica_bookings_admin"
  on public.estetica_bookings for all
  to service_role
  using (true)
  with check (true);

create index idx_estetica_bookings_user on public.estetica_bookings(user_id, created_at desc);
create index idx_estetica_bookings_status on public.estetica_bookings(status);
create index idx_estetica_bookings_scheduled on public.estetica_bookings(scheduled_at);
create index idx_estetica_bookings_service on public.estetica_bookings(service_id);


-- ============================================
-- 5. ESTETICA_PORTFOLIO — Antes/depois
-- ============================================
create table public.estetica_portfolio (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  service_id  uuid references public.estetica_services(id) on delete set null,
  before_url  text not null,
  after_url   text not null,
  description text,
  is_featured boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.estetica_portfolio enable row level security;

-- Público (qualquer autenticado vê)
create policy "estetica_portfolio_select_all"
  on public.estetica_portfolio for select
  to authenticated
  using (true);

create policy "estetica_portfolio_admin"
  on public.estetica_portfolio for all
  to service_role
  using (true)
  with check (true);

create index idx_estetica_portfolio_featured on public.estetica_portfolio(is_featured, sort_order);


-- ============================================
-- 6. ESTETICA_LOYALTY_PHOTOS — Programa 4 fotos/mês → 5ª grátis
-- ============================================
create table public.estetica_loyalty_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.profiles(id) on delete cascade,
  booking_id  uuid not null references public.estetica_bookings(id) on delete cascade,
  photo_url   text not null,
  month       text not null,                      -- YYYY-MM (pra contagem mensal)
  approved    boolean not null default false,     -- admin valida pra contar
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (booking_id)                             -- 1 foto por booking (anti-fraude)
);

alter table public.estetica_loyalty_photos enable row level security;

create policy "estetica_loyalty_select_own"
  on public.estetica_loyalty_photos for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "estetica_loyalty_insert_own"
  on public.estetica_loyalty_photos for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "estetica_loyalty_admin"
  on public.estetica_loyalty_photos for all
  to service_role
  using (true)
  with check (true);

create index idx_estetica_loyalty_user_month on public.estetica_loyalty_photos(user_id, month, approved);


-- ============================================
-- RPC: check_loyalty_eligibility(user_id)
-- Retorna true se o user tem ≥ 4 fotos aprovadas no mês atual E ainda não usou o reward
-- ============================================
create or replace function public.check_loyalty_eligibility(p_user_id text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_approved_count int;
  v_already_used boolean;
begin
  -- Conta fotos aprovadas do mês atual
  select count(*) into v_approved_count
  from public.estetica_loyalty_photos
  where user_id = p_user_id
    and month = v_current_month
    and approved = true;

  -- Já tem algum booking loyalty_free do mês?
  select exists(
    select 1 from public.estetica_bookings
    where user_id = p_user_id
      and loyalty_free = true
      and to_char(scheduled_at, 'YYYY-MM') = v_current_month
  ) into v_already_used;

  return v_approved_count >= 4 and not v_already_used;
end;
$$;


-- ============================================
-- RPC: lazy_cleanup_loyalty_photos(user_id)
-- Apaga fotos do user de meses anteriores ao atual.
-- Chamar toda vez que o user submete nova foto — mantém bucket limpo sem cron.
-- Deleta apenas linhas da tabela; as objects no storage devem ser apagadas
-- pelo código de aplicação ANTES de chamar esta função (precisa da URL).
-- ============================================
create or replace function public.lazy_cleanup_loyalty_photos(p_user_id text)
returns int
language plpgsql
security definer
as $$
declare
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_deleted int;
begin
  delete from public.estetica_loyalty_photos
  where user_id = p_user_id
    and month < v_current_month;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- ============================================
-- RPC: get_available_slots(date, service_duration_min)
-- Retorna array de horários disponíveis para uma data específica
-- ============================================
create or replace function public.get_available_slots(
  p_date date,
  p_duration_min int
)
returns timestamptz[]
language plpgsql
security definer
as $$
declare
  v_dow int := extract(dow from p_date)::int;
  v_schedule record;
  v_slot timestamptz;
  v_end_slot timestamptz;
  v_slots timestamptz[] := '{}';
  v_day_end timestamptz;
begin
  -- Buscar horário do dia
  select * into v_schedule from public.estetica_schedule where day_of_week = v_dow;
  if v_schedule is null or v_schedule.is_closed then
    return v_slots;
  end if;

  v_slot := (p_date + v_schedule.opens_at)::timestamptz;
  v_day_end := (p_date + v_schedule.closes_at)::timestamptz;

  while v_slot + (p_duration_min || ' minutes')::interval <= v_day_end loop
    v_end_slot := v_slot + (p_duration_min || ' minutes')::interval;

    -- Slot livre se não colide com booking ativo nem com bloqueio
    if not exists (
      select 1 from public.estetica_bookings
      where status in ('pending', 'confirmed', 'in_progress')
        and tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval)
            && tstzrange(v_slot, v_end_slot)
    ) and not exists (
      select 1 from public.estetica_slots_blocked
      where tstzrange(starts_at, ends_at) && tstzrange(v_slot, v_end_slot)
    ) then
      v_slots := array_append(v_slots, v_slot);
    end if;

    v_slot := v_slot + (v_schedule.slot_minutes || ' minutes')::interval;
  end loop;

  return v_slots;
end;
$$;


-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Portfólio: público (qualquer um pode ler; apenas service_role escreve)
insert into storage.buckets (id, name, public)
values ('estetica-portfolio', 'estetica-portfolio', true)
on conflict (id) do nothing;

-- Loyalty: privado (user só escreve e lê as próprias; admin acesso total)
insert into storage.buckets (id, name, public)
values ('estetica-loyalty', 'estetica-loyalty', false)
on conflict (id) do nothing;

-- ── Policies: estetica-portfolio ──
create policy "estetica_portfolio_read_public"
  on storage.objects for select
  to public
  using (bucket_id = 'estetica-portfolio');

create policy "estetica_portfolio_write_admin"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'estetica-portfolio');

create policy "estetica_portfolio_delete_admin"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'estetica-portfolio');

-- ── Policies: estetica-loyalty ──
-- User só pode ver/inserir/deletar fotos no path dele (prefix = user_id)
create policy "estetica_loyalty_read_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'estetica-loyalty'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "estetica_loyalty_write_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'estetica-loyalty'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "estetica_loyalty_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'estetica-loyalty'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "estetica_loyalty_admin"
  on storage.objects for all
  to service_role
  using (bucket_id = 'estetica-loyalty')
  with check (bucket_id = 'estetica-loyalty');


-- ============================================
-- TRIGGER: updated_at automático em bookings
-- ============================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger estetica_bookings_touch_updated_at
  before update on public.estetica_bookings
  for each row
  execute function public.touch_updated_at();
