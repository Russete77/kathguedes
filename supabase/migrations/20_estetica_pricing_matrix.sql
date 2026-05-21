-- ============================================================================
-- 20. KATH ESTÉTICA — Matriz oficial de preços por tipo de moto
-- ============================================================================
-- Introduz a matriz preço × tipo-de-moto da Kath Guedes Estética & Detalhamento
-- (Barra Olímpica — Volcano Garage), conforme cardápio oficial 2026:
--
--   LAVAGEM SIMPLES   (40 min):  Scooter peq R$40 · Até 300cc R$50 ·
--                                300-800cc R$70 · >800cc R$80
--   LAVAGEM DETALHADA          : Scooter R$160 · Até 300cc R$200 ·
--                                300-800cc R$260 · >800cc R$300
--   VITRIFICAÇÃO FULL          : Scooter R$500 · Naked R$700 ·
--                                Crossover R$800 · Custom/Touring/Big Trail R$1000
--
-- Modelagem: 3 tabelas novas e 4 colunas adicionais em estetica_services.
-- 100% idempotente (add column if not exists, on conflict do nothing).
-- ============================================================================

-- ── HARD RESET das 3 tabelas novas (sem dados ainda em produção) ──────────
-- Se uma tentativa anterior deixou estrutura parcial (ex: estetica_vehicle_types
-- sem coluna id, FK quebrada), o `create table if not exists` abaixo
-- silenciosamente pula e o restante falha com erro 42703. Como ninguém ainda
-- depende dessas tabelas, dropar é seguro e idempotente.
alter table if exists public.estetica_walkin_services drop column if exists vehicle_type_id;
alter table if exists public.estetica_vehicles        drop column if exists vehicle_type_id;
drop table if exists public.estetica_service_prices  cascade;
drop table if exists public.estetica_payment_rules   cascade;
drop table if exists public.estetica_vehicle_types   cascade;

-- ── estetica_services: novas colunas opcionais ─────────────────────────────
-- slug          : URL amigável (/kath-estetica/servicos/lavagem-simples)
-- is_featured   : destaque no catálogo
-- requires_prepay : exige pagamento antecipado (vitrificação)
-- prepay_min_pct  : percentual mínimo de sinal (0 a 100)
alter table public.estetica_services add column if not exists slug text;
alter table public.estetica_services add column if not exists is_featured boolean not null default false;
alter table public.estetica_services add column if not exists requires_prepay boolean not null default false;
alter table public.estetica_services add column if not exists prepay_min_pct int not null default 0
  check (prepay_min_pct between 0 and 100);

create unique index if not exists idx_estetica_services_slug
  on public.estetica_services(slug) where slug is not null;

-- ── estetica_vehicle_types ─────────────────────────────────────────────────
-- Categorias de moto para a matriz de preços. Slug é a chave estável usada
-- por código; label é o texto exibido na UI.
create table if not exists public.estetica_vehicle_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.estetica_vehicle_types add column if not exists slug text;
alter table public.estetica_vehicle_types add column if not exists label text;
alter table public.estetica_vehicle_types add column if not exists description text;
alter table public.estetica_vehicle_types add column if not exists sort_order int not null default 0;
alter table public.estetica_vehicle_types add column if not exists is_active boolean not null default true;
alter table public.estetica_vehicle_types add column if not exists created_at timestamptz not null default now();

alter table public.estetica_vehicle_types enable row level security;

drop policy if exists estetica_vehicle_types_select_all on public.estetica_vehicle_types;
create policy estetica_vehicle_types_select_all on public.estetica_vehicle_types
  for select to authenticated using (is_active = true);

drop policy if exists estetica_vehicle_types_admin on public.estetica_vehicle_types;
create policy estetica_vehicle_types_admin on public.estetica_vehicle_types
  for all to service_role using (true) with check (true);

