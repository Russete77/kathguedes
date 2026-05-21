# Modelo Financeiro KathApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o modelo financeiro completo do KathApp: 6 tiers de plano (free/acesso/plano1/plano2/plano3/atleta), cashback wallet (loja + estética), receita unificada (`revenue_streams`) e comissões automáticas para Russo/Sidney/Kath, conforme spec `docs/superpowers/specs/2026-05-02-modelo-financeiro-design.md`.

**Architecture:** Tabela `plans` admin-editável centraliza preços/descontos/cashback. Webhook Asaas alimenta `revenue_streams`; trigger `compute_commissions` aloca splits para `partner`/`consultant` e residual para `owner` (Kath absorve cashback queimado). Cashback é wallet interno (`wallet_credits` FIFO + `wallet_balance` denormalizado), gasto via RPC `spend_wallet_cents` no checkout e creditado pós-consolidação. Refactor cascateia em `lib/asaas/*`, `lib/validations`, `lib/supabase/types`, `app/(app)/planos`, `app/(app)/loja`, `app/(app)/kath-estetica`, `app/admin/*`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Clerk v7, Supabase Postgres + RLS, Asaas (sandbox→prod), ioredis (rate-limit), web-push (VAPID), Vitest + Testing Library, Vercel Cron.

---

## Sumário das fases

