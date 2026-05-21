-- ============================================================================
-- 19. KATH ESTÉTICA — Walk-in (atendimento presencial de motos)
-- ============================================================================
-- Introduz o fluxo operacional onde o funcionário registra a chegada de uma
-- moto no balcão (sem app/conta prévia do cliente). Captura placa + fotos,
-- normaliza placa em ABC1D23/ABC1234, e gera atendimento presencial atrelado
-- ao veículo (idempotente por placa) e ao cliente.
--
-- Buckets privados: as URLs são geradas sob demanda via createSignedUrl().
-- ============================================================================

-- ── Storage buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('moto-photos', 'moto-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('plate-photos', 'plate-photos', false)
on conflict (id) do nothing;

-- Storage policies: somente service_role escreve/lê. UI usa signed URLs.
drop policy if exists moto_photos_admin on storage.objects;
create policy moto_photos_admin on storage.objects
  for all to service_role
  using (bucket_id = 'moto-photos')
  with check (bucket_id = 'moto-photos');

drop policy if exists plate_photos_admin on storage.objects;
create policy plate_photos_admin on storage.objects
  for all to service_role
  using (bucket_id = 'plate-photos')
  with check (bucket_id = 'plate-photos');

-- ── estetica_customers ─────────────────────────────────────────────────────
-- Cliente da loja física. Pode (mas não precisa) estar vinculado a um
-- `profiles.id` do Clerk se já tiver conta no app.
create table if not exists public.estetica_customers (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  phone           text not null,
  cpf             text,
  email           text,
  notes           text,
  -- vínculo opcional com conta Clerk do app (text por causa do user_id do projeto)
  profile_id      text references public.profiles(id) on delete set null,
  -- admin/funcionário que criou (Clerk userId)
  created_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Defensive reconcile: caso a tabela já exista de uma tentativa anterior parcial,
-- garantir que todas as colunas referenciadas pelas policies/indexes existam.
alter table public.estetica_customers add column if not exists full_name text;
alter table public.estetica_customers add column if not exists phone text;
alter table public.estetica_customers add column if not exists cpf text;
alter table public.estetica_customers add column if not exists email text;
alter table public.estetica_customers add column if not exists notes text;
alter table public.estetica_customers add column if not exists profile_id text references public.profiles(id) on delete set null;
alter table public.estetica_customers add column if not exists created_by text;
alter table public.estetica_customers add column if not exists created_at timestamptz not null default now();
alter table public.estetica_customers add column if not exists updated_at timestamptz not null default now();

alter table public.estetica_customers enable row level security;

drop policy if exists estetica_customers_admin on public.estetica_customers;
create policy estetica_customers_admin on public.estetica_customers
  for all to service_role using (true) with check (true);

-- Cliente autenticado vê apenas o próprio registro (quando vinculado).
drop policy if exists estetica_customers_select_own on public.estetica_customers;
create policy estetica_customers_select_own on public.estetica_customers
  for select to authenticated
  using ((select auth.jwt()->>'sub') = profile_id);

create index if not exists idx_estetica_customers_phone on public.estetica_customers(phone);
create index if not exists idx_estetica_customers_cpf on public.estetica_customers(cpf) where cpf is not null;
create index if not exists idx_estetica_customers_profile on public.estetica_customers(profile_id) where profile_id is not null;

drop trigger if exists estetica_customers_touch_updated_at on public.estetica_customers;
create trigger estetica_customers_touch_updated_at
  before update on public.estetica_customers
  for each row execute function public.touch_updated_at();

-- ── estetica_vehicles ──────────────────────────────────────────────────────
-- Moto vinculada a um cliente. A `plate` é UNIQUE (já normalizada para
-- ABC1D23 / ABC1234) — idempotência do fluxo walk-in.
create table if not exists public.estetica_vehicles (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.estetica_customers(id) on delete restrict,
  -- placa normalizada (uppercase, sem traço/espaço)
  plate           text not null unique,
  brand           text,
  model           text,
  color           text,
  year            int,
  -- paths no storage (NÃO URL — gerar signed URL na exibição)
  moto_photo_path  text,
  plate_photo_path text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$')
);

-- Defensive reconcile.
alter table public.estetica_vehicles add column if not exists customer_id uuid references public.estetica_customers(id) on delete restrict;
alter table public.estetica_vehicles add column if not exists plate text;
alter table public.estetica_vehicles add column if not exists brand text;
alter table public.estetica_vehicles add column if not exists model text;
alter table public.estetica_vehicles add column if not exists color text;
alter table public.estetica_vehicles add column if not exists year int;
alter table public.estetica_vehicles add column if not exists moto_photo_path text;
alter table public.estetica_vehicles add column if not exists plate_photo_path text;
alter table public.estetica_vehicles add column if not exists notes text;
alter table public.estetica_vehicles add column if not exists created_at timestamptz not null default now();
alter table public.estetica_vehicles add column if not exists updated_at timestamptz not null default now();

-- UNIQUE constraint em plate (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estetica_vehicles_plate_key'
      and conrelid = 'public.estetica_vehicles'::regclass
  ) then
    alter table public.estetica_vehicles add constraint estetica_vehicles_plate_key unique (plate);
  end if;
end $$;

alter table public.estetica_vehicles enable row level security;

drop policy if exists estetica_vehicles_admin on public.estetica_vehicles;
create policy estetica_vehicles_admin on public.estetica_vehicles
  for all to service_role using (true) with check (true);

-- Cliente autenticado vê apenas veículos do próprio profile.
drop policy if exists estetica_vehicles_select_own on public.estetica_vehicles;
create policy estetica_vehicles_select_own on public.estetica_vehicles
  for select to authenticated
  using (
    exists (
      select 1 from public.estetica_customers c
      where c.id = customer_id
        and c.profile_id = (select auth.jwt()->>'sub')
    )
  );

create index if not exists idx_estetica_vehicles_customer on public.estetica_vehicles(customer_id);

drop trigger if exists estetica_vehicles_touch_updated_at on public.estetica_vehicles;
create trigger estetica_vehicles_touch_updated_at
  before update on public.estetica_vehicles
  for each row execute function public.touch_updated_at();

-- ── estetica_walkin_services ───────────────────────────────────────────────
-- Atendimento presencial. Diferente de `estetica_bookings` (agendamento
-- online via app), o walk-in não tem `user_id` obrigatório e não passa por
-- Asaas — pagamento é registrado offline (dinheiro/PIX/máquina).
create table if not exists public.estetica_walkin_services (
  id                uuid primary key default gen_random_uuid(),
  vehicle_id        uuid not null references public.estetica_vehicles(id) on delete restrict,
  customer_id       uuid not null references public.estetica_customers(id) on delete restrict,
  service_id        uuid references public.estetica_services(id) on delete set null,
  -- funcionário/admin que registrou (Clerk userId)
  admin_id          text not null,
  price_cents       int  not null check (price_cents >= 0),
  payment_method    text not null
                    check (payment_method in ('dinheiro','pix','cartao_debito','cartao_credito','transferencia','outro')),
  payment_status    text not null default 'pago'
                    check (payment_status in ('pago','pendente','isento')),
  status            text not null default 'in_progress'
                    check (status in ('in_progress','done','canceled')),
  -- snapshot de fotos da entrega (entrada da moto)
  moto_photo_path   text,
  plate_photo_path  text,
  notes             text,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Defensive reconcile.
alter table public.estetica_walkin_services add column if not exists vehicle_id uuid references public.estetica_vehicles(id) on delete restrict;
alter table public.estetica_walkin_services add column if not exists customer_id uuid references public.estetica_customers(id) on delete restrict;
alter table public.estetica_walkin_services add column if not exists service_id uuid references public.estetica_services(id) on delete set null;
alter table public.estetica_walkin_services add column if not exists admin_id text;
alter table public.estetica_walkin_services add column if not exists price_cents int;
alter table public.estetica_walkin_services add column if not exists payment_method text;
alter table public.estetica_walkin_services add column if not exists payment_status text not null default 'pago';
alter table public.estetica_walkin_services add column if not exists status text not null default 'in_progress';
alter table public.estetica_walkin_services add column if not exists moto_photo_path text;
alter table public.estetica_walkin_services add column if not exists plate_photo_path text;
alter table public.estetica_walkin_services add column if not exists notes text;
alter table public.estetica_walkin_services add column if not exists started_at timestamptz not null default now();
alter table public.estetica_walkin_services add column if not exists completed_at timestamptz;
alter table public.estetica_walkin_services add column if not exists created_at timestamptz not null default now();
alter table public.estetica_walkin_services add column if not exists updated_at timestamptz not null default now();

alter table public.estetica_walkin_services enable row level security;

drop policy if exists estetica_walkin_services_admin on public.estetica_walkin_services;
create policy estetica_walkin_services_admin on public.estetica_walkin_services
  for all to service_role using (true) with check (true);

-- Cliente autenticado vê atendimentos do próprio veículo.
drop policy if exists estetica_walkin_services_select_own on public.estetica_walkin_services;
create policy estetica_walkin_services_select_own on public.estetica_walkin_services
  for select to authenticated
  using (
    exists (
      select 1
      from public.estetica_vehicles v
      join public.estetica_customers c on c.id = v.customer_id
      where v.id = vehicle_id
        and c.profile_id = (select auth.jwt()->>'sub')
    )
  );

create index if not exists idx_estetica_walkin_vehicle on public.estetica_walkin_services(vehicle_id, created_at desc);
create index if not exists idx_estetica_walkin_customer on public.estetica_walkin_services(customer_id, created_at desc);
create index if not exists idx_estetica_walkin_status on public.estetica_walkin_services(status);
create index if not exists idx_estetica_walkin_admin on public.estetica_walkin_services(admin_id, created_at desc);

drop trigger if exists estetica_walkin_services_touch_updated_at on public.estetica_walkin_services;
create trigger estetica_walkin_services_touch_updated_at
  before update on public.estetica_walkin_services
  for each row execute function public.touch_updated_at();