-- ── estetica_service_prices ────────────────────────────────────────────────
-- Matriz preço × (serviço, tipo de moto). Cada combinação válida é uma linha;
-- combinações inexistentes (ex: Scooter Pequena × Vitrificação) simplesmente
-- não têm row — o cliente não enxerga essa opção.
create table if not exists public.estetica_service_prices (
  id              uuid primary key default gen_random_uuid(),
  service_id      uuid not null references public.estetica_services(id) on delete cascade,
  vehicle_type_id uuid not null references public.estetica_vehicle_types(id) on delete cascade,
  price_cents     int  not null check (price_cents >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (service_id, vehicle_type_id)
);

alter table public.estetica_service_prices add column if not exists service_id uuid references public.estetica_services(id) on delete cascade;
alter table public.estetica_service_prices add column if not exists vehicle_type_id uuid references public.estetica_vehicle_types(id) on delete cascade;
alter table public.estetica_service_prices add column if not exists price_cents int;
alter table public.estetica_service_prices add column if not exists is_active boolean not null default true;
alter table public.estetica_service_prices add column if not exists created_at timestamptz not null default now();
alter table public.estetica_service_prices add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estetica_service_prices_service_vehicle_key'
      and conrelid = 'public.estetica_service_prices'::regclass
  ) then
    alter table public.estetica_service_prices
      add constraint estetica_service_prices_service_vehicle_key
      unique (service_id, vehicle_type_id);
  end if;
end $$;

alter table public.estetica_service_prices enable row level security;

drop policy if exists estetica_service_prices_select_all on public.estetica_service_prices;
create policy estetica_service_prices_select_all on public.estetica_service_prices
  for select to authenticated using (is_active = true);

drop policy if exists estetica_service_prices_admin on public.estetica_service_prices;
create policy estetica_service_prices_admin on public.estetica_service_prices
  for all to service_role using (true) with check (true);

create index if not exists idx_estetica_service_prices_service
  on public.estetica_service_prices(service_id) where is_active = true;
create index if not exists idx_estetica_service_prices_vehicle
  on public.estetica_service_prices(vehicle_type_id) where is_active = true;

drop trigger if exists estetica_service_prices_touch_updated_at on public.estetica_service_prices;
create trigger estetica_service_prices_touch_updated_at
  before update on public.estetica_service_prices
  for each row execute function public.touch_updated_at();