1. **Fase 1 — DB foundation** (Tasks 1-4): migration consolidada + tipos + validations
2. **Fase 2 — Billing module** (Tasks 5-8): `lib/billing/*` puro + helpers Asaas
3. **Fase 3 — Asaas refactor** (Tasks 9-11): config/webhook/checkout
4. **Fase 4 — Loja + Estética checkout** (Tasks 12-15): cashback no checkout + admin forms
5. **Fase 5 — Crons** (Task 16): wallet-expire + order-timeout
6. **Fase 6 — Frontend usuário** (Tasks 17-19): /planos, /perfil/wallet, chat sender_role
7. **Fase 7 — Painel admin financeiro** (Tasks 20-22): /admin/financeiro/*, /admin/team, /admin/plans
8. **Fase 8 — Smoke test e wiki** (Task 23)

## Convenções de execução

- **Working directory:** `C:\Users\erick\KATH-GUEDES\kathapp` (todos os caminhos relativos a esse).
- **Commits:** ao fim de cada task. Formato `feat(billing): <task>` ou `refactor(loja): <task>`.
- **Verificação por task:** `npm run lint && npm run build && npm run test` no fim. Browser test em tasks de UI.
- **Migration:** todas as ALTER/CREATE em **um único arquivo** `supabase/migration_modelo_financeiro.sql`, idempotente. Aplicar em sandbox antes de prod.
- **Tipos:** após Task 4, regenerar `lib/supabase/types.ts` via `supabase gen types typescript --project-id <PROJECT> > src/lib/supabase/types.ts`.
- **TDD aplica a:** lógica pura (`lib/billing/*`, parseExternalReference, planTierFromValue). Não aplica a SQL (verifica por execução) nem UI (manual).
- **Sem mock de DB** em testes integration (memória `feedback_*`).

## File Structure

### Arquivos novos (criar)

| Caminho | Responsabilidade |
|---------|------------------|
| `supabase/migration_modelo_financeiro.sql` | Migration consolidada (8 tabelas novas + ALTERs + funções) |
| `src/lib/billing/plans.ts` | Cache de `plans` + helpers (getPlan, planTierFromValue, etc) |
| `src/lib/billing/plans.test.ts` | Testes unit |
| `src/lib/billing/wallet.ts` | Wrappers de RPCs de wallet |
| `src/lib/billing/wallet.test.ts` | Testes unit |
| `src/lib/billing/commissions.ts` | Wrappers + queries agregadas para painel |
| `src/lib/billing/commissions.test.ts` | Testes unit |
| `src/lib/billing/revenue.ts` | `recordRevenueStream` chamada pelo webhook |
| `src/lib/billing/revenue.test.ts` | Testes unit |
| `src/lib/asaas/external-reference.ts` | `parseExternalReference` |
| `src/lib/asaas/external-reference.test.ts` | Testes unit |
| `src/app/api/cron/wallet-expire/route.ts` | Cron diário de expiração |
| `src/app/api/cron/order-timeout/route.ts` | Cron horário cancela orders >24h pending |
| `src/app/admin/loja/order-actions.ts` | Server actions order (markDelivered) |
| `src/app/admin/kath-estetica/booking-actions.ts` | Server actions booking (markDone) |
| `src/app/admin/financeiro/page.tsx` | Visão geral receita |
| `src/app/admin/financeiro/comissoes/page.tsx` | Allocations + aprovar lote |
| `src/app/admin/financeiro/comissoes/commission-list.tsx` | Componente client |
| `src/app/admin/financeiro/afiliado-externo/page.tsx` | Form payout mensal |
| `src/app/admin/financeiro/afiliado-externo/payout-form.tsx` | Componente client |
| `src/app/admin/financeiro/actions.ts` | Server actions financeiro |
| `src/app/admin/team/page.tsx` | CRUD team_members |
| `src/app/admin/team/team-form.tsx` | Componente client |
| `src/app/admin/team/regras/page.tsx` | CRUD commission_rules |
| `src/app/admin/team/regras/rules-form.tsx` | Componente client |
| `src/app/admin/team/actions.ts` | Server actions team |
| `src/app/admin/plans/page.tsx` | Editor de planos |
| `src/app/admin/plans/plan-form.tsx` | Componente client |
| `src/app/admin/plans/actions.ts` | Server actions plans |
| `src/app/(app)/perfil/wallet-block.tsx` | Bloco saldo + extrato resumido |
| `src/app/(app)/perfil/cashback/page.tsx` | Extrato completo |
| `src/components/billing/cashback-input.tsx` | Input "Aplicar cashback" no checkout |
| `src/lib/billing/cashback-utils.ts` | Helpers puros (clampCashback, etc) |
| `src/lib/billing/cashback-utils.test.ts` | Testes unit |

### Arquivos a modificar

| Caminho | Mudança |
|---------|---------|
| `src/lib/asaas/config.ts` | Remover `PLAN_PRICES`, `PLAN_DESCRIPTIONS`, `PLAN_HIERARCHY`. Manter `ASAAS_CONFIG`. |
| `src/lib/asaas/webhook.ts` | `planTierFromValue` delega; integrar `recordRevenueStream` + `compute_commissions` + `credit_wallet_cents`; lógica de auto-criação de consultoria muda |
| `src/lib/asaas/checkout.ts` | `processCheckout` lê `asaas_value` e `asaas_description` da tabela |
| `src/lib/validations.ts` | `planTierSchema` enum atualizado |
| `src/lib/supabase/types.ts` | Regenerado via `supabase gen types` |
| `src/app/(app)/planos/page.tsx` | Render dinâmico via `plans` table |
| `src/app/(app)/planos/subscribe-button.tsx` | Apenas labels |
| `src/app/(app)/loja/store-grid.tsx` | Desconto via `lib/billing/plans.ts` |
| `src/app/(app)/loja/page.tsx` | Idem |
| `src/app/api/loja/checkout/route.ts` | Plans + cashback |
| `src/app/api/loja/payment/route.ts` | Asaas com `amount_paid_cash` |
| `src/app/(app)/loja/pedido/payment-panel.tsx` | UI cashback |
| `src/app/(app)/kath-estetica/agendar/[serviceId]/booking-form.tsx` | Plans + cashback |
| `src/app/api/estetica/bookings/route.ts` | Plans + cashback |
| `src/app/api/estetica/bookings/[id]/payment/route.ts` | Asaas com `amount_paid_cash` |
| `src/app/admin/loja/product-form.tsx` | Remover discount_*, add cost_cents |
| `src/app/admin/loja/order-list.tsx` | Botão "Marcar entregue" |
| `src/app/admin/kath-estetica/servicos/service-form.tsx` | Remover discount_*, add cost_cents + requires_paid_plan |
| `src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx` | Botão "Marcar concluído" |
| `src/app/(app)/perfil/page.tsx` | Adicionar `<WalletBlock>` |
| `src/app/(app)/chat/chat-room.tsx` | Render via `sender_role` |
| `src/app/admin/chat/admin-chat-inbox.tsx` | Dropdown "Responder como" |
| `src/app/admin/dashboard/page.tsx` | Métricas via `revenue_streams` |
| `src/middleware.ts` | Adicionar `/admin/financeiro`, `/admin/team`, `/admin/plans` aos protected routes (já cobre via `/admin(.*)`) |
| `next.config.ts` | Vercel Cron config (se necessário) — `vercel.json` |

### Arquivos novos auxiliares

| Caminho | Responsabilidade |
|---------|------------------|
| `vercel.json` | Configurar Vercel Cron schedules para `/api/cron/wallet-expire` (daily) e `/api/cron/order-timeout` (hourly) |

---

# Fase 1 — DB Foundation

## Task 1: Migration parte A — `plans`, `team_members`, `commission_*`

**Files:**
- Create: `supabase/migration_modelo_financeiro.sql` (seção 1, será concatenada nas próximas tasks)

- [ ] **Step 1: Criar arquivo com cabeçalho e seção `plans`**

```bash
# arquivo a criar: supabase/migration_modelo_financeiro.sql
```

Conteúdo inicial:

```sql
-- ============================================
-- KATHAPP — Modelo Financeiro v1.0 (2026-05-02)
-- Spec: docs/superpowers/specs/2026-05-02-modelo-financeiro-design.md
-- ============================================
-- Idempotente: usa IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- Pré-condição: zero assinantes pagos (refatoração livre)

begin;

-- ============================================
-- 1. PLANS — Configuração admin-editável de tiers
-- ============================================

create table if not exists public.plans (
  slug                  text primary key,
  name                  text not null,
  level                 int not null unique,
  price_cents           int not null,
  asaas_value           numeric(10,2) not null,
  asaas_description     text not null,
  cashback_pct          numeric(5,2) not null default 0,
  store_discount_pct    int not null default 0
                        check (store_discount_pct between 0 and 100),
  estetica_discount_pct int not null default 0
                        check (estetica_discount_pct between 0 and 100),
  features              jsonb not null default '{}'::jsonb,
  is_active             boolean not null default true,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated on public.plans
  for select to authenticated using (is_active = true);

drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans
  for all to service_role using (true) with check (true);

create index if not exists idx_plans_level on public.plans(level);

-- Seed
insert into public.plans (slug, name, level, price_cents, asaas_value, asaas_description, cashback_pct, store_discount_pct, estetica_discount_pct, features, sort_order) values
  ('free',   'Free',                       0,      0,   0.00, '', 0,  0,  0,
   '{"workouts_preview":3,"affiliate_clicks_per_month":3}'::jsonb, 0),
  ('acesso', 'Acesso',                     1,   1990,  19.90,
   'KathApp Acesso — Cupons + Afiliados + Estética', 2,  5,  5,
   '{"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 1),
  ('plano1', 'Plano 1 — Treino',           2,   3990,  39.90,
   'KathApp Plano 1 — Treinos completos', 3,  8,  7,
   '{"workouts":true,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 2),
  ('plano2', 'Plano 2 — Treino + Dieta',   3,   7490,  74.90,
   'KathApp Plano 2 — Treinos + Dieta', 5, 12, 10,
   '{"workouts":true,"diet":true,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 3),
  ('plano3', 'Plano 3 — Saúde Completa',   4,   9990,  99.90,
   'KathApp Plano 3 — Saúde + Acompanhamento', 7, 18, 12,
   '{"workouts":true,"diet":true,"supplements":true,"chat_sla_h":48,"reavaliation":"monthly","estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 4),
  ('atleta', 'Atleta',                     5,  30990, 309.90,
   'KathApp Atleta — Premium completo', 10, 25, 15,
   '{"workouts":true,"diet":true,"supplements":true,"juices":true,"chat_sla_h":12,"reavaliation":"biweekly","video_call_per_month":1,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 5)
on conflict (slug) do nothing;

-- ============================================
-- 2. TEAM_MEMBERS — Russo, Sidney, Kath, futuros
-- ============================================

create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text unique,
  email           text unique not null,
  full_name       text not null,
  role            text not null
                  check (role in ('owner','partner','consultant')),
  pix_key         text,
  bank_account    jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.team_members enable row level security;

drop policy if exists team_members_admin on public.team_members;
create policy team_members_admin on public.team_members
  for all to service_role using (true) with check (true);

insert into public.team_members (email, full_name, role) values
  ('kath@kathapp.com.br',   'Kath Guedes', 'owner'),
  ('russo@kathapp.com.br',  'Russo',       'partner'),
  ('sidney@kathapp.com.br', 'Sidney',      'partner')
on conflict (email) do nothing;

-- ============================================
-- 3. COMMISSION_RULES + ALLOCATIONS
-- ============================================

create table if not exists public.commission_rules (
  id                    uuid primary key default gen_random_uuid(),
  team_member_id        uuid not null references public.team_members(id) on delete cascade,
  applies_to_type       text check (applies_to_type in ('mensalidade','loja','estetica','afiliado_externo')),
  applies_to_category   text,
  pct                   numeric(5,2) not null check (pct >= 0 and pct <= 100),
  applies_from          timestamptz not null default now(),
  applies_to            timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

alter table public.commission_rules enable row level security;

drop policy if exists commission_rules_admin on public.commission_rules;
create policy commission_rules_admin on public.commission_rules
  for all to service_role using (true) with check (true);

create index if not exists idx_commission_rules_lookup
  on public.commission_rules(applies_to_type, applies_to_category, is_active);

create table if not exists public.commission_allocations (
  id                  uuid primary key default gen_random_uuid(),
  revenue_stream_id   uuid not null,
  team_member_id      uuid not null references public.team_members(id),
  pct                 numeric(5,2) not null,
  amount_cents        int not null,
  status              text not null default 'draft'
                      check (status in ('draft','approved','paid','failed')),
  paid_at             timestamptz,
  payout_reference    text,
  created_at          timestamptz not null default now()
);

alter table public.commission_allocations enable row level security;

drop policy if exists commission_allocations_admin on public.commission_allocations;
create policy commission_allocations_admin on public.commission_allocations
  for all to service_role using (true) with check (true);

create index if not exists idx_commission_alloc_member
  on public.commission_allocations(team_member_id, status);
create unique index if not exists uniq_alloc_per_stream_member
  on public.commission_allocations(revenue_stream_id, team_member_id);

-- Seed de regras (Russo geral, Sidney mensalidade dos planos pagos com saúde)
do $$
declare
  v_russo  uuid;
  v_sidney uuid;
begin
  select id into v_russo  from public.team_members where email='russo@kathapp.com.br';
  select id into v_sidney from public.team_members where email='sidney@kathapp.com.br';

  -- só inserir se vazio
  if not exists (select 1 from public.commission_rules) then
    insert into public.commission_rules (team_member_id, pct) values (v_russo, 25);

    insert into public.commission_rules (team_member_id, applies_to_type, applies_to_category, pct) values
      (v_sidney, 'mensalidade', 'plano1', 30),
      (v_sidney, 'mensalidade', 'plano2', 30),
      (v_sidney, 'mensalidade', 'plano3', 30),
      (v_sidney, 'mensalidade', 'atleta', 30);
  end if;
end $$;

-- (continua na próxima task)
commit;
```

- [ ] **Step 2: Aplicar parte A em sandbox e verificar**

Aplicar via Supabase Dashboard SQL Editor ou CLI:
```bash
psql $SUPABASE_DB_URL -f supabase/migration_modelo_financeiro.sql
```

Verificar:
```sql
select count(*) from public.plans;            -- Expected: 6
select slug, level, price_cents from public.plans order by level;
select count(*) from public.team_members;     -- Expected: 3
select tm.full_name, cr.pct, cr.applies_to_type, cr.applies_to_category
  from public.commission_rules cr
  join public.team_members tm on tm.id = cr.team_member_id
  order by tm.full_name, cr.applies_to_category nulls first;
-- Expected: Russo 25 (null/null), Sidney 30 ×4 (mensalidade/plano1..atleta)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_modelo_financeiro.sql
git commit -m "feat(db): tabelas plans, team_members, commission_rules/allocations + seeds"
```

---

## Task 2: Migration parte B — `revenue_streams`, `wallet_*`, `monthly_usage`

**Files:**
- Modify: `supabase/migration_modelo_financeiro.sql` (acrescentar antes do `commit`)

- [ ] **Step 1: Anexar seção 4-7 ao arquivo**

Editar o arquivo, substituir a linha `-- (continua na próxima task)` + `commit;` por:

```sql
-- ============================================
-- 4. REVENUE_STREAMS
-- ============================================

create table if not exists public.revenue_streams (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null
                      check (type in ('mensalidade','loja','estetica','afiliado_externo')),
  category            text,
  user_id             text references public.profiles(id),
  reference_type      text not null
                      check (reference_type in ('subscription','order','booking','affiliate_payout')),
  reference_id        text not null,
  asaas_payment_id    text,
  gross_cents         int  not null check (gross_cents >= 0),
  cost_cents          int  not null default 0 check (cost_cents >= 0 and cost_cents <= gross_cents),
  net_cents           int  generated always as (gross_cents - cost_cents) stored,
  cashback_used_cents int  not null default 0 check (cashback_used_cents >= 0),
  status              text not null default 'confirmed'
                      check (status in ('pending','confirmed','refunded')),
  occurred_at         timestamptz not null,
  created_at          timestamptz not null default now()
);

alter table public.revenue_streams enable row level security;

drop policy if exists revenue_streams_admin on public.revenue_streams;
create policy revenue_streams_admin on public.revenue_streams
  for all to service_role using (true) with check (true);

create index if not exists idx_revenue_streams_type
  on public.revenue_streams(type, occurred_at desc);
create index if not exists idx_revenue_streams_user
  on public.revenue_streams(user_id, occurred_at desc);
create index if not exists idx_revenue_streams_status
  on public.revenue_streams(status);
create index if not exists idx_revenue_streams_asaas
  on public.revenue_streams(asaas_payment_id)
  where asaas_payment_id is not null;

-- FK retroativa em commission_allocations
alter table public.commission_allocations
  drop constraint if exists commission_allocations_revenue_stream_id_fkey,
  add  constraint commission_allocations_revenue_stream_id_fkey
       foreign key (revenue_stream_id)
       references public.revenue_streams(id) on delete cascade;

-- ============================================
-- 5. WALLET — créditos + saldo
-- ============================================

create table if not exists public.wallet_credits (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     text not null references public.profiles(id) on delete cascade,
  source_revenue_stream_id    uuid references public.revenue_streams(id),
  spent_on_revenue_stream_id  uuid references public.revenue_streams(id),
  amount_cents                int  not null,
  expires_at                  timestamptz,
  used_at                     timestamptz,
  created_at                  timestamptz not null default now()
);

alter table public.wallet_credits enable row level security;

drop policy if exists wallet_credits_select_own on public.wallet_credits;
create policy wallet_credits_select_own on public.wallet_credits
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wallet_credits_admin on public.wallet_credits;
create policy wallet_credits_admin on public.wallet_credits
  for all to service_role using (true) with check (true);

create index if not exists idx_wallet_credits_user_active
  on public.wallet_credits(user_id, expires_at)
  where used_at is null;

create table if not exists public.wallet_balance (
  user_id              text primary key references public.profiles(id) on delete cascade,
  active_cents         int not null default 0,
  earned_total_cents   int not null default 0,
  spent_total_cents    int not null default 0,
  expired_total_cents  int not null default 0,
  updated_at           timestamptz not null default now()
);

alter table public.wallet_balance enable row level security;

drop policy if exists wallet_balance_select_own on public.wallet_balance;
create policy wallet_balance_select_own on public.wallet_balance
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists wallet_balance_admin on public.wallet_balance;
create policy wallet_balance_admin on public.wallet_balance
  for all to service_role using (true) with check (true);

-- ============================================
-- 6. MONTHLY_USAGE — limites do FREE
-- ============================================

create table if not exists public.monthly_usage (
  user_id                 text not null references public.profiles(id) on delete cascade,
  year_month              text not null check (year_month ~ '^\d{4}-\d{2}$'),
  affiliate_clicks_count  int  not null default 0,
  primary key (user_id, year_month)
);

alter table public.monthly_usage enable row level security;

drop policy if exists monthly_usage_select_own on public.monthly_usage;
create policy monthly_usage_select_own on public.monthly_usage
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists monthly_usage_admin on public.monthly_usage;
create policy monthly_usage_admin on public.monthly_usage
  for all to service_role using (true) with check (true);

-- (continua na próxima task)
commit;
```

- [ ] **Step 2: Aplicar e verificar**

```bash
psql $SUPABASE_DB_URL -f supabase/migration_modelo_financeiro.sql
```

Verificar:
```sql
\d+ public.revenue_streams
\d+ public.wallet_credits
\d+ public.wallet_balance
\d+ public.monthly_usage
-- Cada um deve mostrar policies, indexes, constraints

-- Testar generated column
insert into public.revenue_streams
  (type, reference_type, reference_id, gross_cents, cost_cents, occurred_at)
values
  ('loja', 'order', 'test-001', 10000, 6000, now())
returning id, gross_cents, cost_cents, net_cents;
-- Expected: net_cents = 4000

delete from public.revenue_streams where reference_id = 'test-001';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_modelo_financeiro.sql
git commit -m "feat(db): revenue_streams, wallet_credits/balance, monthly_usage"
```

---

## Task 3: Migration parte C — ALTERs em tabelas existentes + funções SQL

**Files:**
- Modify: `supabase/migration_modelo_financeiro.sql`

- [ ] **Step 1: Anexar seção 7 (ALTERs) e 8 (funções)**

Substituir `-- (continua na próxima task)` + `commit;` por:

```sql
-- ============================================
-- 7. ALTER TABLE — atualizar tabelas existentes
-- ============================================

-- 7.1 plan_tier CHECK em todas as tabelas
alter table public.profiles
  drop constraint if exists profiles_plan_tier_check;
alter table public.profiles
  add  constraint profiles_plan_tier_check
       check (plan_tier in ('free','acesso','plano1','plano2','plano3','atleta'));

alter table public.workout_videos
  drop constraint if exists workout_videos_required_plan_check;
alter table public.workout_videos
  add  constraint workout_videos_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));
alter table public.workout_videos
  add column if not exists is_free_preview boolean not null default false;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_required_plan_check;
alter table public.affiliate_links
  add  constraint affiliate_links_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));

alter table public.coupons
  drop constraint if exists coupons_required_plan_check;
alter table public.coupons
  add  constraint coupons_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));
alter table public.coupons
  add column if not exists is_public_preview boolean not null default false;

-- moto_events pode não existir em todos os ambientes (criada em migration_fixes)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='moto_events') then
    execute 'alter table public.moto_events drop constraint if exists moto_events_required_plan_check';
    execute 'alter table public.moto_events add constraint moto_events_required_plan_check check (required_plan in (''free'',''acesso'',''plano1'',''plano2'',''plano3'',''atleta''))';
  end if;
end $$;

-- 7.2 cost_cents em produtos e estética; remover discount_*
alter table public.products
  add column if not exists cost_cents int not null default 0
      check (cost_cents >= 0);
alter table public.products
  drop column if exists discount_start,
  drop column if exists discount_pro,
  drop column if exists discount_vip;

alter table public.estetica_services
  add column if not exists cost_cents int not null default 0
      check (cost_cents >= 0);
alter table public.estetica_services
  add column if not exists requires_paid_plan boolean not null default false;
alter table public.estetica_services
  drop column if exists discount_start,
  drop column if exists discount_pro,
  drop column if exists discount_vip;

-- 7.3 cashback_used_cents em orders e estetica_bookings
alter table public.orders
  add column if not exists cashback_used_cents int not null default 0
      check (cashback_used_cents >= 0);

alter table public.estetica_bookings
  add column if not exists cashback_used_cents int not null default 0
      check (cashback_used_cents >= 0);

-- 7.4 messages.sender_role substitui is_from_kath
alter table public.messages
  add column if not exists sender_role text not null default 'user'
      check (sender_role in ('user','kath','sidney','admin'));

-- backfill: se existir is_from_kath ainda
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='messages' and column_name='is_from_kath') then
    execute 'update public.messages set sender_role = case when is_from_kath then ''kath'' else ''user'' end where sender_role = ''user''';
    execute 'alter table public.messages drop column is_from_kath';
  end if;
end $$;

-- Reescrever policy de messages: agora plan_tier IN ('plano3','atleta')
drop policy if exists messages_insert_vip on public.messages;
drop policy if exists messages_insert_chat on public.messages;
create policy messages_insert_chat on public.messages
  for insert to authenticated
  with check (
    (select auth.jwt()->>'sub') = user_id
    and sender_role = 'user'
    and (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        in ('plano3','atleta')
  );

-- ============================================
-- 8. FUNÇÕES SQL
-- ============================================

-- 8.1 plan_tier_level dinâmico (lookup em plans)
create or replace function public.plan_tier_level(tier text) returns int
language sql stable as $$
  select coalesce((select level from public.plans where slug = tier), 0)
$$;

-- 8.2 compute_cashback_cents
create or replace function public.compute_cashback_cents(
  p_user_id text,
  p_amount_paid_cash_cents int
) returns int
language sql stable as $$
  select greatest(0, round(p_amount_paid_cash_cents * coalesce((
    select p.cashback_pct
    from public.plans p
    join public.profiles pr on pr.plan_tier = p.slug
    where pr.id = p_user_id
  ), 0) / 100.0))::int
$$;

-- 8.3 wallet_active_cents
create or replace function public.wallet_active_cents(p_user_id text) returns int
language sql stable as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.wallet_credits
  where user_id = p_user_id
    and used_at is null
    and (expires_at is null or expires_at > now())
$$;

-- 8.4 spend_wallet_cents (FIFO com lock)
create or replace function public.spend_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_revenue_stream_id uuid default null
) returns int
language plpgsql security definer as $$
declare
  v_remaining int := p_amount_cents;
  v_credit record;
  v_used_total int := 0;
begin
  if p_amount_cents <= 0 then return 0; end if;

  for v_credit in
    select id, amount_cents
    from public.wallet_credits
    where user_id = p_user_id
      and used_at is null
      and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    if v_credit.amount_cents <= v_remaining then
      update public.wallet_credits
        set used_at = now(), spent_on_revenue_stream_id = p_revenue_stream_id
        where id = v_credit.id;
      v_remaining := v_remaining - v_credit.amount_cents;
      v_used_total := v_used_total + v_credit.amount_cents;
    else
      update public.wallet_credits
        set amount_cents = amount_cents - v_remaining
        where id = v_credit.id;
      insert into public.wallet_credits
        (user_id, amount_cents, used_at, spent_on_revenue_stream_id)
      values
        (p_user_id, -v_remaining, now(), p_revenue_stream_id);
      v_used_total := v_used_total + v_remaining;
      v_remaining := 0;
    end if;
  end loop;

  insert into public.wallet_balance (user_id, spent_total_cents, active_cents)
  values (p_user_id, v_used_total, -v_used_total)
  on conflict (user_id) do update
    set spent_total_cents = wallet_balance.spent_total_cents + v_used_total,
        active_cents      = wallet_balance.active_cents - v_used_total,
        updated_at        = now();

  return v_used_total;
end;
$$;

-- 8.5 credit_wallet_cents
create or replace function public.credit_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_source_stream_id uuid,
  p_validity_days int default 120
) returns void
language plpgsql security definer as $$
begin
  if p_amount_cents <= 0 then return; end if;

  insert into public.wallet_credits
    (user_id, source_revenue_stream_id, amount_cents, expires_at)
  values
    (p_user_id, p_source_stream_id, p_amount_cents, now() + (p_validity_days || ' days')::interval);

  insert into public.wallet_balance (user_id, active_cents, earned_total_cents)
  values (p_user_id, p_amount_cents, p_amount_cents)
  on conflict (user_id) do update
    set active_cents       = wallet_balance.active_cents + p_amount_cents,
        earned_total_cents = wallet_balance.earned_total_cents + p_amount_cents,
        updated_at         = now();
end;
$$;

-- 8.6 expire_wallet_credits
create or replace function public.expire_wallet_credits() returns int
language plpgsql security definer as $$
declare
  v_total int := 0;
  v_user record;
begin
  for v_user in
    select user_id, sum(amount_cents) as total
    from public.wallet_credits
    where used_at is null and expires_at < now()
    group by user_id
  loop
    update public.wallet_credits
      set used_at = now()
      where user_id = v_user.user_id and used_at is null and expires_at < now();
    update public.wallet_balance
      set active_cents = active_cents - v_user.total,
          expired_total_cents = expired_total_cents + v_user.total,
          updated_at = now()
      where user_id = v_user.user_id;
    v_total := v_total + v_user.total;
  end loop;
  return v_total;
end;
$$;

-- 8.7 compute_commissions
create or replace function public.compute_commissions(p_revenue_stream_id uuid) returns int
language plpgsql security definer as $$
declare
  v_stream record;
  v_rule record;
  v_owner_id uuid;
  v_explicit_total int := 0;
  v_explicit_pct numeric := 0;
  v_owner_amount int;
  v_owner_pct numeric;
  v_count int := 0;
  v_amount int;
begin
  select * into v_stream from public.revenue_streams where id = p_revenue_stream_id;
  if not found or v_stream.status <> 'confirmed' then return 0; end if;

  for v_rule in
    select cr.team_member_id, cr.pct
    from public.commission_rules cr
    join public.team_members tm on tm.id = cr.team_member_id
    where cr.is_active = true
      and tm.is_active = true
      and tm.role <> 'owner'
      and (cr.applies_from <= now())
      and (cr.applies_to is null or cr.applies_to > now())
      and (cr.applies_to_type is null or cr.applies_to_type = v_stream.type)
      and (cr.applies_to_category is null or cr.applies_to_category = v_stream.category)
    order by
      (cr.applies_to_type is not null) desc,
      (cr.applies_to_category is not null) desc
  loop
    v_amount := round(v_stream.net_cents * v_rule.pct / 100.0)::int;
    insert into public.commission_allocations
      (revenue_stream_id, team_member_id, pct, amount_cents)
    values
      (p_revenue_stream_id, v_rule.team_member_id, v_rule.pct, v_amount)
    on conflict (revenue_stream_id, team_member_id) do nothing;
    v_explicit_total := v_explicit_total + v_amount;
    v_explicit_pct   := v_explicit_pct + v_rule.pct;
    v_count := v_count + 1;
  end loop;

  select id into v_owner_id from public.team_members
    where role = 'owner' and is_active = true limit 1;
  if v_owner_id is not null then
    v_owner_amount := v_stream.net_cents - v_explicit_total - v_stream.cashback_used_cents;
    v_owner_pct    := 100 - v_explicit_pct;
    insert into public.commission_allocations
      (revenue_stream_id, team_member_id, pct, amount_cents)
    values
      (p_revenue_stream_id, v_owner_id, v_owner_pct, v_owner_amount)
    on conflict (revenue_stream_id, team_member_id) do nothing;
    v_count := v_count + 1;
  end if;

  return v_count;
end;
$$;

commit;
```

- [ ] **Step 2: Aplicar e verificar funções**

```bash
psql $SUPABASE_DB_URL -f supabase/migration_modelo_financeiro.sql
```

Verificações:
```sql
-- plan_tier_level
select plan_tier_level('atleta');   -- Expected: 5
select plan_tier_level('inexistente'); -- Expected: 0

-- compute_commissions com stream fake (teste isolado)
do $$
declare
  v_stream uuid;
  v_user_test text := 'test_audit';
  v_count int;
begin
  insert into public.profiles (id, full_name, plan_tier) values
    (v_user_test, 'Test User', 'plano3') on conflict do nothing;

  insert into public.revenue_streams
    (type, category, user_id, reference_type, reference_id, gross_cents, cost_cents, occurred_at)
  values ('mensalidade', 'plano3', v_user_test, 'subscription', 'sub_test_001', 9990, 0, now())
  returning id into v_stream;

  v_count := public.compute_commissions(v_stream);
  raise notice 'Allocations created: %', v_count;
  -- Expected: 3 (Russo 25%, Sidney 30%, Kath 45%)

  raise notice '%', (
    select string_agg(tm.full_name || ': ' || ca.pct || '% = R$' || (ca.amount_cents/100.0), ', ')
    from public.commission_allocations ca
    join public.team_members tm on tm.id = ca.team_member_id
    where ca.revenue_stream_id = v_stream
  );
  -- Expected: Russo 25% = R$24.97, Sidney 30% = R$29.97, Kath 45% = R$44.96 (somam R$99.90)

  delete from public.commission_allocations where revenue_stream_id = v_stream;
  delete from public.revenue_streams where id = v_stream;
  delete from public.profiles where id = v_user_test;
end $$;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_modelo_financeiro.sql
git commit -m "feat(db): ALTERs (CHECK, cost_cents, sender_role) + funções (commissions, wallet, cashback)"
```

---

## Task 4: Tipos TypeScript + validations + schema consolidado

**Files:**
- Modify: `src/lib/supabase/types.ts` (regenerar)
- Modify: `src/lib/validations.ts:4`
- Modify: `supabase/schema.sql` (atualizar para refletir estado consolidado — opcional mas recomendado)

- [ ] **Step 1: Regenerar tipos do Supabase**

```bash
# Pegar PROJECT_ID do .env.local
supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > src/lib/supabase/types.ts
```

Se CLI não instalado, gerar via Dashboard Supabase → API → "Generate Types" e salvar manual em `src/lib/supabase/types.ts`.

Verificar que `PlanTier` ficou:
```ts
export type PlanTier = 'free' | 'acesso' | 'plano1' | 'plano2' | 'plano3' | 'atleta';
```

- [ ] **Step 2: Atualizar `src/lib/validations.ts`**

Substituir linha 4:

```ts
// antes
export const planTierSchema = z.enum(["free", "start", "pro", "vip"]);

// depois
export const planTierSchema = z.enum(["free", "acesso", "plano1", "plano2", "plano3", "atleta"]);
```

- [ ] **Step 3: Validar build TypeScript**

```bash
npm run lint
npm run build
```

Erros esperados: muitos! Toda referência a `start`/`pro`/`vip` em código TS vai estourar. Anotar todos os arquivos. Não consertar nesta task — Tasks 9-22 cuidam disso.

Se quiser destravar build temporariamente, comentar ou usar `// @ts-expect-error` nos pontos críticos. Preferível seguir e arrumar nas tasks específicas.

- [ ] **Step 4: Atualizar `supabase/schema.sql` consolidado (opcional, recomendado)**

Refletir estado pós-migration. Mais rápido: manter schema.sql como está e tratar `migration_modelo_financeiro.sql` como source-of-truth desta evolução. Nas tasks futuras de wiki (Task 23) consolidar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/validations.ts
git commit -m "feat(types): atualizar PlanTier e planTierSchema para 6 tiers"
```

---

# Fase 2 — Billing module (lib/billing)

## Task 5: `lib/billing/plans.ts` com cache + helpers

**Files:**
- Create: `src/lib/billing/plans.ts`
- Create: `src/lib/billing/plans.test.ts`

- [ ] **Step 1: Escrever teste falhando**

`src/lib/billing/plans.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Plan } from "./plans";

const SAMPLE_PLANS: Plan[] = [
  { slug: "free",   name: "Free",                       level: 0, price_cents: 0,     asaas_value: 0,    asaas_description: "", cashback_pct: 0,  store_discount_pct: 0,  estetica_discount_pct: 0,  features: { workouts_preview: 3, affiliate_clicks_per_month: 3 }, is_active: true, sort_order: 0 },
  { slug: "acesso", name: "Acesso",                     level: 1, price_cents: 1990,  asaas_value: 19.9, asaas_description: "X", cashback_pct: 2,  store_discount_pct: 5,  estetica_discount_pct: 5,  features: {}, is_active: true, sort_order: 1 },
  { slug: "plano1", name: "Plano 1 — Treino",           level: 2, price_cents: 3990,  asaas_value: 39.9, asaas_description: "X", cashback_pct: 3,  store_discount_pct: 8,  estetica_discount_pct: 7,  features: {}, is_active: true, sort_order: 2 },
  { slug: "plano2", name: "Plano 2 — Treino + Dieta",   level: 3, price_cents: 7490,  asaas_value: 74.9, asaas_description: "X", cashback_pct: 5,  store_discount_pct: 12, estetica_discount_pct: 10, features: {}, is_active: true, sort_order: 3 },
  { slug: "plano3", name: "Plano 3 — Saúde Completa",   level: 4, price_cents: 9990,  asaas_value: 99.9, asaas_description: "X", cashback_pct: 7,  store_discount_pct: 18, estetica_discount_pct: 12, features: {}, is_active: true, sort_order: 4 },
  { slug: "atleta", name: "Atleta",                     level: 5, price_cents: 30990, asaas_value: 309.9,asaas_description: "X", cashback_pct: 10, store_discount_pct: 25, estetica_discount_pct: 15, features: {}, is_active: true, sort_order: 5 },
];

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: SAMPLE_PLANS, error: null }),
      }),
    }),
  }),
}));

import { _resetPlanCache, getAllPlans, getPlan, planTierFromValue, getStoreDiscountPct, getEsteticaDiscountPct } from "./plans";

beforeEach(() => _resetPlanCache());

describe("plans cache", () => {
  it("getAllPlans retorna todos os 6 planos", async () => {
    const plans = await getAllPlans();
    expect(plans.map(p => p.slug)).toEqual(["free","acesso","plano1","plano2","plano3","atleta"]);
  });

  it("getPlan retorna plano por slug", async () => {
    const p = await getPlan("plano3");
    expect(p?.price_cents).toBe(9990);
  });

  it("getPlan retorna null para slug inexistente", async () => {
    const p = await getPlan("inexistente" as never);
    expect(p).toBeNull();
  });
});

describe("planTierFromValue", () => {
  it.each([
    [0,        "free"],
    [10,       "free"],
    [19.89,    "free"],
    [19.9,     "acesso"],
    [20,       "acesso"],
    [39.89,    "acesso"],
    [39.9,     "plano1"],
    [74.9,     "plano2"],
    [99.9,     "plano3"],
    [309.9,    "atleta"],
    [500,      "atleta"],
  ])("value %f → %s", async (value, expected) => {
    const tier = await planTierFromValue(value);
    expect(tier).toBe(expected);
  });
});

describe("discount lookups", () => {
  it.each([
    ["free",   0],
    ["acesso", 5],
    ["plano1", 8],
    ["plano2", 12],
    ["plano3", 18],
    ["atleta", 25],
  ])("getStoreDiscountPct(%s) → %d", async (slug, expected) => {
    expect(await getStoreDiscountPct(slug as never)).toBe(expected);
  });

  it.each([
    ["free",   0],
    ["acesso", 5],
    ["plano1", 7],
    ["plano2", 10],
    ["plano3", 12],
    ["atleta", 15],
  ])("getEsteticaDiscountPct(%s) → %d", async (slug, expected) => {
    expect(await getEsteticaDiscountPct(slug as never)).toBe(expected);
  });
});
```

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
npm run test -- src/lib/billing/plans.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/lib/billing/plans.ts`**

```ts
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/types";

export type PlanFeatures = {
  workouts_preview?: number;
  workouts?: boolean;
  diet?: boolean;
  supplements?: boolean;
  juices?: boolean;
  estetica_book_all?: boolean;
  affiliate_clicks_per_month?: number | "unlimited";
  chat_sla_h?: number;
  reavaliation?: "monthly" | "biweekly";
  video_call_per_month?: number;
};

export type Plan = {
  slug: PlanTier;
  name: string;
  level: number;
  price_cents: number;
  asaas_value: number;
  asaas_description: string;
  cashback_pct: number;
  store_discount_pct: number;
  estetica_discount_pct: number;
  features: PlanFeatures;
  is_active: boolean;
  sort_order: number;
};

const TTL_MS = 60_000;
let cache: { data: Plan[]; expiresAt: number } | null = null;

/** @internal — para testes */
export function _resetPlanCache(): void {
  cache = null;
}

async function loadPlans(): Promise<Plan[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("level", { ascending: true });
  if (error) throw new Error(`[billing/plans] load failed: ${error.message}`);
  return (data ?? []) as Plan[];
}

export async function getAllPlans(): Promise<Plan[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  const data = await loadPlans();
  cache = { data, expiresAt: now + TTL_MS };
  return data;
}

export async function getPlan(slug: PlanTier): Promise<Plan | null> {
  const all = await getAllPlans();
  return all.find(p => p.slug === slug) ?? null;
}

export async function getActivePlans(): Promise<Plan[]> {
  const all = await getAllPlans();
  return all.filter(p => p.is_active);
}

/**
 * Mapeia valor pago ao Asaas (em reais) → tier de plano.
 * Procura o plano com asaas_value mais próximo (≤ value).
 */
export async function planTierFromValue(value: number): Promise<PlanTier> {
  const plans = await getAllPlans();
  let match: Plan = plans.find(p => p.slug === "free")!;
  for (const p of plans) {
    if (p.asaas_value > 0 && p.asaas_value <= value && p.level > match.level) {
      match = p;
    }
  }
  return match.slug;
}

export async function getStoreDiscountPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.store_discount_pct ?? 0;
}

export async function getEsteticaDiscountPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.estetica_discount_pct ?? 0;
}

export async function getCashbackPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.cashback_pct ?? 0;
}
```

- [ ] **Step 4: Rodar teste e ver passar**

```bash
npm run test -- src/lib/billing/plans.test.ts
```

Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/plans.ts src/lib/billing/plans.test.ts
git commit -m "feat(billing): plans cache + planTierFromValue + lookups de desconto"
```

---

## Task 6: `lib/billing/wallet.ts` + `cashback-utils.ts`

**Files:**
- Create: `src/lib/billing/cashback-utils.ts`
- Create: `src/lib/billing/cashback-utils.test.ts`
- Create: `src/lib/billing/wallet.ts`
- Create: `src/lib/billing/wallet.test.ts`

- [ ] **Step 1: Teste de `cashback-utils.ts`**

`src/lib/billing/cashback-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clampCashbackCents, computeAmountPaidCash } from "./cashback-utils";

describe("clampCashbackCents", () => {
  it("limita ao saldo ativo", () => {
    expect(clampCashbackCents({ requested: 5000, gross: 10000, activeBalance: 3000 })).toBe(3000);
  });

  it("limita a 50% do gross", () => {
    expect(clampCashbackCents({ requested: 8000, gross: 10000, activeBalance: 9000 })).toBe(5000);
  });

  it("retorna 0 se requested ≤ 0", () => {
    expect(clampCashbackCents({ requested: 0, gross: 10000, activeBalance: 5000 })).toBe(0);
    expect(clampCashbackCents({ requested: -100, gross: 10000, activeBalance: 5000 })).toBe(0);
  });

  it("respeita o menor entre os limites", () => {
    expect(clampCashbackCents({ requested: 1000, gross: 10000, activeBalance: 500 })).toBe(500);
  });
});

describe("computeAmountPaidCash", () => {
  it("subtrai cashback do gross", () => {
    expect(computeAmountPaidCash({ gross: 10000, cashbackUsed: 3000 })).toBe(7000);
  });

  it("nunca abaixo de 0", () => {
    expect(computeAmountPaidCash({ gross: 1000, cashbackUsed: 5000 })).toBe(0);
  });
});
```

- [ ] **Step 2: Implementar `cashback-utils.ts`**

```ts
/** Helpers puros para cashback (sem I/O). */

export type ClampInput = {
  requested: number;
  gross: number;
  activeBalance: number;
};

/**
 * Aplica regras de uso de cashback:
 * - máximo = 50% do gross
 * - máximo = saldo ativo do user
 * - mínimo = 0
 */
export function clampCashbackCents(input: ClampInput): number {
  if (input.requested <= 0) return 0;
  const halfGross = Math.floor(input.gross * 0.5);
  return Math.min(input.requested, halfGross, input.activeBalance);
}

export function computeAmountPaidCash(input: { gross: number; cashbackUsed: number }): number {
  return Math.max(0, input.gross - input.cashbackUsed);
}
```

- [ ] **Step 3: Verificar testes utils**

```bash
npm run test -- src/lib/billing/cashback-utils.test.ts
```

Expected: PASS.

- [ ] **Step 4: Teste de `wallet.ts` (wrappers de RPCs)**

`src/lib/billing/wallet.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

import { spendWalletCents, creditWalletCents, getWalletActiveCents, getWalletBalance } from "./wallet";

describe("wallet wrappers", () => {
  it("spendWalletCents chama RPC com args", async () => {
    mockRpc.mockResolvedValueOnce({ data: 500, error: null });
    const r = await spendWalletCents({ userId: "user_1", amountCents: 1000, revenueStreamId: "rs_1" });
    expect(mockRpc).toHaveBeenCalledWith("spend_wallet_cents", {
      p_user_id: "user_1",
      p_amount_cents: 1000,
      p_revenue_stream_id: "rs_1",
    });
    expect(r).toBe(500);
  });

  it("creditWalletCents chama RPC com validade default 120 dias", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await creditWalletCents({ userId: "user_1", amountCents: 200, sourceStreamId: "rs_1" });
    expect(mockRpc).toHaveBeenCalledWith("credit_wallet_cents", {
      p_user_id: "user_1",
      p_amount_cents: 200,
      p_source_stream_id: "rs_1",
      p_validity_days: 120,
    });
  });

  it("getWalletActiveCents retorna saldo", async () => {
    mockRpc.mockResolvedValueOnce({ data: 1500, error: null });
    expect(await getWalletActiveCents("user_1")).toBe(1500);
  });

  it("spendWalletCents retorna 0 se amountCents ≤ 0", async () => {
    expect(await spendWalletCents({ userId: "u", amountCents: 0 })).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("getWalletBalance lê tabela wallet_balance", async () => {
    const single = vi.fn().mockResolvedValue({ data: { active_cents: 100, earned_total_cents: 500, spent_total_cents: 300, expired_total_cents: 100 }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const r = await getWalletBalance("user_1");
    expect(mockFrom).toHaveBeenCalledWith("wallet_balance");
    expect(r.active_cents).toBe(100);
  });
});
```

- [ ] **Step 5: Implementar `wallet.ts`**

```ts
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type WalletBalance = {
  active_cents: number;
  earned_total_cents: number;
  spent_total_cents: number;
  expired_total_cents: number;
};

export async function getWalletActiveCents(userId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("wallet_active_cents", { p_user_id: userId });
  if (error) throw new Error(`[wallet] active fail: ${error.message}`);
  return Number(data ?? 0);
}

export async function getWalletBalance(userId: string): Promise<WalletBalance> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_balance")
    .select("active_cents,earned_total_cents,spent_total_cents,expired_total_cents")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(`[wallet] balance fail: ${error.message}`);
  return data ?? { active_cents: 0, earned_total_cents: 0, spent_total_cents: 0, expired_total_cents: 0 };
}

export async function spendWalletCents(args: {
  userId: string;
  amountCents: number;
  revenueStreamId?: string;
}): Promise<number> {
  if (args.amountCents <= 0) return 0;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("spend_wallet_cents", {
    p_user_id: args.userId,
    p_amount_cents: args.amountCents,
    p_revenue_stream_id: args.revenueStreamId ?? null,
  });
  if (error) throw new Error(`[wallet] spend fail: ${error.message}`);
  return Number(data ?? 0);
}

export async function creditWalletCents(args: {
  userId: string;
  amountCents: number;
  sourceStreamId: string;
  validityDays?: number;
}): Promise<void> {
  if (args.amountCents <= 0) return;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("credit_wallet_cents", {
    p_user_id: args.userId,
    p_amount_cents: args.amountCents,
    p_source_stream_id: args.sourceStreamId,
    p_validity_days: args.validityDays ?? 120,
  });
  if (error) throw new Error(`[wallet] credit fail: ${error.message}`);
}

export async function expireWalletCredits(): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("expire_wallet_credits");
  if (error) throw new Error(`[wallet] expire fail: ${error.message}`);
  return Number(data ?? 0);
}

/** Lista créditos por user para extrato (página /perfil/cashback). */
export async function listWalletCreditsForUser(userId: string, limit = 100) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_credits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[wallet] list fail: ${error.message}`);
  return data ?? [];
}
```

- [ ] **Step 6: Verificar testes wallet**

```bash
npm run test -- src/lib/billing/wallet.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing/cashback-utils.ts src/lib/billing/cashback-utils.test.ts src/lib/billing/wallet.ts src/lib/billing/wallet.test.ts
git commit -m "feat(billing): wallet wrappers + cashback-utils puros"
```

---

## Task 7: `lib/billing/commissions.ts`

**Files:**
- Create: `src/lib/billing/commissions.ts`
- Create: `src/lib/billing/commissions.test.ts`

- [ ] **Step 1: Teste**

`src/lib/billing/commissions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