-- ── estetica_payment_rules ─────────────────────────────────────────────────
-- Regras configuráveis por admin que definem se o pagamento é antecipado,
-- presencial, ou parcial. Lookup por service_id (1:1 opcional). Se não houver
-- linha, default = pagamento presencial permitido, sem sinal exigido.
create table if not exists public.estetica_payment_rules (
  id                 uuid primary key default gen_random_uuid(),
  service_id         uuid not null unique references public.estetica_services(id) on delete cascade,
  allow_onsite_cash  boolean not null default true,
  allow_onsite_pix   boolean not null default true,
  allow_onsite_card  boolean not null default true,
  allow_app_prepay   boolean not null default true,
  -- se true, agendamento via app exige sinal mínimo (prepay_min_pct)
  require_app_prepay boolean not null default false,
  -- 0..100 — se require_app_prepay e prepay_pct > 0, cliente paga só essa
  -- fração via Asaas e o resto presencial.
  prepay_pct         int  not null default 0 check (prepay_pct between 0 and 100),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.estetica_payment_rules add column if not exists service_id uuid references public.estetica_services(id) on delete cascade;
alter table public.estetica_payment_rules add column if not exists allow_onsite_cash boolean not null default true;
alter table public.estetica_payment_rules add column if not exists allow_onsite_pix boolean not null default true;
alter table public.estetica_payment_rules add column if not exists allow_onsite_card boolean not null default true;
alter table public.estetica_payment_rules add column if not exists allow_app_prepay boolean not null default true;
alter table public.estetica_payment_rules add column if not exists require_app_prepay boolean not null default false;
alter table public.estetica_payment_rules add column if not exists prepay_pct int not null default 0;
alter table public.estetica_payment_rules add column if not exists notes text;
alter table public.estetica_payment_rules add column if not exists created_at timestamptz not null default now();
alter table public.estetica_payment_rules add column if not exists updated_at timestamptz not null default now();

alter table public.estetica_payment_rules enable row level security;

drop policy if exists estetica_payment_rules_select_all on public.estetica_payment_rules;
create policy estetica_payment_rules_select_all on public.estetica_payment_rules
  for select to authenticated using (true);

drop policy if exists estetica_payment_rules_admin on public.estetica_payment_rules;
create policy estetica_payment_rules_admin on public.estetica_payment_rules
  for all to service_role using (true) with check (true);

drop trigger if exists estetica_payment_rules_touch_updated_at on public.estetica_payment_rules;
create trigger estetica_payment_rules_touch_updated_at
  before update on public.estetica_payment_rules
  for each row execute function public.touch_updated_at();

-- ── Vínculo opcional de vehicle_type_id em walkin/vehicles ────────────────
-- Permite classificar a moto na chegada (afeta preço sugerido) e auditar
-- depois qual tipo foi atendido — usado para relatório financeiro.
alter table public.estetica_walkin_services
  add column if not exists vehicle_type_id uuid references public.estetica_vehicle_types(id) on delete set null;
alter table public.estetica_vehicles
  add column if not exists vehicle_type_id uuid references public.estetica_vehicle_types(id) on delete set null;

create index if not exists idx_estetica_walkin_vehicle_type
  on public.estetica_walkin_services(vehicle_type_id) where vehicle_type_id is not null;

-- ── SEEDS: vehicle_types ───────────────────────────────────────────────────
insert into public.estetica_vehicle_types (slug, label, description, sort_order) values
  ('scooter_pequena',  'Scooter pequena',            '50-150cc — Biz, Pop, scooter elétrica',  10),
  ('scooter',          'Scooter',                    'Scooter média — PCX, NMax, ADV',          20),
  ('ate_300cc',        'Até 300cc',                  'Comutadora urbana — Twister, Fan, CG',    30),
  ('media_cilindrada', 'Média cilindrada 300-800cc', 'MT-03, CB500, R3, Dominar, Z400',         40),
  ('acima_800cc',      'Acima de 800cc',             'Esportiva ou superesportiva',             50),
  ('naked',            'Naked',                      'Naked premium (Z900, MT-09, Hornet)',     60),
  ('crossover',        'Crossover',                  'Adventure média (Versys, Tiger Sport)',   70),
  ('custom',           'Custom',                     'Custom / cruiser (Harley, Vulcan)',       80),
  ('touring',          'Touring',                    'Touring (Goldwing, K1600)',               90),
  ('big_trail',        'Big Trail',                  'Big trail premium (GS, Africa Twin)',    100)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

-- ── SEEDS: services (3 serviços oficiais) ──────────────────────────────────
-- on conflict via slug (índice único parcial). Se o slug já existir, atualiza
-- title/duracao/preço-base e os campos novos.
insert into public.estetica_services (
  slug, title, description, category, duration_min, price_cents, cost_cents,
  includes, eligible_for_loyalty, requires_paid_plan, is_active, sort_order,
  is_featured, requires_prepay, prepay_min_pct
) values
  (
    'lavagem-simples',
    'Lavagem Simples',
    'Limpeza geral, aplicação de cera e proteção contra maresia e ferrugem. Limpeza e lubrificação da relação (quando aplicável).',
    'lavagem', 40, 4000, 0,
    array[
      'Limpeza geral',
      'Aplicação de cera',
      'Proteção contra maresia e ferrugem',
      'Limpeza e lubrificação da relação (se aplicável)'
    ],
    true, false, true, 10, true, false, 0
  ),
  (
    'lavagem-detalhada',
    'Lavagem Detalhada',
    'Serviço completo e minucioso com limpeza profunda em todas as partes da moto.',
    'lavagem', 120, 16000, 0,
    array[
      'Lavagem técnica em duas etapas',
      'Limpeza profunda de plásticos',
      'Detalhamento do motor (frio)',
      'Limpeza interna do paralama',
      'Acabamento com cera'
    ],
    true, false, true, 20, true, false, 0
  ),
  (
    'vitrificacao-full',
    'Vitrificação Full',
    'Proteção cerâmica de alta performance para pintura, plásticos e partes metálicas. Exige pagamento antecipado.',
    'vitrificacao', 480, 50000, 0,
    array[
      'Descontaminação completa',
      'Polimento técnico (se necessário)',
      'Aplicação cerâmica em pintura',
      'Aplicação cerâmica em plásticos',
      'Aplicação cerâmica em peças metálicas',
      'Cura controlada'
    ],
    true, false, true, 30, true, true, 50
  )
on conflict (slug) where slug is not null do update set
  title           = excluded.title,
  description     = excluded.description,
  category        = excluded.category,
  duration_min    = excluded.duration_min,
  price_cents     = excluded.price_cents,
  includes        = excluded.includes,
  is_featured     = excluded.is_featured,
  requires_prepay = excluded.requires_prepay,
  prepay_min_pct  = excluded.prepay_min_pct;

-- ── SEEDS: matriz de preços ────────────────────────────────────────────────
-- Inserts conditionais: pegamos os IDs por slug e mapeamos.
do $$
declare
  v_lavagem_simples uuid;
  v_lavagem_detalhada uuid;
  v_vitrificacao uuid;
  v_scooter_p uuid;
  v_scooter   uuid;
  v_ate300    uuid;
  v_media     uuid;
  v_acima800  uuid;
  v_naked     uuid;
  v_crossover uuid;
  v_custom    uuid;
  v_touring   uuid;
  v_bigtrail  uuid;
begin
  select id into v_lavagem_simples   from public.estetica_services where slug = 'lavagem-simples';
  select id into v_lavagem_detalhada from public.estetica_services where slug = 'lavagem-detalhada';
  select id into v_vitrificacao      from public.estetica_services where slug = 'vitrificacao-full';

  select id into v_scooter_p from public.estetica_vehicle_types where slug = 'scooter_pequena';
  select id into v_scooter   from public.estetica_vehicle_types where slug = 'scooter';
  select id into v_ate300    from public.estetica_vehicle_types where slug = 'ate_300cc';
  select id into v_media     from public.estetica_vehicle_types where slug = 'media_cilindrada';
  select id into v_acima800  from public.estetica_vehicle_types where slug = 'acima_800cc';
  select id into v_naked     from public.estetica_vehicle_types where slug = 'naked';
  select id into v_crossover from public.estetica_vehicle_types where slug = 'crossover';
  select id into v_custom    from public.estetica_vehicle_types where slug = 'custom';
  select id into v_touring   from public.estetica_vehicle_types where slug = 'touring';
  select id into v_bigtrail  from public.estetica_vehicle_types where slug = 'big_trail';

  -- LAVAGEM SIMPLES
  insert into public.estetica_service_prices (service_id, vehicle_type_id, price_cents) values
    (v_lavagem_simples, v_scooter_p, 4000),
    (v_lavagem_simples, v_ate300,    5000),
    (v_lavagem_simples, v_media,     7000),
    (v_lavagem_simples, v_acima800,  8000)
  on conflict (service_id, vehicle_type_id) do update set
    price_cents = excluded.price_cents, is_active = true;

  -- LAVAGEM DETALHADA
  insert into public.estetica_service_prices (service_id, vehicle_type_id, price_cents) values
    (v_lavagem_detalhada, v_scooter,  16000),
    (v_lavagem_detalhada, v_ate300,   20000),
    (v_lavagem_detalhada, v_media,    26000),
    (v_lavagem_detalhada, v_acima800, 30000)
  on conflict (service_id, vehicle_type_id) do update set
    price_cents = excluded.price_cents, is_active = true;

  -- VITRIFICAÇÃO FULL
  insert into public.estetica_service_prices (service_id, vehicle_type_id, price_cents) values
    (v_vitrificacao, v_scooter,   50000),
    (v_vitrificacao, v_naked,     70000),
    (v_vitrificacao, v_crossover, 80000),
    (v_vitrificacao, v_custom,   100000),
    (v_vitrificacao, v_touring,  100000),
    (v_vitrificacao, v_bigtrail, 100000)
  on conflict (service_id, vehicle_type_id) do update set
    price_cents = excluded.price_cents, is_active = true;

  -- payment_rules: vitrificação exige sinal de 50% via app, demais aceitam todas formas presenciais
  insert into public.estetica_payment_rules (service_id, allow_onsite_cash, allow_onsite_pix, allow_onsite_card, allow_app_prepay, require_app_prepay, prepay_pct, notes) values
    (v_lavagem_simples,   true,  true,  true,  true,  false, 0,  'Lavagem simples: pagamento presencial ou via app, sem sinal.'),
    (v_lavagem_detalhada, true,  true,  true,  true,  false, 0,  'Lavagem detalhada: pagamento presencial ou via app. Sinal opcional.'),
    (v_vitrificacao,      false, false, false, true,  true,  50, 'Vitrificação: sinal de 50% no agendamento (via app/PIX/Asaas). Restante na entrega.')
  on conflict (service_id) do update set
    allow_onsite_cash  = excluded.allow_onsite_cash,
    allow_onsite_pix   = excluded.allow_onsite_pix,
    allow_onsite_card  = excluded.allow_onsite_card,
    allow_app_prepay   = excluded.allow_app_prepay,
    require_app_prepay = excluded.require_app_prepay,
    prepay_pct         = excluded.prepay_pct,
    notes              = excluded.notes;
end $$;