import { computeCommissions, listAllocations, approveAllocations, markAllocationsPaid } from "./commissions";

describe("computeCommissions", () => {
  it("delega à RPC compute_commissions", async () => {
    mockRpc.mockResolvedValueOnce({ data: 3, error: null });
    const r = await computeCommissions("rs_1");
    expect(mockRpc).toHaveBeenCalledWith("compute_commissions", { p_revenue_stream_id: "rs_1" });
    expect(r).toBe(3);
  });
});

describe("listAllocations", () => {
  it("filtra por status", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    await listAllocations({ status: "draft" });
    expect(mockFrom).toHaveBeenCalledWith("commission_allocations");
    expect(eq).toHaveBeenCalledWith("status", "draft");
  });
});
```

- [ ] **Step 2: Implementar**

`src/lib/billing/commissions.ts`:

```ts
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type AllocationStatus = "draft" | "approved" | "paid" | "failed";

export type CommissionAllocation = {
  id: string;
  revenue_stream_id: string;
  team_member_id: string;
  pct: number;
  amount_cents: number;
  status: AllocationStatus;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
};

export async function computeCommissions(revenueStreamId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("compute_commissions", {
    p_revenue_stream_id: revenueStreamId,
  });
  if (error) throw new Error(`[commissions] compute fail: ${error.message}`);
  return Number(data ?? 0);
}

export async function listAllocations(filter: {
  status?: AllocationStatus;
  teamMemberId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("commission_allocations")
    .select("*, team_members(*), revenue_streams(*)");
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.teamMemberId) query = query.eq("team_member_id", filter.teamMemberId);
  if (filter.fromDate) query = query.gte("created_at", filter.fromDate);
  if (filter.toDate) query = query.lte("created_at", filter.toDate);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`[commissions] list fail: ${error.message}`);
  return data ?? [];
}

export async function approveAllocations(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createAdminSupabaseClient();
  const { error, count } = await supabase
    .from("commission_allocations")
    .update({ status: "approved" })
    .in("id", ids)
    .eq("status", "draft");
  if (error) throw new Error(`[commissions] approve fail: ${error.message}`);
  return count ?? 0;
}

export async function markAllocationsPaid(ids: string[], reference: string): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createAdminSupabaseClient();
  const { error, count } = await supabase
    .from("commission_allocations")
    .update({ status: "paid", paid_at: new Date().toISOString(), payout_reference: reference })
    .in("id", ids)
    .eq("status", "approved");
  if (error) throw new Error(`[commissions] paid fail: ${error.message}`);
  return count ?? 0;
}

/** Total a pagar por sócio (allocations approved). */
export async function pendingPayoutsByMember() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("commission_allocations")
    .select("team_member_id, amount_cents, team_members(full_name, pix_key)")
    .eq("status", "approved");
  if (error) throw new Error(`[commissions] payouts fail: ${error.message}`);
  const grouped = new Map<string, { name: string; pix_key: string | null; total_cents: number }>();
  for (const row of data ?? []) {
    const tm = (row as unknown as { team_members: { full_name: string; pix_key: string | null } }).team_members;
    const cur = grouped.get(row.team_member_id) ?? { name: tm.full_name, pix_key: tm.pix_key, total_cents: 0 };
    cur.total_cents += row.amount_cents;
    grouped.set(row.team_member_id, cur);
  }
  return Array.from(grouped.entries()).map(([id, v]) => ({ team_member_id: id, ...v }));
}
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test -- src/lib/billing/commissions.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/billing/commissions.ts src/lib/billing/commissions.test.ts
git commit -m "feat(billing): commissions wrappers + queries para painel admin"
```

---

## Task 8: `lib/billing/revenue.ts` + `lib/asaas/external-reference.ts`

**Files:**
- Create: `src/lib/asaas/external-reference.ts`
- Create: `src/lib/asaas/external-reference.test.ts`
- Create: `src/lib/billing/revenue.ts`
- Create: `src/lib/billing/revenue.test.ts`

- [ ] **Step 1: Teste de `parseExternalReference`**

`src/lib/asaas/external-reference.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseExternalReference } from "./external-reference";

describe("parseExternalReference", () => {
  it("estetica:<id>", () => {
    expect(parseExternalReference("estetica:abc-123")).toEqual({
      type: "estetica",
      reference_type: "booking",
      reference_id: "abc-123",
    });
  });

  it("loja:<id>", () => {
    expect(parseExternalReference("loja:order-1")).toEqual({
      type: "loja",
      reference_type: "order",
      reference_id: "order-1",
    });
  });

  it("user_id puro → mensalidade", () => {
    expect(parseExternalReference("user_2N3xxxx")).toEqual({
      type: "mensalidade",
      reference_type: "subscription",
      reference_id: "user_2N3xxxx",
    });
  });

  it("undefined retorna null", () => {
    expect(parseExternalReference(undefined)).toBeNull();
    expect(parseExternalReference("")).toBeNull();
  });
});
```

- [ ] **Step 2: Implementar `external-reference.ts`**

```ts
export type ParsedExternalReference =
  | { type: "estetica";       reference_type: "booking";          reference_id: string }
  | { type: "loja";           reference_type: "order";            reference_id: string }
  | { type: "mensalidade";    reference_type: "subscription";     reference_id: string };

/**
 * Routing do externalReference do Asaas para o tipo de revenue_stream.
 *
 * Patterns:
 * - "estetica:<bookingId>" → type=estetica
 * - "loja:<orderId>"       → type=loja
 * - "<clerk_user_id>"      → type=mensalidade (subscription do user)
 * - falsy                  → null (caller decide)
 */
export function parseExternalReference(raw: string | null | undefined): ParsedExternalReference | null {
  if (!raw) return null;
  if (raw.startsWith("estetica:")) {
    return { type: "estetica", reference_type: "booking", reference_id: raw.slice("estetica:".length) };
  }
  if (raw.startsWith("loja:")) {
    return { type: "loja", reference_type: "order", reference_id: raw.slice("loja:".length) };
  }
  return { type: "mensalidade", reference_type: "subscription", reference_id: raw };
}
```

- [ ] **Step 3: Teste de `revenue.ts`**

`src/lib/billing/revenue.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const mockInsert = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => mockInsert(),
        }),
      }),
    }),
    rpc: mockRpc,
  }),
}));

import { recordRevenueStream } from "./revenue";

describe("recordRevenueStream", () => {
  it("inserts and triggers compute_commissions", async () => {
    mockInsert.mockResolvedValueOnce({ data: { id: "rs_1" }, error: null });
    mockRpc.mockResolvedValueOnce({ data: 3, error: null });

    const r = await recordRevenueStream({
      type: "mensalidade",
      category: "plano3",
      user_id: "user_1",
      reference_type: "subscription",
      reference_id: "user_1",
      asaas_payment_id: "pay_1",
      gross_cents: 9990,
      cost_cents: 0,
      cashback_used_cents: 0,
      occurred_at: new Date("2026-05-02").toISOString(),
    });

    expect(r.id).toBe("rs_1");
    expect(mockRpc).toHaveBeenCalledWith("compute_commissions", { p_revenue_stream_id: "rs_1" });
  });
});
```

- [ ] **Step 4: Implementar `revenue.ts`**

```ts
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type RevenueStreamType = "mensalidade" | "loja" | "estetica" | "afiliado_externo";
export type RevenueReferenceType = "subscription" | "order" | "booking" | "affiliate_payout";

export type RecordRevenueInput = {
  type: RevenueStreamType;
  category: string | null;
  user_id: string | null;
  reference_type: RevenueReferenceType;
  reference_id: string;
  asaas_payment_id: string | null;
  gross_cents: number;
  cost_cents: number;
  cashback_used_cents: number;
  occurred_at: string;
};

export type RevenueStream = RecordRevenueInput & {
  id: string;
  net_cents: number;
  status: "pending" | "confirmed" | "refunded";
  created_at: string;
};

export async function recordRevenueStream(input: RecordRevenueInput): Promise<RevenueStream> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("revenue_streams")
    .insert({ ...input, status: "confirmed" })
    .select()
    .single();
  if (error || !data) throw new Error(`[revenue] insert fail: ${error?.message ?? "no data"}`);

  // Disparar comissões
  const { error: rpcErr } = await supabase.rpc("compute_commissions", {
    p_revenue_stream_id: data.id,
  });
  if (rpcErr) throw new Error(`[revenue] commissions fail: ${rpcErr.message}`);

  return data as RevenueStream;
}

export async function refundRevenueStream(streamId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("revenue_streams")
    .update({ status: "refunded" })
    .eq("id", streamId);
  if (error) throw new Error(`[revenue] refund fail: ${error.message}`);

  // marca allocations dessa stream como failed
  await supabase
    .from("commission_allocations")
    .update({ status: "failed" })
    .eq("revenue_stream_id", streamId)
    .in("status", ["draft", "approved"]);
}
```

- [ ] **Step 5: Verificar testes**

```bash
npm run test -- src/lib/asaas/external-reference.test.ts src/lib/billing/revenue.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/asaas/external-reference.ts src/lib/asaas/external-reference.test.ts src/lib/billing/revenue.ts src/lib/billing/revenue.test.ts
git commit -m "feat(billing): recordRevenueStream + parseExternalReference"
```

---

# Fase 3 — Asaas refactor

## Task 9: Refatorar `lib/asaas/config.ts`

**Files:**
- Modify: `src/lib/asaas/config.ts`

- [ ] **Step 1: Remover constants antigos**

Substituir o arquivo inteiro por (manter apenas `ASAAS_CONFIG`):

```ts
/**
 * Asaas API config. PLAN_PRICES, PLAN_DESCRIPTIONS e PLAN_HIERARCHY
 * foram movidos para a tabela `plans` (admin-editável).
 *
 * Ver: src/lib/billing/plans.ts
 */
export const ASAAS_CONFIG = {
  apiKey: process.env.ASAAS_API_KEY ?? "",
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? "",
  baseUrl:
    process.env.ASAAS_ENV === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3",
  env: process.env.ASAAS_ENV === "production" ? "production" : "sandbox",
} as const;
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Erros esperados em arquivos que importavam `PLAN_PRICES`/`PLAN_DESCRIPTIONS`/`PLAN_HIERARCHY`. Anotar os caminhos. Esperar tasks 10-11 para arrumar.

- [ ] **Step 3: Commit**

```bash
git add src/lib/asaas/config.ts
git commit -m "refactor(asaas): remover PLAN_PRICES/DESCRIPTIONS/HIERARCHY (movido para plans table)"
```

---

## Task 10: Refatorar `lib/asaas/webhook.ts`

**Files:**
- Modify: `src/lib/asaas/webhook.ts`
- Test: `src/lib/asaas/webhook.test.ts` (reusar/expandir o existente)

- [ ] **Step 1: Atualizar `planTierFromValue`**

Substituir a função (atual lines 52-57) por delegação:

```ts
import { planTierFromValue as planTierFromValueDynamic } from "@/lib/billing/plans";
import { recordRevenueStream } from "@/lib/billing/revenue";
import { creditWalletCents } from "@/lib/billing/wallet";
import { parseExternalReference } from "@/lib/asaas/external-reference";

// Manter `verifyWebhookToken` como está.

/**
 * Lookup dinâmico — substitui versão hardcoded.
 * Mantém async; callers que tinham sync precisam adaptar.
 */
export async function planTierFromValue(value: number) {
  return planTierFromValueDynamic(value);
}
```

- [ ] **Step 2: Atualizar handler `PAYMENT_CONFIRMED`**

Localizar o handler em `src/app/api/webhook/asaas/route.ts` (não em webhook.ts — confira). Após o INSERT idempotente em `webhook_events`, adicionar:

```ts
// Após verificar idempotência (já feito) e antes do switch de eventos:
const ref = parseExternalReference(payment.externalReference);

// === PAYMENT_CONFIRMED ou PAYMENT_RECEIVED ===
if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
  if (!ref) {
    console.warn("[webhook] payment without externalReference", { id: payment.id });
    return ok();
  }

  // 1. Resolver gross/cost/cashback_used/category/user_id
  let gross_cents = Math.round(payment.value * 100);
  let cost_cents = 0;
  let cashback_used_cents = 0;
  let category: string | null = null;
  let user_id: string | null = null;

  if (ref.type === "mensalidade") {
    user_id = ref.reference_id;
    const tier = await planTierFromValueDynamic(payment.value);
    category = tier;
    cost_cents = 0;
    cashback_used_cents = 0;
  } else if (ref.type === "loja") {
    const { data: order } = await supabase
      .from("orders")
      .select("user_id, items, cashback_used_cents")
      .eq("id", ref.reference_id)
      .single();
    if (!order) {
      console.error("[webhook] order not found", { id: ref.reference_id });
      return ok();
    }
    user_id = order.user_id;
    cashback_used_cents = order.cashback_used_cents ?? 0;
    // CMV agregado dos items (snapshot)
    cost_cents = computeOrderCostCents(order.items);
    category = computeDominantModule(order.items);
  } else if (ref.type === "estetica") {
    const { data: booking } = await supabase
      .from("estetica_bookings")
      .select("user_id, total_cents, cashback_used_cents, service_id, estetica_services(cost_cents)")
      .eq("id", ref.reference_id)
      .single();
    if (!booking) return ok();
    user_id = booking.user_id;
    cashback_used_cents = booking.cashback_used_cents ?? 0;
    cost_cents = (booking as unknown as { estetica_services: { cost_cents: number } }).estetica_services.cost_cents ?? 0;
    category = null;
  }

  // 2. Inserir revenue_stream
  const stream = await recordRevenueStream({
    type: ref.type,
    category,
    user_id,
    reference_type: ref.reference_type,
    reference_id: ref.reference_id,
    asaas_payment_id: payment.id,
    gross_cents,
    cost_cents,
    cashback_used_cents,
    occurred_at: payment.confirmedDate ?? new Date().toISOString(),
  });

  // 3. Atualizar profile (mensalidade)
  if (ref.type === "mensalidade" && user_id) {
    const newTier = category as PlanTier; // resolved acima
    await supabase
      .from("profiles")
      .update({
        plan_tier: newTier,
        subscription_status: "active",
        subscription_ends_at: addDays(new Date(), 30).toISOString(),
        asaas_subscription_id: payment.subscription ?? undefined,
      })
      .eq("id", user_id);

    // Cashback imediato em mensalidades
    const cashback = Math.floor(gross_cents * (await getCashbackPctFor(newTier)) / 100);
    if (cashback > 0) {
      await creditWalletCents({
        userId: user_id,
        amountCents: cashback,
        sourceStreamId: stream.id,
      });
    }

    // Auto-criar consultoria
    if (newTier === "plano2" || newTier === "plano3") {
      await ensureConsultation(supabase, user_id, "mensal");
    } else if (newTier === "atleta") {
      await ensureConsultation(supabase, user_id, "premium");
    }
  }
  // Para loja/estética: cashback é creditado em markOrderDelivered/markBookingDone (Tasks 12-14).

  return ok();
}
```

Helpers a importar:

```ts
import { addDays } from "@/lib/date-utils"; // criar se não existir

function computeOrderCostCents(items: Array<{ product_id: string; quantity: number; cost_cents?: number }>): number {
  return items.reduce((sum, it) => sum + (it.cost_cents ?? 0) * it.quantity, 0);
}

function computeDominantModule(items: Array<{ module?: string }>): string | null {
  const counts = new Map<string, number>();
  for (const it of items) {
    const m = it.module ?? "geral";
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let max = 0; let dom: string | null = null;
  for (const [k, v] of counts) {
    if (v > max) { max = v; dom = k; }
  }
  return dom;
}

async function getCashbackPctFor(slug: PlanTier): Promise<number> {
  const { getPlan } = await import("@/lib/billing/plans");
  return (await getPlan(slug))?.cashback_pct ?? 0;
}

async function ensureConsultation(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  packageType: "mensal" | "trimestral" | "premium" | "assessoria",
) {
  const { data: existing } = await supabase
    .from("consultations")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["pending", "in_progress"])
    .maybeSingle();
  if (existing) return;
  await supabase.from("consultations").insert({
    user_id: userId,
    package_type: packageType,
    status: "pending",
    valid_until: addDays(new Date(), 30).toISOString(),
  });
}
```

- [ ] **Step 3: Criar `src/lib/date-utils.ts` se não existir**

```ts
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
```

- [ ] **Step 4: Atualizar handlers de outros eventos**

`PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED` — manter lógica existente, mas para `PAYMENT_REFUNDED` adicionar:

```ts
if (event === "PAYMENT_REFUNDED") {
  // ... lógica existente de plan_tier=free, subscription_status=canceled

  // Adicional: marcar revenue_stream como refunded
  const { data: existing } = await supabase
    .from("revenue_streams")
    .select("id")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();
  if (existing) {
    const { refundRevenueStream } = await import("@/lib/billing/revenue");
    await refundRevenueStream(existing.id);
  }
}
```

- [ ] **Step 5: Verificar build e tests**

```bash
npm run build
npm run test -- src/lib/asaas/webhook.test.ts
```

Atualizar testes existentes para refletir async planTierFromValue.

- [ ] **Step 6: Commit**

```bash
git add src/lib/asaas/webhook.ts src/app/api/webhook/asaas/route.ts src/lib/date-utils.ts src/lib/asaas/webhook.test.ts
git commit -m "refactor(asaas): webhook integra revenue_streams + commissions + cashback"
```

---

## Task 11: Refatorar `lib/asaas/checkout.ts`

**Files:**
- Modify: `src/lib/asaas/checkout.ts`

- [ ] **Step 1: Substituir lookup hardcoded por leitura de `plans`**

Substituir o ponto onde lê `PLAN_PRICES[plan]` e `PLAN_DESCRIPTIONS[plan]` por:

```ts
import { getPlan } from "@/lib/billing/plans";
// remover import de PLAN_PRICES, PLAN_DESCRIPTIONS

export async function processCheckout(params: {
  userId: string;
  fullName: string;
  email: string;
  plan: PlanTier;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
}): Promise<CheckoutResult> {
  const planRow = await getPlan(params.plan);
  if (!planRow || !planRow.is_active || planRow.asaas_value <= 0) {
    throw new Error(`[checkout] plan inválido ou gratuito: ${params.plan}`);
  }
  // ... resto: usar planRow.asaas_value e planRow.asaas_description
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: passa (ou só reporta erros das outras tasks).

- [ ] **Step 3: Commit**

```bash
git add src/lib/asaas/checkout.ts
git commit -m "refactor(asaas): checkout lê asaas_value e description de plans table"
```

---

# Fase 4 — Loja + Estética checkout

## Task 12: `/api/loja/checkout` — desconto via plans + cashback

**Files:**
- Modify: `src/app/api/loja/checkout/route.ts`

- [ ] **Step 1: Atualizar route handler**

Mudanças principais:
1. Remover lookup `discount_start/pro/vip` em produtos.
2. Buscar `plans.store_discount_pct` via `getStoreDiscountPct(profile.plan_tier)`.
3. Aceitar body `use_cashback_cents`, validar com Zod, clampar e gastar via `spendWalletCents`.
4. Gravar `cashback_used_cents` em `orders`.
5. Manter atomicidade do estoque.

Substituir handler core:

```ts
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getStoreDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents, spendWalletCents } from "@/lib/billing/wallet";
import { clampCashbackCents, computeAmountPaidCash } from "@/lib/billing/cashback-utils";
import { handleApiError } from "@/lib/api-error";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const itemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  variant: z.string().optional(),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  shipping_info: z.object({
    name: z.string().min(1),
    phone: z.string().min(8),
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().min(8).max(9),
  }),
  shipping_method: z.string().optional(),
  shipping_cost_cents: z.number().int().min(0).default(0),
  use_cashback_cents: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "unauthenticated" }, { status: 401 });

    const rl = await checkRateLimitAsync(`loja-checkout:${userId}`, { maxRequests: 5, windowMs: 60_000 });
    if (!rl.allowed) return Response.json({ error: "rate_limit" }, { status: 429 });

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();
    if (!profile) return Response.json({ error: "profile_not_found" }, { status: 404 });

    const productIds = parsed.data.items.map(i => i.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id,title,price_cents,cost_cents,stock,module,is_active")
      .in("id", productIds);
    if (!products || products.length !== productIds.length) {
      return Response.json({ error: "product_not_found" }, { status: 404 });
    }
    const productById = new Map(products.map(p => [p.id, p]));

    const discountPct = await getStoreDiscountPct(profile.plan_tier);

    let subtotal_cents = 0;
    let total_cost_cents = 0;
    const orderItems: Array<{ product_id: string; title: string; quantity: number; variant?: string; price_cents: number; cost_cents: number; module: string }> = [];
    for (const item of parsed.data.items) {
      const p = productById.get(item.product_id);
      if (!p || !p.is_active) return Response.json({ error: "product_inactive", id: item.product_id }, { status: 400 });
      if (p.stock < item.quantity) return Response.json({ error: "out_of_stock", id: p.id }, { status: 400 });
      const unit_after_discount = Math.round(p.price_cents * (100 - discountPct) / 100);
      subtotal_cents += unit_after_discount * item.quantity;
      total_cost_cents += p.cost_cents * item.quantity;
      orderItems.push({ product_id: p.id, title: p.title, quantity: item.quantity, variant: item.variant, price_cents: unit_after_discount, cost_cents: p.cost_cents, module: p.module });
    }

    const total_pre_cashback = subtotal_cents + parsed.data.shipping_cost_cents;

    // Cashback
    const active = await getWalletActiveCents(userId);
    const cashback_used_cents = clampCashbackCents({ requested: parsed.data.use_cashback_cents, gross: total_pre_cashback, activeBalance: active });
    const total_cents = computeAmountPaidCash({ gross: total_pre_cashback, cashbackUsed: cashback_used_cents });

    // Decremento de estoque atômico (RPC já existe)
    const { error: rpcErr } = await supabase.rpc("decrement_stock_batch", {
      p_items: orderItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
    });
    if (rpcErr) {
      // Fallback: chamar decrement individual com rollback (lógica atual). Já existe.
      // ... manter.
    }

    // Inserir order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        items: orderItems,
        subtotal_cents,
        discount_cents: 0, // já aplicado nos items
        shipping_cost_cents: parsed.data.shipping_cost_cents,
        shipping_method: parsed.data.shipping_method,
        shipping_info: parsed.data.shipping_info,
        cashback_used_cents,
        total_cents,
      })
      .select()
      .single();
    if (orderErr || !order) {
      // rollback estoque
      await supabase.rpc("increment_stock_batch", { p_items: orderItems });
      return Response.json({ error: "order_create_fail" }, { status: 500 });
    }

    // Gastar cashback (FIFO com lock)
    if (cashback_used_cents > 0) {
      await spendWalletCents({ userId, amountCents: cashback_used_cents });
      // Sem revenue_stream_id ainda — webhook preencherá.
    }

    return Response.json({ orderId: order.id, total_cents, cashback_used_cents });
  } catch (err) {
    return handleApiError(err, "POST /api/loja/checkout");
  }
}
```

- [ ] **Step 2: Criar RPC `decrement_stock_batch` se não existir**

Verificar em DB. Se não, anexar à migration ou criar separada:

```sql
create or replace function public.decrement_stock_batch(p_items jsonb)
returns void language plpgsql security definer as $$
declare
  v_item record;
begin
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    update public.products
      set stock = stock - v_item.quantity
      where id = v_item.product_id and stock >= v_item.quantity;
    if not found then
      raise exception 'out_of_stock_or_invalid: %', v_item.product_id;
    end if;
  end loop;
end;
$$;

create or replace function public.increment_stock_batch(p_items jsonb)
returns void language plpgsql security definer as $$
declare
  v_item record;
begin
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;
end;
$$;
```

Adicionar à `migration_modelo_financeiro.sql` (depois da seção 8) e re-aplicar.

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/loja/checkout/route.ts supabase/migration_modelo_financeiro.sql
git commit -m "feat(loja): checkout com desconto via plans + cashback FIFO"
```

---

## Task 13: `/api/estetica/bookings` — desconto via plans + cashback

**Files:**
- Modify: `src/app/api/estetica/bookings/route.ts`
- Modify: `src/app/api/estetica/bookings/[id]/payment/route.ts`

- [ ] **Step 1: Atualizar `route.ts` (criar booking)**

Mudanças:
1. Remover lookup `discount_start/pro/vip` em `estetica_services`.
2. Buscar via `getEsteticaDiscountPct(profile.plan_tier)`.
3. Aceitar `use_cashback_cents`, clampar, gastar.
4. Gravar `cashback_used_cents` em `estetica_bookings`.
5. Verificar `estetica_services.requires_paid_plan` — se true e user é free, recusar.

Trecho relevante (substituir cálculo de preço):

```ts
import { getEsteticaDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents, spendWalletCents } from "@/lib/billing/wallet";
import { clampCashbackCents, computeAmountPaidCash } from "@/lib/billing/cashback-utils";

// ... auth, validate, fetch service, fetch profile ...

if (service.requires_paid_plan && profile.plan_tier === "free") {
  return Response.json({ error: "requires_paid_plan" }, { status: 403 });
}

const discountPct = await getEsteticaDiscountPct(profile.plan_tier);
const plan_discount_cents = Math.round(service.price_cents * discountPct / 100);
const price_after_discount = service.price_cents - plan_discount_cents;

// loyalty_free permanece como antes (substitui price_after_discount)
let final_gross = price_after_discount;
if (loyalty_free) final_gross = 0;

const active = await getWalletActiveCents(userId);
const cashback_used_cents = clampCashbackCents({
  requested: parsed.data.use_cashback_cents ?? 0,
  gross: final_gross,
  activeBalance: active,
});
const total_cents = computeAmountPaidCash({ gross: final_gross, cashbackUsed: cashback_used_cents });

// ... insert estetica_bookings com price_cents=service.price_cents, plan_discount_cents, cashback_used_cents, total_cents
```

E ao inserir:
```ts
.insert({
  // ... campos existentes
  price_cents: service.price_cents,
  plan_discount_cents,
  loyalty_free,
  cashback_used_cents,
  total_cents,
  status: total_cents === 0 ? "confirmed" : "pending",
})

// gastar cashback (depois da insert)
if (cashback_used_cents > 0) {
  await spendWalletCents({ userId, amountCents: cashback_used_cents });
}
```

- [ ] **Step 2: Atualizar `[id]/payment/route.ts`**

Asaas value = `total_cents / 100`. Já é `total_cents` que é o `amount_paid_cash`. Manter.

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/estetica/bookings/route.ts src/app/api/estetica/bookings/[id]/payment/route.ts
git commit -m "feat(estetica): bookings com desconto via plans + cashback + requires_paid_plan"
```

---

## Task 14: Server actions `markOrderDelivered` e `markBookingDone`

**Files:**
- Create: `src/app/admin/loja/order-actions.ts`
- Create: `src/app/admin/kath-estetica/booking-actions.ts`

- [ ] **Step 1: `order-actions.ts`**

```ts
"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { creditWalletCents } from "@/lib/billing/wallet";
import { getCashbackPct } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export async function markOrderDelivered(orderId: string, trackingCode?: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .update({ status: "delivered", tracking_code: trackingCode })
    .eq("id", orderId)
    .eq("status", "shipped")
    .select("id,user_id,total_cents,profiles(plan_tier)")
    .single();

  if (error || !order) throw new Error("order_not_shipped_or_not_found");

  // Buscar revenue_stream e creditar cashback
  const { data: rs } = await supabase
    .from("revenue_streams")
    .select("id,user_id")
    .eq("type", "loja")
    .eq("reference_id", orderId)
    .eq("status", "confirmed")
    .single();

  if (rs && rs.user_id) {
    const planTier = (order as unknown as { profiles: { plan_tier: PlanTier } }).profiles.plan_tier;
    const cashbackPct = await getCashbackPct(planTier);
    const amountPaidCash = order.total_cents; // já é gross - cashback usado
    const cashbackEarned = Math.floor(amountPaidCash * cashbackPct / 100);
    if (cashbackEarned > 0) {
      await creditWalletCents({
        userId: rs.user_id,
        amountCents: cashbackEarned,
        sourceStreamId: rs.id,
      });
    }
  }

  revalidatePath("/admin/loja");
}
```

- [ ] **Step 2: `booking-actions.ts`**

```ts
"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { creditWalletCents } from "@/lib/billing/wallet";
import { getCashbackPct } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export async function markBookingDone(bookingId: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const { data: booking, error } = await supabase
    .from("estetica_bookings")
    .update({ status: "done" })
    .eq("id", bookingId)
    .in("status", ["confirmed", "in_progress"])
    .select("id,user_id,total_cents,profiles(plan_tier)")
    .single();

  if (error || !booking) throw new Error("booking_not_found_or_invalid_status");

  const { data: rs } = await supabase
    .from("revenue_streams")
    .select("id,user_id")
    .eq("type", "estetica")
    .eq("reference_id", bookingId)
    .eq("status", "confirmed")
    .single();

  if (rs && rs.user_id) {
    const planTier = (booking as unknown as { profiles: { plan_tier: PlanTier } }).profiles.plan_tier;
    const cashbackPct = await getCashbackPct(planTier);
    const amountPaidCash = booking.total_cents;
    const cashbackEarned = Math.floor(amountPaidCash * cashbackPct / 100);
    if (cashbackEarned > 0) {
      await creditWalletCents({
        userId: rs.user_id,
        amountCents: cashbackEarned,
        sourceStreamId: rs.id,
      });
    }
  }

  revalidatePath("/admin/kath-estetica/agendamentos");
}
```

- [ ] **Step 3: Conectar UI dos botões**

Em `src/app/admin/loja/order-list.tsx`, adicionar botão "Marcar entregue" para orders com `status='shipped'`:

```tsx
<form action={async () => {
  "use server";
  const { markOrderDelivered } = await import("./order-actions");
  await markOrderDelivered(order.id);
}}>
  <SubmitButton variant="secondary" size="sm">Marcar entregue</SubmitButton>
</form>
```

Em `src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx`, idem para `markBookingDone` no kanban da coluna "Em andamento".

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/admin/loja/order-actions.ts src/app/admin/kath-estetica/booking-actions.ts src/app/admin/loja/order-list.tsx src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx
git commit -m "feat(admin): markOrderDelivered + markBookingDone creditam cashback"
```

---

## Task 15: Admin product-form + service-form

**Files:**
- Modify: `src/app/admin/loja/product-form.tsx`
- Modify: `src/app/admin/kath-estetica/servicos/service-form.tsx`
- Modify: `src/lib/validations.ts` (createProductSchema)

- [ ] **Step 1: Atualizar `createProductSchema` em `validations.ts`**

```ts
export const createProductSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url("URL da imagem inválida"),
  price_cents: z.coerce.number().int().min(1, "Preço em centavos > 0"),
  cost_cents: z.coerce.number().int().min(0).default(0),
  compare_price: z.coerce.number().int().min(0).nullable().optional(),
  category: z.string().min(1).max(100),
  module: z.enum(["fitness", "moto", "geral"]).default("geral"),
  stock: z.coerce.number().int().min(0).default(0),
  weight_kg: z.coerce.number().min(0.01).default(0.5),
  height_cm: z.coerce.number().int().min(1).default(10),
  width_cm: z.coerce.number().int().min(1).default(20),
  length_cm: z.coerce.number().int().min(1).default(30),
});
```

Remover campos `discount_start`, `discount_pro`, `discount_vip`, `price` (decimal).

- [ ] **Step 2: Atualizar `product-form.tsx`**

Substituir os 3 inputs de desconto (start/pro/vip) por **um aviso informativo**:

```tsx
<div className="rounded-md bg-bg-2 border border-gray-4 p-3 text-sm text-gray-2">
  <strong className="text-gray-1">Descontos por plano:</strong> aplicados automaticamente
  conforme a tabela <a href="/admin/plans" className="underline">Planos</a>.
</div>
```

Adicionar input de `cost_cents`:

```tsx
<label className="block">
  <span>Custo do fornecedor (centavos) — CMV</span>
  <Input name="cost_cents" type="number" min={0} defaultValue={product?.cost_cents ?? 0} />
  <span className="text-xs text-gray-2">Usado para calcular margem em comissões. Ex: 12000 = R$ 120,00</span>
</label>
```

Mudar `price` decimal para `price_cents` int:

```tsx
<label>
  <span>Preço (centavos)</span>
  <Input name="price_cents" type="number" min={1} required defaultValue={product?.price_cents} />
</label>
```

- [ ] **Step 3: Atualizar `service-form.tsx`**

Adicionar `cost_cents` e `requires_paid_plan` (toggle), remover `discount_*`.

```tsx
<label>
  <span>Custo médio de insumos (centavos)</span>
  <Input name="cost_cents" type="number" min={0} defaultValue={service?.cost_cents ?? 0} />
</label>

<label className="flex items-center gap-2">
  <input type="checkbox" name="requires_paid_plan" defaultChecked={service?.requires_paid_plan ?? false} />
  <span>Exige plano pago para agendar (lavagem detalhada, vitrificação, etc)</span>
</label>
```

E criar `createEsteticaServiceSchema` se ainda não existir em `validations.ts`:

```ts
export const createEsteticaServiceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  category: z.enum(["lavagem","polimento","vitrificacao","higienizacao","cristalizacao","outros"]),
  duration_min: z.coerce.number().int().min(15).max(480).default(60),
  price_cents: z.coerce.number().int().min(1),
  cost_cents: z.coerce.number().int().min(0).default(0),
  compare_price: z.coerce.number().int().min(0).nullable().optional(),
  includes: z.array(z.string()).default([]),
  eligible_for_loyalty: z.coerce.boolean().default(true),
  requires_paid_plan: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/admin/loja/product-form.tsx src/app/admin/kath-estetica/servicos/service-form.tsx src/lib/validations.ts
git commit -m "feat(admin): product-form + service-form com cost_cents (CMV); descontos via plans"
```

---

# Fase 5 — Crons

## Task 16: `/api/cron/wallet-expire` + `/api/cron/order-timeout`

**Files:**
- Create: `src/app/api/cron/wallet-expire/route.ts`
- Create: `src/app/api/cron/order-timeout/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: `wallet-expire/route.ts`**

```ts
import { NextResponse } from "next/server";
import { expireWalletCredits } from "@/lib/billing/wallet";
import { handleApiError } from "@/lib/api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function authorize(req: Request) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  try {
    if (!authorize(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 1. Expirar créditos vencidos
    const expired = await expireWalletCredits();

    // 2. Avisar 7 dias antes
    const supabase = createAdminSupabaseClient();
    const { data: expiringSoon } = await supabase
      .from("wallet_credits")
      .select("user_id, amount_cents, expires_at")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .lt("expires_at", new Date(Date.now() + 8 * 86400_000).toISOString())
      .gt("amount_cents", 0);

    const byUser = new Map<string, number>();
    for (const c of expiringSoon ?? []) {
      byUser.set(c.user_id, (byUser.get(c.user_id) ?? 0) + c.amount_cents);
    }

    let notified = 0;
    for (const [userId, total] of byUser) {
      await notifyUser(userId, {
        title: "Cashback expirando",
        body: `Você tem R$ ${(total / 100).toFixed(2)} em cashback expirando em 7 dias.`,
        icon: "Wallet",
        url: "/perfil/cashback",
      });
      notified++;
    }

    return NextResponse.json({ expired_cents: expired, notified });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/wallet-expire");
  }
}
```

- [ ] **Step 2: `order-timeout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { creditWalletCents } from "@/lib/billing/wallet";

export const dynamic = "force-dynamic";

function authorize(req: Request) {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

const TIMEOUT_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  try {
    if (!authorize(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const supabase = createAdminSupabaseClient();
    const cutoff = new Date(Date.now() - TIMEOUT_MS).toISOString();

    // Orders pending há > 24h
    const { data: orders } = await supabase
      .from("orders")
      .select("id, user_id, items, cashback_used_cents")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    let canceled_orders = 0;
    for (const order of orders ?? []) {
      // Restaurar estoque
      await supabase.rpc("increment_stock_batch", {
        p_items: order.items.map((i: { product_id: string; quantity: number }) => ({
          product_id: i.product_id, quantity: i.quantity,
        })),
      });

      // Reverter cashback (criar credit positivo de mesmo valor, validade 30 dias)
      if (order.cashback_used_cents > 0) {
        await creditWalletCents({
          userId: order.user_id,
          amountCents: order.cashback_used_cents,
          sourceStreamId: order.id, // referência simbólica
          validityDays: 30,
        });
      }

      await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
      canceled_orders++;
    }

    // Bookings pending há > 24h
    const { data: bookings } = await supabase
      .from("estetica_bookings")
      .select("id, user_id, cashback_used_cents")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    let canceled_bookings = 0;
    for (const b of bookings ?? []) {
      if (b.cashback_used_cents > 0) {
        await creditWalletCents({
          userId: b.user_id,
          amountCents: b.cashback_used_cents,
          sourceStreamId: b.id,
          validityDays: 30,
        });
      }
      await supabase.from("estetica_bookings").update({ status: "canceled" }).eq("id", b.id);
      canceled_bookings++;
    }

    return NextResponse.json({ canceled_orders, canceled_bookings });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/order-timeout");
  }
}
```

- [ ] **Step 3: Configurar Vercel Cron via `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/wallet-expire",   "schedule": "0 6 * * *" },
    { "path": "/api/cron/order-timeout",   "schedule": "0 * * * *" }
  ]
}
```

Adicionar `CRON_SECRET` ao `.env.example`:

```
# ── Vercel Cron ──
CRON_SECRET=...
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/api/cron/wallet-expire/route.ts src/app/api/cron/order-timeout/route.ts vercel.json .env.example
git commit -m "feat(cron): wallet-expire (daily) + order-timeout (hourly)"
```

---

# Fase 6 — Frontend usuário

## Task 17: `/planos` page render dinâmico

**Files:**
- Modify: `src/app/(app)/planos/page.tsx`
- Modify: `src/app/(app)/planos/subscribe-button.tsx`

- [ ] **Step 1: Reescrever `page.tsx` (Server Component)**

```tsx
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActivePlans } from "@/lib/billing/plans";
import SubscribeButton from "./subscribe-button";
import { Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");
  const user = await currentUser();
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier,subscription_status,subscription_ends_at")
    .eq("id", userId)
    .single();

  const plans = await getActivePlans();
  const currentPlan = profile?.plan_tier ?? "free";

  return (
    <main className="container py-8">
      <header className="mb-8">
        <h1 className="font-display text-4xl">Planos</h1>
        <p className="text-gray-2">Escolha o ritmo que você quer.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {plans.map(plan => (
          <article
            key={plan.slug}
            className={`rounded-lg border p-6 flex flex-col ${plan.slug === currentPlan ? "border-success bg-success/5" : "border-gray-4 bg-bg-1"}`}
          >
            <header className="mb-4">
              <h2 className="font-display text-2xl">{plan.name}</h2>
              <div className="mt-2">
                {plan.price_cents === 0 ? (
                  <span className="text-3xl font-display">Grátis</span>
                ) : (
                  <>
                    <span className="text-3xl font-display">R$ {(plan.price_cents / 100).toFixed(2).replace(".", ",")}</span>
                    <span className="text-sm text-gray-2">/mês</span>
                  </>
                )}
              </div>
              {plan.slug === currentPlan && (
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                  Plano atual
                </span>
              )}
            </header>

            <ul className="space-y-2 text-sm mb-4 flex-1">
              <FeatureItem on={!!plan.features.workouts}>Treinos completos</FeatureItem>
              <FeatureItem on={!!plan.features.diet}>Plano de dieta</FeatureItem>
              <FeatureItem on={!!plan.features.supplements}>Acompanhamento de suplementação</FeatureItem>
              <FeatureItem on={!!plan.features.juices}>Sucos da Kath</FeatureItem>
              <FeatureItem on={typeof plan.features.chat_sla_h === "number"}>
                {plan.features.chat_sla_h
                  ? `Chat com SLA de ${plan.features.chat_sla_h}h`
                  : "Chat com Kath/Sidney"}
              </FeatureItem>
              <FeatureItem on={!!plan.features.video_call_per_month}>Vídeo 1-1 mensal</FeatureItem>
              <FeatureItem on={true}>Cashback {plan.cashback_pct}%</FeatureItem>
              <FeatureItem on={true}>Desconto loja {plan.store_discount_pct}%</FeatureItem>
              <FeatureItem on={true}>Desconto estética {plan.estetica_discount_pct}%</FeatureItem>
            </ul>

            <SubscribeButton
              plan={plan}
              currentPlan={currentPlan}
              userName={user?.fullName ?? "Usuário"}
              userEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
            />
          </article>
        ))}
      </div>
    </main>
  );
}

function FeatureItem({ children, on }: { children: React.ReactNode; on: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${on ? "" : "opacity-40"}`}>
      {on ? <Check className="text-success size-4 mt-0.5" /> : <X className="text-gray-3 size-4 mt-0.5" />}
      <span>{children}</span>
    </li>
  );
}
```

- [ ] **Step 2: Atualizar `subscribe-button.tsx`**

Mudar a interface para receber `Plan` em vez de constantes hardcoded:

```tsx
"use client";
import { useState } from "react";
import type { Plan } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export default function SubscribeButton({
  plan,
  currentPlan,
  userName,
  userEmail,
}: {
  plan: Plan;
  currentPlan: PlanTier;
  userName: string;
  userEmail: string;
}) {
  // ... lógica existente, ajustada:
  // - desabilita se plan.slug === currentPlan
  // - desabilita downgrade (level menor que current)
  // - usa plan.asaas_value em texto, plan.slug no POST
}
```

(Manter a UI de PIX/QR/copy-payload existente.)

- [ ] **Step 3: Build + browser test**

```bash
npm run build
npm run dev
# Abrir http://localhost:3000/planos, ver 6 cards renderizados
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/planos/page.tsx src/app/(app)/planos/subscribe-button.tsx
git commit -m "feat(planos): page renderiza 6 tiers dinamicamente da plans table"
```

---

## Task 18: `/perfil` bloco wallet + cashback no checkout

**Files:**
- Create: `src/app/(app)/perfil/wallet-block.tsx`
- Create: `src/app/(app)/perfil/cashback/page.tsx`
- Create: `src/components/billing/cashback-input.tsx`
- Modify: `src/app/(app)/perfil/page.tsx`
- Modify: `src/app/(app)/loja/pedido/payment-panel.tsx`
- Modify: `src/app/(app)/kath-estetica/agendar/[serviceId]/booking-form.tsx`

- [ ] **Step 1: `wallet-block.tsx`**

```tsx
import Link from "next/link";
import { Wallet, Clock } from "lucide-react";

type Props = {
  activeCents: number;
  expiringSoonCents: number;
  expiringSoonAt: string | null;
};

export default function WalletBlock({ activeCents, expiringSoonCents, expiringSoonAt }: Props) {
  return (
    <section className="rounded-lg border border-gray-4 bg-bg-1 p-6">
      <header className="flex items-center gap-2 mb-3">
        <Wallet className="text-pink size-5" />
        <h2 className="font-display text-2xl">Carteira KathApp</h2>
      </header>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-2">Saldo ativo</p>
        <p className="font-display text-3xl text-pink">
          R$ {(activeCents / 100).toFixed(2).replace(".", ",")}
        </p>
      </div>

      {expiringSoonCents > 0 && expiringSoonAt && (
        <div className="flex items-center gap-2 text-sm text-warning rounded bg-warning/10 px-3 py-2 mb-3">
          <Clock className="size-4" />
          <span>
            R$ {(expiringSoonCents / 100).toFixed(2).replace(".", ",")} expira em {new Date(expiringSoonAt).toLocaleDateString("pt-BR")}
          </span>
        </div>
      )}

      <Link href="/perfil/cashback" className="text-sm text-pink hover:underline">
        Ver extrato →
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: `cashback/page.tsx` (extrato)**

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listWalletCreditsForUser, getWalletBalance } from "@/lib/billing/wallet";

export const dynamic = "force-dynamic";

export default async function CashbackPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const balance = await getWalletBalance(userId);
  const credits = await listWalletCreditsForUser(userId);

  return (
    <main className="container py-8">
      <header className="mb-6">
        <h1 className="font-display text-4xl">Extrato de cashback</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <Stat label="Ativo" value={balance.active_cents} accent />
        <Stat label="Ganho total" value={balance.earned_total_cents} />
        <Stat label="Gasto" value={balance.spent_total_cents} />
        <Stat label="Expirado" value={balance.expired_total_cents} />
      </div>

      <table className="w-full text-sm">
        <thead className="text-gray-2 text-left">
          <tr><th>Data</th><th>Tipo</th><th className="text-right">Valor</th><th>Validade</th></tr>
        </thead>
        <tbody>
          {credits.map(c => (
            <tr key={c.id} className="border-t border-gray-4">
              <td>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
              <td>{c.amount_cents > 0 ? "Crédito" : "Débito"}</td>
              <td className={`text-right ${c.amount_cents > 0 ? "text-success" : "text-pink"}`}>
                {c.amount_cents > 0 ? "+" : ""}R$ {(Math.abs(c.amount_cents) / 100).toFixed(2)}
              </td>
              <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded border border-gray-4 p-4 ${accent ? "bg-pink-dim" : "bg-bg-1"}`}>
      <p className="text-xs text-gray-2">{label}</p>
      <p className="font-display text-2xl">R$ {(value / 100).toFixed(2).replace(".", ",")}</p>
    </div>
  );
}
```

- [ ] **Step 3: `cashback-input.tsx` (componente reusável)**

```tsx
"use client";
import { useState } from "react";

type Props = {
  activeCents: number;
  grossCents: number;
  onChange: (cashbackCents: number) => void;
};

export default function CashbackInput({ activeCents, grossCents, onChange }: Props) {
  const max = Math.min(activeCents, Math.floor(grossCents * 0.5));
  const [used, setUsed] = useState(0);

  if (activeCents <= 0) return null;

  return (
    <div className="rounded border border-gray-4 bg-bg-1 p-3 space-y-2">
      <div className="flex justify-between text-sm">
        <span>Cashback disponível</span>
        <span className="text-pink">R$ {(activeCents / 100).toFixed(2)}</span>
      </div>
      <label className="block">
        <span className="text-xs text-gray-2">Aplicar (até R$ {(max / 100).toFixed(2)})</span>
        <input
          type="range"
          min={0}
          max={max}
          step={100}
          value={used}
          onChange={e => {
            const v = Number(e.target.value);
            setUsed(v);
            onChange(v);
          }}
          className="w-full"
        />
        <span className="text-sm">Você usará R$ {(used / 100).toFixed(2)}, paga R$ {((grossCents - used) / 100).toFixed(2)}</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Integrar `<WalletBlock>` em `/perfil/page.tsx`**

Após o bloco de plano atual, adicionar:

```tsx
import WalletBlock from "./wallet-block";
import { getWalletActiveCents } from "@/lib/billing/wallet";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

// dentro do component:
const adminSupabase = createAdminSupabaseClient();
const activeCents = await getWalletActiveCents(userId);
const { data: nextExp } = await adminSupabase
  .from("wallet_credits")
  .select("amount_cents,expires_at")
  .eq("user_id", userId)
  .is("used_at", null)
  .gt("expires_at", new Date().toISOString())
  .order("expires_at", { ascending: true })
  .limit(1)
  .maybeSingle();

// JSX:
<WalletBlock
  activeCents={activeCents}
  expiringSoonCents={nextExp?.amount_cents ?? 0}
  expiringSoonAt={nextExp?.expires_at ?? null}
/>
```

- [ ] **Step 5: Integrar `<CashbackInput>` em payment-panel + booking-form**

Em `payment-panel.tsx`:

```tsx
import CashbackInput from "@/components/billing/cashback-input";
const [cashbackCents, setCashbackCents] = useState(0);
// ... no JSX antes do botão de checkout:
<CashbackInput activeCents={activeCents} grossCents={total_pre_cashback} onChange={setCashbackCents} />
// ... no fetch:
body: JSON.stringify({ ...form, use_cashback_cents: cashbackCents })
```

Idem em `booking-form.tsx`.

- [ ] **Step 6: Build + browser test + commit**

```bash
npm run build
git add src/app/(app)/perfil src/components/billing/cashback-input.tsx src/app/(app)/loja/pedido/payment-panel.tsx src/app/(app)/kath-estetica/agendar/[serviceId]/booking-form.tsx
git commit -m "feat(perfil): wallet block + cashback input no checkout loja/estetica"
```

---

## Task 19: Chat refactor `is_from_kath` → `sender_role`

**Files:**
- Modify: `src/app/(app)/chat/chat-room.tsx`
- Modify: `src/app/admin/chat/admin-chat-inbox.tsx`
- Modify: `src/lib/supabase/types.ts` (manual override se necessário)

- [ ] **Step 1: Atualizar `chat-room.tsx`**

Substituir `msg.is_from_kath ? "..." : "..."` por:

```tsx
const isOutgoing = msg.sender_role === "user";
const senderName = msg.sender_role === "kath" ? "Kath" : msg.sender_role === "sidney" ? "Sidney" : "";
```

E render condicional usando `senderName` na bolha à esquerda quando não for `user`.

- [ ] **Step 2: Atualizar `admin-chat-inbox.tsx`**

Adicionar dropdown "Responder como":

```tsx
"use client";
const [senderRole, setSenderRole] = useState<"kath" | "sidney">("kath");
// ...
<select value={senderRole} onChange={e => setSenderRole(e.target.value as "kath" | "sidney")}>
  <option value="kath">Kath</option>
  <option value="sidney">Sidney</option>
</select>
// ... no insert da mensagem:
.insert({ user_id: targetUser, body, sender_role: senderRole })
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/app/(app)/chat/chat-room.tsx src/app/admin/chat/admin-chat-inbox.tsx
git commit -m "refactor(chat): sender_role substitui is_from_kath"
```

---

# Fase 7 — Painel admin financeiro

## Task 20: `/admin/financeiro` (4 tabs)

**Files:**
- Create: `src/app/admin/financeiro/page.tsx`
- Create: `src/app/admin/financeiro/comissoes/page.tsx`
- Create: `src/app/admin/financeiro/comissoes/commission-list.tsx`
- Create: `src/app/admin/financeiro/afiliado-externo/page.tsx`
- Create: `src/app/admin/financeiro/afiliado-externo/payout-form.tsx`
- Create: `src/app/admin/financeiro/actions.ts`
- Modify: `src/app/admin/layout.tsx` (adicionar link "Financeiro")

- [ ] **Step 1: `actions.ts` (server actions)**

```ts
"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { recordRevenueStream } from "@/lib/billing/revenue";
import { approveAllocations as approve, markAllocationsPaid as paid } from "@/lib/billing/commissions";
import { revalidatePath } from "next/cache";

export async function approveAllocations(ids: string[]) {
  await requireAdmin();
  const n = await approve(ids);
  revalidatePath("/admin/financeiro/comissoes");
  return n;
}

export async function markAllocationsPaid(formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("ids[]").map(String);
  const reference = String(formData.get("reference") ?? "");
  if (ids.length === 0 || !reference) return 0;
  const n = await paid(ids, reference);
  revalidatePath("/admin/financeiro/comissoes");
  return n;
}

const payoutSchema = z.object({
  platform: z.enum(["amazon","mercadolivre","shopee","direto"]),
  year_month: z.string().regex(/^\d{4}-\d{2}$/),
  amount_cents: z.coerce.number().int().min(1),
  fitness_pct: z.coerce.number().min(0).max(100),
  moto_pct: z.coerce.number().min(0).max(100),
  geral_pct: z.coerce.number().min(0).max(100),
});

export async function recordAffiliatePayout(formData: FormData) {
  await requireAdmin();
  const parsed = payoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("invalid_input");

  const { platform, year_month, amount_cents, fitness_pct, moto_pct, geral_pct } = parsed.data;
  if (Math.abs(fitness_pct + moto_pct + geral_pct - 100) > 0.01) {
    throw new Error("pct_must_sum_100");
  }

  const occurredAt = new Date(`${year_month}-15T12:00:00Z`).toISOString(); // meio do mês

  const slices = [
    { category: "fitness", pct: fitness_pct },
    { category: "moto",    pct: moto_pct },
    { category: "geral",   pct: geral_pct },
  ];
  for (const s of slices) {
    if (s.pct === 0) continue;
    const cents = Math.round(amount_cents * s.pct / 100);
    await recordRevenueStream({
      type: "afiliado_externo",
      category: s.category,
      user_id: null,
      reference_type: "affiliate_payout",
      reference_id: `${platform}-${year_month}-${s.category}`,
      asaas_payment_id: null,
      gross_cents: cents,
      cost_cents: 0,
      cashback_used_cents: 0,
      occurred_at: occurredAt,
    });
  }
  revalidatePath("/admin/financeiro/afiliado-externo");
}
```

- [ ] **Step 2: `financeiro/page.tsx` (visão geral)**

```tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: streams } = await supabase
    .from("revenue_streams")
    .select("type, gross_cents, net_cents, occurred_at")
    .gte("occurred_at", since30d)
    .eq("status", "confirmed");

  const byType = new Map<string, { gross: number; net: number; count: number }>();
  for (const s of streams ?? []) {
    const cur = byType.get(s.type) ?? { gross: 0, net: 0, count: 0 };
    cur.gross += s.gross_cents;
    cur.net   += s.net_cents;
    cur.count += 1;
    byType.set(s.type, cur);
  }

  const { data: walletAgg } = await supabase
    .from("wallet_balance")
    .select("active_cents,earned_total_cents,spent_total_cents,expired_total_cents");
  const wallet = (walletAgg ?? []).reduce((acc, w) => ({
    active: acc.active + w.active_cents,
    earned: acc.earned + w.earned_total_cents,
    spent: acc.spent + w.spent_total_cents,
    expired: acc.expired + w.expired_total_cents,
  }), { active: 0, earned: 0, spent: 0, expired: 0 });

  return (
    <main className="container py-6">
      <h1 className="font-display text-4xl mb-4">Financeiro</h1>
      <nav className="flex gap-3 mb-6 text-sm">
        <a href="/admin/financeiro" className="font-bold">Visão geral</a>
        <a href="/admin/financeiro/comissoes">Comissões</a>
        <a href="/admin/financeiro/afiliado-externo">Afiliados externos</a>
      </nav>

      <h2 className="font-display text-2xl mb-2">Receita últimos 30 dias</h2>
      <table className="w-full text-sm mb-8">
        <thead><tr className="text-left text-gray-2"><th>Origem</th><th className="text-right">Bruto</th><th className="text-right">Líquido</th><th className="text-right">#</th></tr></thead>
        <tbody>
          {Array.from(byType.entries()).map(([type, v]) => (
            <tr key={type} className="border-t border-gray-4">
              <td>{type}</td>
              <td className="text-right">R$ {(v.gross / 100).toFixed(2)}</td>
              <td className="text-right">R$ {(v.net / 100).toFixed(2)}</td>
              <td className="text-right">{v.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-display text-2xl mb-2">Carteira (passivo de cashback)</h2>
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Ativo (a usar)" value={wallet.active} />
        <Stat label="Ganho total" value={wallet.earned} />
        <Stat label="Gasto" value={wallet.spent} />
        <Stat label="Expirado" value={wallet.expired} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-4 p-4">
      <p className="text-xs text-gray-2">{label}</p>
      <p className="font-display text-xl">R$ {(value / 100).toFixed(2)}</p>
    </div>
  );
}
```

- [ ] **Step 3: `comissoes/page.tsx` + `commission-list.tsx`**

```tsx
// page.tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { listAllocations, pendingPayoutsByMember } from "@/lib/billing/commissions";
import CommissionList from "./commission-list";

export const dynamic = "force-dynamic";

export default async function ComissoesPage() {
  await requireAdmin();
  const draft = await listAllocations({ status: "draft" });
  const approved = await listAllocations({ status: "approved" });
  const payouts = await pendingPayoutsByMember();

  return (
    <main className="container py-6">
      <h1 className="font-display text-4xl mb-4">Comissões</h1>

      <h2 className="font-display text-2xl">A pagar (por sócio)</h2>
      <ul className="mb-8 mt-2">
        {payouts.map(p => (
          <li key={p.team_member_id} className="border-t border-gray-4 py-2 flex justify-between">
            <span>{p.name} <span className="text-gray-2 text-xs">({p.pix_key ?? "sem PIX"})</span></span>
            <span className="font-display">R$ {(p.total_cents / 100).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <CommissionList draftAllocations={draft} approvedAllocations={approved} />
    </main>
  );
}
```

```tsx
// commission-list.tsx (client)
"use client";
import { useState } from "react";
import { approveAllocations, markAllocationsPaid } from "../actions";

export default function CommissionList(props: {
  draftAllocations: Array<{ id: string; amount_cents: number; team_members: { full_name: string }; revenue_streams: { type: string; category: string | null } }>;
  approvedAllocations: typeof props.draftAllocations;
}) {
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());
  const [approvedSelected, setApprovedSelected] = useState<Set<string>>(new Set());

  return (
    <>
      <Section
        title="Pendentes (draft)"
        items={props.draftAllocations}
        selected={draftSelected}
        setSelected={setDraftSelected}
        actionLabel="Aprovar selecionados"
        onAction={async () => {
          const n = await approveAllocations(Array.from(draftSelected));
          alert(`${n} aprovadas`);
          location.reload();
        }}
      />
      <form action={markAllocationsPaid}>
        <Section
          title="Aprovadas (a pagar)"
          items={props.approvedAllocations}
          selected={approvedSelected}
          setSelected={setApprovedSelected}
        />
        {Array.from(approvedSelected).map(id => <input key={id} type="hidden" name="ids[]" value={id} />)}
        <input name="reference" placeholder="Referência do pagamento (ex: PIX 2026-05-15)" required className="border border-gray-4 px-2 py-1" />
        <button type="submit" className="ml-2 bg-pink text-white px-3 py-1 rounded">Marcar como pago</button>
      </form>
    </>
  );
}

function Section(props: {
  title: string;
  items: Array<{ id: string; amount_cents: number; team_members: { full_name: string }; revenue_streams: { type: string; category: string | null } }>;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="mb-6">
      <h2 className="font-display text-2xl mb-2">{props.title}</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-2"><tr><th></th><th>Sócio</th><th>Origem</th><th className="text-right">Valor</th></tr></thead>
        <tbody>
          {props.items.map(a => (
            <tr key={a.id} className="border-t border-gray-4">
              <td>
                <input
                  type="checkbox"
                  checked={props.selected.has(a.id)}
                  onChange={e => {
                    const next = new Set(props.selected);
                    if (e.target.checked) next.add(a.id); else next.delete(a.id);
                    props.setSelected(next);
                  }}
                />
              </td>
              <td>{a.team_members.full_name}</td>
              <td>{a.revenue_streams.type}{a.revenue_streams.category ? ` / ${a.revenue_streams.category}` : ""}</td>
              <td className="text-right">R$ {(a.amount_cents / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.actionLabel && (
        <button onClick={props.onAction} className="mt-2 px-3 py-1 bg-pink text-white rounded text-sm">
          {props.actionLabel}
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 4: `afiliado-externo/page.tsx` + form**

```tsx
// page.tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import PayoutForm from "./payout-form";

export const dynamic = "force-dynamic";

export default async function AfiliadoExternoPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: history } = await supabase
    .from("revenue_streams")
    .select("reference_id,gross_cents,occurred_at,category")
    .eq("type", "afiliado_externo")
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (
    <main className="container py-6">
      <h1 className="font-display text-4xl mb-4">Afiliados externos</h1>
      <PayoutForm />
      <h2 className="font-display text-2xl mt-8">Histórico</h2>
      <table className="w-full text-sm mt-2">
        <thead><tr className="text-gray-2 text-left"><th>Quando</th><th>Referência</th><th>Categoria</th><th className="text-right">Valor</th></tr></thead>
        <tbody>
          {(history ?? []).map(r => (
            <tr key={r.reference_id} className="border-t border-gray-4">
              <td>{new Date(r.occurred_at).toLocaleDateString("pt-BR")}</td>
              <td>{r.reference_id}</td>
              <td>{r.category}</td>
              <td className="text-right">R$ {(r.gross_cents / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

```tsx
// payout-form.tsx (client)
"use client";
import { recordAffiliatePayout } from "../actions";

export default function PayoutForm() {
  return (
    <form action={recordAffiliatePayout} className="grid gap-3 max-w-md">
      <select name="platform" className="border border-gray-4 px-2 py-1 bg-bg-1">
        <option value="amazon">Amazon</option>
        <option value="mercadolivre">Mercado Livre</option>
        <option value="shopee">Shopee</option>
        <option value="direto">Direto</option>
      </select>
      <input name="year_month" placeholder="2026-04" required pattern="\d{4}-\d{2}" className="border border-gray-4 px-2 py-1" />
      <input name="amount_cents" type="number" min={1} placeholder="Valor em centavos (ex: 420000)" required className="border border-gray-4 px-2 py-1" />
      <div className="grid grid-cols-3 gap-2">
        <input name="fitness_pct" type="number" step={0.01} placeholder="Fitness %" required className="border border-gray-4 px-2 py-1" />
        <input name="moto_pct" type="number" step={0.01} placeholder="Moto %" required className="border border-gray-4 px-2 py-1" />
        <input name="geral_pct" type="number" step={0.01} placeholder="Geral %" required className="border border-gray-4 px-2 py-1" />
      </div>
      <button type="submit" className="bg-pink text-white py-2 rounded">Registrar</button>
    </form>
  );
}
```

- [ ] **Step 5: Adicionar link "Financeiro" no admin layout**

Em `src/app/admin/layout.tsx`, adicionar item de nav.

- [ ] **Step 6: Build + browser test + commit**

```bash
npm run build
git add src/app/admin/financeiro src/app/admin/layout.tsx
git commit -m "feat(admin): /admin/financeiro com receita/comissões/afiliados externos"
```

---

## Task 21: `/admin/team` + `/admin/team/regras`

**Files:**
- Create: `src/app/admin/team/page.tsx`
- Create: `src/app/admin/team/team-form.tsx`
- Create: `src/app/admin/team/regras/page.tsx`
- Create: `src/app/admin/team/regras/rules-form.tsx`
- Create: `src/app/admin/team/actions.ts`

- [ ] **Step 1: `actions.ts`**

```ts
"use server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const memberSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["owner","partner","consultant"]),
  pix_key: z.string().nullable().optional(),
  is_active: z.coerce.boolean().default(true),
});

export async function upsertTeamMember(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("invalid_input");
  const supabase = createAdminSupabaseClient();
  if (id) {
    await supabase.from("team_members").update(parsed.data).eq("id", String(id));
  } else {
    await supabase.from("team_members").insert(parsed.data);
  }
  revalidatePath("/admin/team");
}

const ruleSchema = z.object({
  team_member_id: z.string().uuid(),
  applies_to_type: z.enum(["mensalidade","loja","estetica","afiliado_externo"]).nullable().optional(),
  applies_to_category: z.string().nullable().optional(),
  pct: z.coerce.number().min(0).max(100),
  is_active: z.coerce.boolean().default(true),
});

export async function upsertCommissionRule(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("invalid_input");
  const supabase = createAdminSupabaseClient();
  if (id) {
    await supabase.from("commission_rules").update(parsed.data).eq("id", String(id));
  } else {
    await supabase.from("commission_rules").insert(parsed.data);
  }
  revalidatePath("/admin/team/regras");
}

export async function deleteCommissionRule(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  await supabase.from("commission_rules").update({ is_active: false }).eq("id", id);
  revalidatePath("/admin/team/regras");
}
```

- [ ] **Step 2: `team/page.tsx` + `team-form.tsx`**

`page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import TeamForm from "./team-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: members } = await supabase.from("team_members").select("*").order("created_at");
  return (
    <main className="container py-6">
      <h1 className="font-display text-4xl mb-4">Equipe</h1>
      <a href="/admin/team/regras" className="text-pink underline">Regras de comissão →</a>
      <table className="w-full text-sm mt-4">
        <thead><tr className="text-left text-gray-2"><th>Nome</th><th>Email</th><th>Role</th><th>PIX</th><th>Ativo</th></tr></thead>
        <tbody>
          {(members ?? []).map(m => (
            <tr key={m.id} className="border-t border-gray-4">
              <td>{m.full_name}</td>
              <td>{m.email}</td>
              <td>{m.role}</td>
              <td>{m.pix_key ?? "—"}</td>
              <td>{m.is_active ? "✓" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-display text-2xl mt-8 mb-2">Adicionar / editar</h2>
      <TeamForm />
    </main>
  );
}
```

`team-form.tsx`:

```tsx
"use client";
import { upsertTeamMember } from "./actions";
export default function TeamForm() {
  return (
    <form action={upsertTeamMember} className="grid gap-2 max-w-md">
      <input name="full_name" placeholder="Nome completo" required className="border border-gray-4 px-2 py-1" />
      <input name="email" type="email" placeholder="email" required className="border border-gray-4 px-2 py-1" />
      <select name="role" required className="border border-gray-4 px-2 py-1 bg-bg-1">
        <option value="partner">Partner</option>
        <option value="consultant">Consultant</option>
        <option value="owner">Owner</option>
      </select>
      <input name="pix_key" placeholder="Chave PIX" className="border border-gray-4 px-2 py-1" />
      <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked /> Ativo</label>
      <button type="submit" className="bg-pink text-white py-2 rounded">Salvar</button>
    </form>
  );
}
```

- [ ] **Step 3: `team/regras/page.tsx` + `rules-form.tsx`**

`page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import RulesForm from "./rules-form";

export const dynamic = "force-dynamic";

export default async function RegrasPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: rules } = await supabase
    .from("commission_rules")
    .select("*, team_members(full_name)")
    .eq("is_active", true)
    .order("applies_to_type", { ascending: true });
  const { data: members } = await supabase.from("team_members").select("id,full_name").eq("is_active", true);

  return (
    <main className="container py-6">
      <h1 className="font-display text-4xl mb-4">Regras de comissão</h1>
      <table className="w-full text-sm mb-6">
        <thead><tr className="text-left text-gray-2"><th>Sócio</th><th>Tipo</th><th>Categoria</th><th>%</th></tr></thead>
        <tbody>
          {(rules ?? []).map(r => (
            <tr key={r.id} className="border-t border-gray-4">
              <td>{(r as unknown as { team_members: { full_name: string } }).team_members.full_name}</td>
              <td>{r.applies_to_type ?? "qualquer"}</td>
              <td>{r.applies_to_category ?? "qualquer"}</td>
              <td>{r.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <RulesForm members={members ?? []} />
    </main>
  );
}
```

`rules-form.tsx`:

```tsx
"use client";
import { upsertCommissionRule } from "../actions";

export default function RulesForm({ members }: { members: { id: string; full_name: string }[] }) {
  return (
    <form action={upsertCommissionRule} className="grid gap-2 max-w-md">
      <select name="team_member_id" required className="border border-gray-4 px-2 py-1 bg-bg-1">
        {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
      </select>
      <select name="applies_to_type" className="border border-gray-4 px-2 py-1 bg-bg-1">
        <option value="">qualquer</option>
        <option value="mensalidade">mensalidade</option>
        <option value="loja">loja</option>
        <option value="estetica">estetica</option>
        <option value="afiliado_externo">afiliado_externo</option>
      </select>
      <input name="applies_to_category" placeholder="Categoria (opcional, ex: plano3, fitness)" className="border border-gray-4 px-2 py-1" />
      <input name="pct" type="number" step={0.01} min={0} max={100} placeholder="%" required className="border border-gray-4 px-2 py-1" />
      <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked /> Ativa</label>
      <button type="submit" className="bg-pink text-white py-2 rounded">Salvar regra</button>
    </form>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/admin/team
git commit -m "feat(admin): /admin/team CRUD + /admin/team/regras"
```

---

## Task 22: `/admin/plans` editor

**Files:**
- Create: `src/app/admin/plans/page.tsx`
- Create: `src/app/admin/plans/plan-form.tsx`
- Create: `src/app/admin/plans/actions.ts`

- [ ] **Step 1: `actions.ts`**

```ts
"use server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { _resetPlanCache } from "@/lib/billing/plans";
import { revalidatePath } from "next/cache";

const planUpdateSchema = z.object({
  slug: z.enum(["free","acesso","plano1","plano2","plano3","atleta"]),
  name: z.string().min(1),
  price_cents: z.coerce.number().int().min(0),
  asaas_value: z.coerce.number().min(0),
  asaas_description: z.string().min(1),
  cashback_pct: z.coerce.number().min(0).max(100),
  store_discount_pct: z.coerce.number().int().min(0).max(100),
  estetica_discount_pct: z.coerce.number().int().min(0).max(100),
  features_json: z.string().refine(s => { try { JSON.parse(s); return true; } catch { return false; } }, "JSON inválido"),
  is_active: z.coerce.boolean().default(true),
});

export async function updatePlan(formData: FormData) {
  await requireAdmin();
  const parsed = planUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors.join(", "));
  const features = JSON.parse(parsed.data.features_json);

  const supabase = createAdminSupabaseClient();
  await supabase.from("plans").update({
    name: parsed.data.name,
    price_cents: parsed.data.price_cents,
    asaas_value: parsed.data.asaas_value,
    asaas_description: parsed.data.asaas_description,
    cashback_pct: parsed.data.cashback_pct,
    store_discount_pct: parsed.data.store_discount_pct,
    estetica_discount_pct: parsed.data.estetica_discount_pct,
    features,
    is_active: parsed.data.is_active,
    updated_at: new Date().toISOString(),
  }).eq("slug", parsed.data.slug);

  _resetPlanCache();
  revalidatePath("/admin/plans");
  revalidatePath("/planos");
}
```

- [ ] **Step 2: `page.tsx`**

```tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { getAllPlans } from "@/lib/billing/plans";
import PlanForm from "./plan-form";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireAdmin();
  const plans = await getAllPlans();
  return (
    <main className="container py-6">
      <h1 className="font-display text-4xl mb-4">Planos</h1>
      <p className="text-sm text-gray-2 mb-6">
        Aviso: mudanças de preço não afetam assinantes existentes (Asaas mantém valor da subscription).
      </p>
      <div className="grid gap-6">
        {plans.map(p => (
          <details key={p.slug} className="border border-gray-4 p-4 rounded">
            <summary className="cursor-pointer font-display text-2xl">{p.name} <span className="text-gray-2 text-sm">({p.slug})</span></summary>
            <PlanForm plan={p} />
          </details>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: `plan-form.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { Plan } from "@/lib/billing/plans";
import { updatePlan } from "./actions";

export default function PlanForm({ plan }: { plan: Plan }) {
  const [features, setFeatures] = useState(JSON.stringify(plan.features, null, 2));
  return (
    <form action={updatePlan} className="grid gap-3 mt-4">
      <input type="hidden" name="slug" value={plan.slug} />
      <label>Nome <input name="name" defaultValue={plan.name} required className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
      <label>Preço (centavos) <input name="price_cents" type="number" min={0} defaultValue={plan.price_cents} required className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
      <label>Valor Asaas (R$) <input name="asaas_value" type="number" step={0.01} min={0} defaultValue={plan.asaas_value} required className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
      <label>Descrição Asaas <input name="asaas_description" defaultValue={plan.asaas_description} required className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label>Cashback % <input name="cashback_pct" type="number" step={0.01} defaultValue={plan.cashback_pct} className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
        <label>Loja % <input name="store_discount_pct" type="number" defaultValue={plan.store_discount_pct} className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
        <label>Estética % <input name="estetica_discount_pct" type="number" defaultValue={plan.estetica_discount_pct} className="block w-full border border-gray-4 px-2 py-1 mt-1" /></label>
      </div>
      <label>Features (JSON)
        <textarea name="features_json" rows={6} value={features} onChange={e => setFeatures(e.target.value)} className="block w-full border border-gray-4 px-2 py-1 mt-1 font-mono text-xs" />
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={plan.is_active} /> Ativo</label>
      <button type="submit" className="bg-pink text-white py-2 rounded self-start px-4">Salvar</button>
    </form>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/admin/plans
git commit -m "feat(admin): /admin/plans editor de tiers admin-editável"
```

---

# Fase 8 — Smoke test e wiki

## Task 23: Smoke test + atualizar wiki

**Files:**
- Modify: `docs/wiki/dominio/perfil-onboarding-planos.md`
- Modify: `docs/wiki/dominio/loja.md`
- Modify: `docs/wiki/dominio/kath-estetica.md`
- Modify: `docs/wiki/dominio/chat.md`
- Modify: `docs/wiki/plataforma/pagamentos-asaas.md`
- Create: `docs/wiki/plataforma/financeiro.md`

- [ ] **Step 1: Smoke test em sandbox**

Para cada um dos 5 planos pagos (acesso, plano1, plano2, plano3, atleta):

1. No painel Asaas Sandbox, criar pagamento test com `value=plan.asaas_value`, `externalReference=user_test_<slug>`.
2. Disparar evento `PAYMENT_CONFIRMED` manualmente.
3. Conferir:
   ```sql
   select * from public.revenue_streams where reference_id = 'user_test_<slug>';
   -- gross_cents = price_cents do plano, type='mensalidade', category=<slug>
   select * from public.commission_allocations where revenue_stream_id = (
     select id from public.revenue_streams where reference_id = 'user_test_<slug>'
   );
   -- 2 ou 3 linhas (Russo + Sidney se aplicável + Kath residual)
   select active_cents from public.wallet_balance where user_id = 'user_test_<slug>';
   -- = round(price_cents * cashback_pct / 100)
   ```
4. Idem para uma compra de loja simulada (PAYMENT_CONFIRMED com externalReference=loja:<orderId>).
5. Idem estética (externalReference=estetica:<bookingId>).

- [ ] **Step 2: Atualizar wiki — `perfil-onboarding-planos.md`**

Substituir seção de planos por descrição dos 6 tiers + tabela `plans` admin-editável + mecânica de gating cumulativo + cashback.

- [ ] **Step 3: Criar `plataforma/financeiro.md`**

Cobrir:
- Fluxo de receita unificada (`revenue_streams`)
- Modelo de comissões (regras explícitas + owner residual)
- Wallet (cashback, FIFO, expiração)
- Crons (`wallet-expire`, `order-timeout`)
- Painel `/admin/financeiro`
- Como Kath registra receita de afiliados externos

- [ ] **Step 4: Atualizar `loja.md`, `kath-estetica.md`, `chat.md`, `pagamentos-asaas.md`**

- `loja.md`: mencionar `cost_cents`, desconto via `plans`, cashback no checkout, action `markOrderDelivered`.
- `kath-estetica.md`: mencionar `cost_cents`, `requires_paid_plan`, cashback, action `markBookingDone`.
- `chat.md`: chat agora é Plano 3+, `sender_role` enum.
- `pagamentos-asaas.md`: webhook integra `revenue_streams`, mapeamento `externalReference`, criação automática de consultoria por tier.

- [ ] **Step 5: Atualizar `docs/audit/2026-05-01-cto-audit.md`**

Marcar como "implementados" os achados que foram resolvidos:
- BIZ-01 (receita unificada): ✅
- BIZ-02 (comissões): ✅
- DB-03 (price_cents inconsistente): ✅ (validations.ts agora usa price_cents)
- BE-01 (estoque atômico): parcial (RPC `decrement_stock_batch` criada)
- FE-04 (push hook órfão): pendente — Spec C
- ...

- [ ] **Step 6: Commit final**

```bash
git add docs/wiki docs/audit
git commit -m "docs: atualizar wiki + audit refletindo modelo financeiro implementado"
```

- [ ] **Step 7: Tag de release**

```bash
git tag -a v1.0.0-financeiro -m "Modelo financeiro completo: 6 tiers + cashback + comissões"
```

---

## Verificações finais antes de fechar a feature

- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — zero erros
- [ ] `npm run test` — todos os testes verdes
- [ ] Todas as 23 tasks fechadas com commit
- [ ] Smoke test em sandbox passou para os 5 planos pagos
- [ ] Smoke test em sandbox passou para 1 compra de loja com cashback
- [ ] Smoke test em sandbox passou para 1 booking estética com cashback
- [ ] `/admin/financeiro` mostra todas as receitas e comissões
- [ ] `/admin/plans` permite editar e a UI `/planos` reflete em até 60s
- [ ] Wiki atualizado em todos os módulos afetados

## Self-review (executado pelo planejador)

**1. Spec coverage:**
- §3.1 tiers → Tasks 1, 4, 17 ✅
- §3.2 matriz benefícios → Task 17 (UI) + Tasks 12-13 (gating) ✅
- §3.3 cashback regras → Tasks 6, 12, 13, 14, 16, 18 ✅
- §3.4 splits → Tasks 1, 3, 7 ✅
- §3.5 CMV → Tasks 3, 15 ✅
- §3.6 afiliados externos → Task 20 ✅
- §4 vocabulário → Tasks 3, 4, 9, 10, 11 ✅
- §5 modelo de dados → Tasks 1, 2, 3 ✅
- §6 fluxos → Tasks 10, 12, 13, 14, 16, 20 ✅
- §7 seeds → Tasks 1, 3 ✅
- §8 refactor de código → Tasks 5-19 ✅
- §9 UI → Tasks 17, 18, 20-22 ✅
- §10 edge cases → cobertos em Tasks 12-14, 16 ✅
- §11 testes → Tasks 5-8 (TDD) ✅
- §12 plano migração → Tasks 1-4 ✅

**2. Placeholder scan:** sem TBDs/TODOs.

**3. Type consistency:**
- `Plan.slug` é `PlanTier` (consistente Tasks 5+).
- `RecordRevenueInput.user_id` é `string | null` (Task 8) e usa-se isso no webhook (Task 10) ✅.
- `markOrderDelivered` retorna void (Task 14); UI form não aguarda valor de retorno ✅.
- `WalletBalance` — chaves matching entre Task 6 (definição) e Task 18 (uso) ✅.

Não detectei gaps. Plano vai para handoff.
