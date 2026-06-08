# Spec — Modelo Financeiro KathApp (planos + cashback + comissões)

**Data:** 2026-05-02
**Status:** aprovado para implementação
**Escopo:** Spec A do brainstorming 2026-05-02. Specs B (operação Kath Estética) e C (engajamento/notificações) virão em arquivos separados.

## 1. Contexto

KathApp está em pré-lançamento (zero assinantes pagos, domínio não configurado). O modelo de planos atual é `free / start / pro / vip` com preços hardcoded em `lib/asaas/config.ts` (R$ 0/19/39/99) e descontos em colunas `discount_start/pro/vip` em `products` e `estetica_services`. Não existem tabelas de receita unificada nem comissões para a equipe.

A reformulação tem 4 frentes que precisam ir juntas porque mexem nos mesmos pontos:

1. **Substituir o enum `plan_tier`** por uma família de 6 slugs novos com preços diferentes.
2. **Centralizar configuração de planos** numa tabela `plans` (admin-editável).
3. **Implementar receita unificada** (`revenue_streams`) com splits para Russo, Sidney e Kath.
4. **Implementar cashback** (wallet interno gasto em loja + estética).

Todas as decisões abaixo foram fechadas durante brainstorming com o owner em 2026-05-02. Detalhes da auditoria geral do projeto em `docs/audit/2026-05-01-cto-audit.md`.

## 2. Não-objetivos

Fora do escopo deste spec (ficam para specs B/C ou outros):

- Operação física da estética (check-in rápido, voz→texto, fila walk-in, fotos de execução).
- Notificações motivacionais (vibração, lembretes de hidratação/alimentação personalizados por plano).
- Ajustes na UI da landing pública.
- Integração com gateway de payout automático para sócios (admin marca como `paid` manualmente nesta primeira versão; transferência via Asaas Transfer API fica para spec separado).
- Relatórios contábeis exportáveis (DRE, conciliação) — admin tem dashboard, exportação CSV vem depois.
- Suporte a downgrade voluntário (a UI atual diz "em breve"; mantém assim).

## 3. Decisões de produto (brainstorming 2026-05-02)

### 3.1 Tiers de plano

| `plan_tier` slug | Nome exibido | `level` | Preço | Foco |
|------------------|--------------|:-------:|------:|------|
| `free` | Free | 0 | — | Vitrine reduzida (3 vídeos preview, 5 cupons populares, 3 clicks afiliado/mês, agendar lavagem simples, calculadora liberada) |
| `acesso` | Acesso | 1 | R$ 19,90 | Cupons + afiliados + estética de motos (sem treino) |
| `plano1` | Plano 1 — Treino | 2 | R$ 39,90 | + treinos completos |
| `plano2` | Plano 2 — Treino + Dieta | 3 | R$ 74,90 | + dieta personalizada |
| `plano3` | Plano 3 — Saúde Completa | 4 | R$ 99,90 | + suplementação/manipulados/acompanhamento (chat 48h SLA, reavaliação mensal) |
| `atleta` | Atleta | 5 | R$ 309,90 | + sucos, chat 12h SLA, vídeo 1-1 mensal, reavaliação quinzenal |

Gating é cumulativo: cada tier herda os direitos dos anteriores.

### 3.2 Matriz de benefícios

| Benefício | free | acesso | plano1 | plano2 | plano3 | atleta |
|-----------|:----:|:------:|:------:|:------:|:------:|:------:|
| Treinos | 3 preview | 3 preview | ✅ | ✅ | ✅ | ✅ |
| Plano de dieta | — | — | — | ✅ | ✅ | ✅ |
| Acompanhamento de suplementação/manipulados | — | — | — | — | ✅ | ✅ |
| Acompanhamento de sucos | — | — | — | — | — | ✅ |
| Chat com Kath/Sidney | — | — | — | — | 48h SLA | 12h SLA prioritário |
| Reavaliação | — | — | — | — | Mensal | Quinzenal |
| Vídeo 1-1 | — | — | — | — | — | 1×/mês 45min |
| Cupons de parceiros | 5 públicos | gating por cupom | gating por cupom | gating por cupom | gating por cupom | todos |
| Clicks de afiliado | 3/mês | ilimitado | ilimitado | ilimitado | ilimitado | ilimitado |
| Agendar lavagem detalhada / vitrificação | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agendar lavagem simples (walk-in) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Desconto na loja | 0% | 5% | 8% | 12% | 18% | 25% |
| Desconto na estética | 0% | 5% | 7% | 10% | 12% | 15% |
| Cashback | 0% | 2% | 3% | 5% | 7% | 10% |

Os percentuais são *defaults*; admin pode sobrescrever na tabela `plans`.

### 3.3 Cashback

- Validade: 120 dias por crédito.
- Uso: loja + estética **apenas**. Sem mensalidade, sem saque, sem transferência entre users.
- Limite por transação: até 50% do valor da compra em cashback.
- Não gera cashback sobre cashback (apenas sobre `amount_paid_cash_cents`).
- Crédito ativado **após consolidação**:
  - loja: +7 dias da entrega (ou ao mudar `orders.status` para `delivered`)
  - estética: ao concluir serviço (`estetica_bookings.status = 'done'`)
  - mensalidade: imediato após `PAYMENT_CONFIRMED`
- Estorno: reverte cashback se ainda não foi usado; trava se foi gasto.
- Aviso push 7 dias antes da expiração.
- Limite mensal de acúmulo: R$ 500 (configurável).
- **Quem absorve:** Kath sozinha. Russo/Sidney recebem split sobre o líquido nominal; o cashback gasto reduz só a fatia da Kath.

### 3.4 Splits de comissão

```
Russo: 25% de TUDO (sobre líquido).
Sidney: 30% só de mensalidades de plano1, plano2, plano3, atleta.
Kath: o que sobra (e absorve sozinha o cashback queimado).
```

Tabela completa em [§7.3](#73-seed-de-commission_rules).

### 3.5 Splits sobre líquido (CMV)

- `products.cost_cents` é o custo do fornecedor. Líquido = `gross − cost`.
- `estetica_services.cost_cents` é o custo médio de insumos por execução. Kath absorve sozinha (não rateia com Russo): no `revenue_streams` da estética, `cost_cents` é descontado normalmente, e Russo recebe 25% sobre `net_cents`. Como a Kath é dona da operação, fica claro que ela é quem comprou os insumos.
- Mensalidades têm `cost_cents = 0` (acompanhamento puro).
- Afiliados externos têm `cost_cents = 0` (receita líquida 100%).

### 3.6 Afiliados externos

Receita chega agregada da Amazon/ML/Shopee no fim do mês — sem visibilidade por user. Admin lança no painel: "Recebi R$ X da plataforma Y em YYYY-MM". Sistema cria um único `revenue_streams` com `type = 'afiliado_externo'`, `category = 'fitness'|'moto'|'geral'`, sliced por proporção de `affiliate_links.clicks_count` daquele mês por módulo. Sidney não participa (split = Russo 25 / Kath 75 em qualquer slice).

## 4. Mudanças no vocabulário canônico

Atualização que cascateia em código + DB:

| Arquivo / objeto | Mudança |
|------------------|---------|
| `profiles.plan_tier` CHECK | `('free','acesso','plano1','plano2','plano3','atleta')` |
| `workout_videos.required_plan` CHECK | idem |
| `affiliate_links.required_plan` CHECK | idem |
| `coupons.required_plan` CHECK | idem |
| `moto_events.required_plan` CHECK | idem |
| `lib/validations.ts:4` `planTierSchema` | `z.enum(['free','acesso','plano1','plano2','plano3','atleta'])` |
| `lib/supabase/types.ts:10` `PlanTier` | tipo unificado com 6 slugs |
| `lib/asaas/config.ts` | Remover `PLAN_PRICES`, `PLAN_DESCRIPTIONS`, `PLAN_HIERARCHY`. Toda configuração vai para tabela `plans` |
| `lib/asaas/webhook.ts:52` `planTierFromValue` | Lookup em `plans` por `asaas_value` mais próximo (≤) |
| `lib/asaas/checkout.ts` `processCheckout` | Recebe `plan: PlanTier`, lê `asaas_value` e `asaas_description` da tabela |
| `app/(app)/planos/page.tsx` | Render dinâmico via `plans` table; remover const `plans` hardcoded |
| `messages` RLS policy `messages_insert_vip` | Renomear para `messages_insert_chat`; aceitar `plan_tier IN ('plano3','atleta')` |
| `messages.is_from_kath` | Substituir por `messages.sender_role` enum `('user','kath','sidney','admin')`. Não há dados em produção, então drop+create direto |
| `consultations.package_type` | Mantido. Webhook cria consultoria automática para `plano2/plano3` com `package_type='mensal'`, e para `atleta` com `package_type='premium'`. `acesso` e `plano1` não criam |
| `products.discount_start/pro/vip` | Drop. Desconto vem de `plans.store_discount_pct` em runtime |
| `estetica_services.discount_start/pro/vip` | Drop. Desconto vem de `plans.estetica_discount_pct` |
| `products.cost_cents` | Add (CMV) |
| `estetica_services.cost_cents` | Add |
| `estetica_services.requires_paid_plan` | Add (boolean; lavagem simples = false; vitrificação/detalhada = true) |
| `workout_videos.is_free_preview` | Add |
| `coupons.is_public_preview` | Add |

## 5. Modelo de dados

### 5.1 Tabela `plans`

Centraliza configuração admin-editável.

```sql
create table public.plans (
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

create policy plans_select_authenticated on public.plans
  for select to authenticated using (is_active = true);

create policy plans_admin on public.plans
  for all to service_role using (true) with check (true);

create index idx_plans_level on public.plans(level);
```

`features` é um JSONB de capacidades booleanas usado pela UI para render de matriz e por features específicas em código:

```ts
type PlanFeatures = {
  workouts_preview?: number;            // limite de vídeos free preview
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
```

### 5.2 Tabela `revenue_streams`

Receita unificada. Toda transação confirmada gera uma linha.

```sql
create table public.revenue_streams (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null
                      check (type in ('mensalidade','loja','estetica','afiliado_externo')),
  category            text,                                          -- plan slug, module, etc
  user_id             text references public.profiles(id),           -- null em afiliado_externo
  reference_type      text not null
                      check (reference_type in ('subscription','order','booking','affiliate_payout')),
  reference_id        text not null,
  asaas_payment_id    text,
  gross_cents         int  not null check (gross_cents >= 0),
  cost_cents          int  not null default 0 check (cost_cents >= 0),
  net_cents           int  generated always as (gross_cents - cost_cents) stored,
  cashback_used_cents int  not null default 0 check (cashback_used_cents >= 0),
  status              text not null default 'confirmed'
                      check (status in ('pending','confirmed','refunded')),
  occurred_at         timestamptz not null,
  created_at          timestamptz not null default now()
);

alter table public.revenue_streams enable row level security;

create policy revenue_streams_admin on public.revenue_streams
  for all to service_role using (true) with check (true);

create index idx_revenue_streams_type on public.revenue_streams(type, occurred_at desc);
create index idx_revenue_streams_user on public.revenue_streams(user_id, occurred_at desc);
create index idx_revenue_streams_status on public.revenue_streams(status);
create index idx_revenue_streams_asaas on public.revenue_streams(asaas_payment_id)
  where asaas_payment_id is not null;
```

### 5.3 Tabela `team_members`

```sql
create table public.team_members (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text unique,                       -- opcional: vincula com Clerk se sócio loga no app
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

create policy team_members_admin on public.team_members
  for all to service_role using (true) with check (true);
```

### 5.4 Tabela `commission_rules`

Define quem leva quanto, com vigência por janela de tempo.

```sql
create table public.commission_rules (
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

create policy commission_rules_admin on public.commission_rules
  for all to service_role using (true) with check (true);

create index idx_commission_rules_lookup
  on public.commission_rules(applies_to_type, applies_to_category, is_active);
```

`applies_to_type = NULL` significa "qualquer tipo". `applies_to_category = NULL` significa "qualquer categoria daquele tipo". Permite regras gerais (Russo 25% sempre) e específicas (Sidney 30% só em mensalidades dos planos 1-4) sem conflito — a regra mais específica vence.

### 5.5 Tabela `commission_allocations`

Materialização do cálculo. Uma linha por `(revenue_stream, team_member)` elegível.

```sql
create table public.commission_allocations (
  id                  uuid primary key default gen_random_uuid(),
  revenue_stream_id   uuid not null references public.revenue_streams(id) on delete cascade,
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

create policy commission_allocations_admin on public.commission_allocations
  for all to service_role using (true) with check (true);

create index idx_commission_alloc_member
  on public.commission_allocations(team_member_id, status);
create unique index uniq_alloc_per_stream_member
  on public.commission_allocations(revenue_stream_id, team_member_id);
```

### 5.6 Tabelas de wallet (cashback)

```sql
create table public.wallet_credits (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     text not null references public.profiles(id) on delete cascade,
  source_revenue_stream_id    uuid references public.revenue_streams(id),       -- de onde veio
  spent_on_revenue_stream_id  uuid references public.revenue_streams(id),       -- onde foi gasto
  amount_cents                int  not null,                                    -- positivo = crédito; negativo = débito
  expires_at                  timestamptz,                                      -- só para créditos
  used_at                     timestamptz,                                      -- consumo (FIFO)
  created_at                  timestamptz not null default now(),
  check ((amount_cents > 0 and expires_at is not null and spent_on_revenue_stream_id is null)
      or (amount_cents < 0 and used_at is not null and source_revenue_stream_id is null))
);

alter table public.wallet_credits enable row level security;

create policy wallet_credits_select_own on public.wallet_credits
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy wallet_credits_admin on public.wallet_credits
  for all to service_role using (true) with check (true);

create index idx_wallet_credits_user_active
  on public.wallet_credits(user_id, expires_at)
  where used_at is null;

create table public.wallet_balance (
  user_id              text primary key references public.profiles(id) on delete cascade,
  active_cents         int not null default 0,
  earned_total_cents   int not null default 0,
  spent_total_cents    int not null default 0,
  expired_total_cents  int not null default 0,
  updated_at           timestamptz not null default now()
);

alter table public.wallet_balance enable row level security;

create policy wallet_balance_select_own on public.wallet_balance
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy wallet_balance_admin on public.wallet_balance
  for all to service_role using (true) with check (true);
```

### 5.7 Tabela `monthly_usage`

Tracking de uso do FREE (3 clicks afiliado/mês). Implícito: chave `(user_id, year_month)` cria linha conforme o mês avança; mês novo = linha nova.

```sql
create table public.monthly_usage (
  user_id                 text not null references public.profiles(id) on delete cascade,
  year_month              text not null check (year_month ~ '^\d{4}-\d{2}$'),
  affiliate_clicks_count  int  not null default 0,
  primary key (user_id, year_month)
);

alter table public.monthly_usage enable row level security;

create policy monthly_usage_select_own on public.monthly_usage
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy monthly_usage_admin on public.monthly_usage
  for all to service_role using (true) with check (true);
```

### 5.8 Alterações em tabelas existentes

```sql
-- 1. plan_tier CHECK (5 lugares)
alter table public.profiles
  drop constraint if exists profiles_plan_tier_check,
  add  constraint profiles_plan_tier_check
       check (plan_tier in ('free','acesso','plano1','plano2','plano3','atleta'));

alter table public.workout_videos
  drop constraint if exists workout_videos_required_plan_check,
  add  constraint workout_videos_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta')),
  add column if not exists is_free_preview boolean not null default false;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_required_plan_check,
  add  constraint affiliate_links_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));

alter table public.coupons
  drop constraint if exists coupons_required_plan_check,
  add  constraint coupons_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta')),
  add column if not exists is_public_preview boolean not null default false;

alter table public.moto_events
  drop constraint if exists moto_events_required_plan_check,
  add  constraint moto_events_required_plan_check
       check (required_plan in ('free','acesso','plano1','plano2','plano3','atleta'));

-- 2. CMV em produtos e estética
alter table public.products
  add column if not exists cost_cents int not null default 0
      check (cost_cents >= 0),
  drop column if exists discount_start,
  drop column if exists discount_pro,
  drop column if exists discount_vip;

alter table public.estetica_services
  add column if not exists cost_cents int not null default 0
      check (cost_cents >= 0),
  add column if not exists requires_paid_plan boolean not null default false,
  drop column if exists discount_start,
  drop column if exists discount_pro,
  drop column if exists discount_vip;

-- 2b. Cashback consumido em checkout (referência para o webhook)
alter table public.orders
  add column if not exists cashback_used_cents int not null default 0
      check (cashback_used_cents >= 0);

alter table public.estetica_bookings
  add column if not exists cashback_used_cents int not null default 0
      check (cashback_used_cents >= 0);

-- 3. messages: sender_role substitui is_from_kath
alter table public.messages
  add column if not exists sender_role text not null default 'user'
      check (sender_role in ('user','kath','sidney','admin'));

-- backfill (se existir dado de teste): UPDATE messages SET sender_role = case when is_from_kath then 'kath' else 'user' end;
alter table public.messages drop column if exists is_from_kath;

-- 4. Reescrever policies de messages
drop policy if exists messages_insert_vip on public.messages;
create policy messages_insert_chat on public.messages
  for insert to authenticated
  with check (
    (select auth.jwt()->>'sub') = user_id
    and sender_role = 'user'
    and (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
        in ('plano3','atleta')
  );

-- 5. plan_tier_level: lookup dinâmico
create or replace function public.plan_tier_level(tier text) returns int
language sql stable as $$
  select coalesce((select level from public.plans where slug = tier), 0)
$$;
```

### 5.9 Helpers SQL

```sql
-- Calcular cashback elegível em centavos sobre amount_paid_cash (não sobre cashback queimado)
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

-- Saldo ativo (não-expirado, não-usado) do user
create or replace function public.wallet_active_cents(p_user_id text) returns int
language sql stable as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.wallet_credits
  where user_id = p_user_id
    and used_at is null
    and (expires_at is null or expires_at > now())
$$;

-- Aplicar cashback no checkout (FIFO consumindo créditos antigos primeiro)
create or replace function public.spend_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_revenue_stream_id uuid
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
      -- split: criar débito parcial
      update public.wallet_credits
        set amount_cents = amount_cents - v_remaining
        where id = v_credit.id;
      insert into public.wallet_credits
        (user_id, amount_cents, used_at, spent_on_revenue_stream_id, created_at)
      values
        (p_user_id, -v_remaining, now(), p_revenue_stream_id, now());
      v_used_total := v_used_total + v_remaining;
      v_remaining := 0;
    end if;
  end loop;

  -- atualizar saldo
  update public.wallet_balance
    set spent_total_cents = spent_total_cents + v_used_total,
        active_cents      = active_cents - v_used_total,
        updated_at        = now()
    where user_id = p_user_id;

  return v_used_total;
end;
$$;

-- Creditar cashback após consolidação
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
    set active_cents = wallet_balance.active_cents + p_amount_cents,
        earned_total_cents = wallet_balance.earned_total_cents + p_amount_cents,
        updated_at = now();
end;
$$;

-- Expirar créditos
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

-- Aplicar comissões de um revenue_stream:
--   1. Aplica regras explícitas para 'partner' / 'consultant' sobre net_cents
--   2. Cria allocation residual para o team_member com role='owner'
--      (resto após explícitas, descontado o cashback queimado)
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

  -- 1) Regras explícitas (partners e consultants)
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

  -- 2) Owner residual (Kath absorve cashback queimado aqui)
  select id into v_owner_id from public.team_members where role = 'owner' and is_active = true limit 1;
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
```

`compute_commissions` aloca proporcionalmente sobre `net_cents` para `partner`/`consultant` (regras explícitas). O `owner` (Kath) recebe o residual descontado o `cashback_used_cents`. Assim, o painel financeiro mostra a alocação real da Kath direto da tabela `commission_allocations`, sem precisar reconciliar em query agregada. Russo e Sidney enxergam o net nominal sem ruído de cashback.

## 6. Fluxos

### 6.1 Webhook Asaas → `revenue_streams`

Ponto de hook em `src/app/api/webhook/asaas/route.ts`, depois do INSERT idempotente em `webhook_events` (já existe; manter intocado). Em `PAYMENT_CONFIRMED`:

```ts
const { type, category, reference_type, reference_id, gross_cents, cost_cents, user_id, occurred_at } =
  parseExternalReference(payment);
// 'estetica:<id>'  → type='estetica',     category=null,                ref_type='booking'
// 'loja:<id>'      → type='loja',         category=order.dominant_module, ref_type='order'
// userId puro      → type='mensalidade',  category=plan_slug,           ref_type='subscription'

const { data: stream } = await supabase
  .from('revenue_streams')
  .insert({
    type, category, user_id,
    reference_type, reference_id,
    asaas_payment_id: payment.id,
    gross_cents, cost_cents,
    cashback_used_cents: 0,        // setado em checkout no caso de loja/estética com cashback aplicado
    status: 'confirmed',
    occurred_at,
  })
  .select('id')
  .single();

await supabase.rpc('compute_commissions', { p_revenue_stream_id: stream.id });

// Cashback é creditado em momentos diferentes:
// - mensalidade: imediato
if (type === 'mensalidade') {
  const cashback = await supabase.rpc('compute_cashback_cents', {
    p_user_id: user_id,
    p_amount_paid_cash_cents: gross_cents,                    // sem cashback queimado em mensalidade
  });
  if (cashback > 0) {
    await supabase.rpc('credit_wallet_cents', {
      p_user_id: user_id,
      p_amount_cents: cashback,
      p_source_stream_id: stream.id,
    });
  }
}
// - loja: na transição orders.status → 'delivered' (separadamente)
// - estetica: na transição estetica_bookings.status → 'done' (separadamente)
```

`parseExternalReference` é uma função utilitária a ser criada em `lib/asaas/external-reference.ts` que centraliza esse roteamento.

### 6.2 Checkout de loja/estética com cashback

Em `/api/loja/checkout` e `/api/estetica/bookings`, antes de gerar o payment Asaas:

```ts
// 1. validar e calcular pricing server-side (já feito hoje)
const { gross_cents, cost_cents, plan_discount_cents } = recalcPricing(...);

// 2. aplicar cashback solicitado (limitado a 50% do gross)
const requestedCashback = Math.min(
  body.use_cashback_cents ?? 0,
  Math.floor(gross_cents * 0.5)
);
const activeBalance = await supabase.rpc('wallet_active_cents', { p_user_id: userId });
const cashbackUsed = Math.min(requestedCashback, activeBalance);

// 3. amount_paid_cash = gross - cashback
const amountPaidCash = gross_cents - cashbackUsed;

// 4. criar order/booking com cashback_used_cents preenchido
// 5. criar payment Asaas com value = amountPaidCash / 100
```

**Timing de consumo do cashback:**

- No **checkout**, o `spend_wallet_cents` é chamado imediatamente — o crédito sai do `wallet_balance.active_cents` e os `wallet_credits` são marcados como `used_at = now()`. Isso evita que o user use o mesmo crédito em dois pedidos paralelos. A função usa `for update` na seleção de créditos, então está protegida contra race.
- O `cashback_used_cents` é gravado no `orders.cashback_used_cents` (campo a adicionar) e em `estetica_bookings.cashback_used_cents` (campo a adicionar).
- A `revenue_streams` só é criada quando o webhook PAYMENT_CONFIRMED chegar, pegando `cashback_used_cents` direto da order/booking.
- Se o pagamento Asaas **falhar** (timeout, cancelamento pelo user, expiração da cobrança PIX), uma rotina de compensação reverte o cashback. Isso é disparado por:
  - Cron horário que busca orders/bookings em `status='pending'` com `created_at < now() − 24h` e tenta consultar status no Asaas; se cancelado, executa reversão.
  - Server action `cancelOrder(orderId)` chamada pelo user ou pelo admin (futuro), idem reversão.
- A reversão cria um `wallet_credits` positivo de mesmo valor com `expires_at` igual ao crédito original mais antigo consumido (evita "ressuscitar" cashback expirado).

### 6.3 Crédito de cashback após consolidação

Disparado em transição de status. Implementar em três lugares:

1. **Mensalidade:** dentro do handler `PAYMENT_CONFIRMED` quando `type = 'mensalidade'` (já mostrado em 6.1).
2. **Loja:** server action `markOrderDelivered(orderId)` em `app/admin/loja/actions.ts` ou similar. Após `UPDATE orders SET status='delivered'`, computar cashback sobre `gross - cashback_used` e creditar.
3. **Estética:** server action `markBookingDone(bookingId)` em `app/admin/kath-estetica/actions.ts`. Mesmo padrão.

### 6.4 Cron `/api/cron/wallet-expire`

Roda diariamente (Vercel Cron). Chama `select expire_wallet_credits()`. Em sequência, busca todos os créditos com `expires_at` entre `now() + 7d` e `now() + 8d` e dispara push notification ("Você tem R$ X em cashback expirando em 7 dias").

### 6.5 Cron `/api/cron/affiliate-monthly-payout`

Não roda automaticamente. Endpoint admin chamado manualmente quando Kath recebe o relatório das plataformas de afiliados. Body:

```json
{
  "platform": "amazon",
  "year_month": "2026-04",
  "amount_cents": 420000,
  "category_split": { "fitness": 0.7, "moto": 0.25, "geral": 0.05 }
}
```

Cria 1 linha em `revenue_streams` por categoria (3 nesse exemplo) com `type='afiliado_externo'`, `user_id=null`, `reference_type='affiliate_payout'`, `reference_id='amazon-2026-04-fitness'` (ou similar). Dispara `compute_commissions` para cada uma.

Se o admin não passar `category_split`, o sistema usa a proporção de `affiliate_links.clicks_count` daquele mês (snapshotada de `workout_logs`-like contadores) por módulo.

### 6.6 Loja por módulo (`category` em `revenue_streams`)

Pedido pode ter itens de módulos diferentes. Para o split, a regra é:

- Se 100% dos itens forem do mesmo módulo: `category = <module>`.
- Se misto: criar uma `revenue_stream` por módulo, com `gross_cents` e `cost_cents` proporcionais ao subtotal de cada módulo no pedido. Mantém a referência ao mesmo `order_id` em `reference_id`, mas com sufixo (`order_id:fitness`, `order_id:moto`).

Decisão pragmática: para versão 1, agrupar pelo módulo dominante (maior soma). Se necessário separar depois, é evolução.

## 7. Seeds iniciais

### 7.1 Seed de `plans`

```sql
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
   '{"workouts":true,"diet":true,"supplements":true,"juices":true,"chat_sla_h":12,"reavaliation":"biweekly","video_call_per_month":1,"estetica_book_all":true,"affiliate_clicks_per_month":"unlimited"}'::jsonb, 5);
```

### 7.2 Seed de `team_members`

```sql
insert into public.team_members (email, full_name, role) values
  ('kath@kathapp.com.br',   'Kath Guedes', 'owner'),
  ('russo@kathapp.com.br',  'Russo',       'partner'),
  ('sidney@kathapp.com.br', 'Sidney',      'partner');
```

### 7.3 Seed de `commission_rules`

```sql
do $$
declare
  v_kath uuid;   v_russo uuid;   v_sidney uuid;
begin
  select id into v_kath   from public.team_members where email='kath@kathapp.com.br';
  select id into v_russo  from public.team_members where email='russo@kathapp.com.br';
  select id into v_sidney from public.team_members where email='sidney@kathapp.com.br';

  -- Russo: 25% de tudo (regra geral)
  insert into public.commission_rules (team_member_id, pct) values (v_russo, 25);

  -- Sidney: 30% só de mensalidade dos planos pagos com saúde (plano1, plano2, plano3, atleta)
  insert into public.commission_rules (team_member_id, applies_to_type, applies_to_category, pct) values
    (v_sidney, 'mensalidade', 'plano1', 30),
    (v_sidney, 'mensalidade', 'plano2', 30),
    (v_sidney, 'mensalidade', 'plano3', 30),
    (v_sidney, 'mensalidade', 'atleta', 30);

  -- Kath é owner: NÃO recebe rule. compute_commissions cria allocation
  -- residual para ela automaticamente, descontando cashback queimado.
end $$;
```

## 8. Refactor de código

### 8.1 Arquivos a criar

- `src/lib/asaas/external-reference.ts` — `parseExternalReference(payment) → { type, category, user_id, reference_type, reference_id, gross_cents, cost_cents, occurred_at }`
- `src/lib/billing/plans.ts` — cache em memória de `plans` table com TTL 60s; funções `getPlan(slug)`, `getAllPlans()`, `planTierFromValue(value)`, `getStoreDiscountPct(slug)`, `getEsteticaDiscountPct(slug)`
- `src/lib/billing/wallet.ts` — wrappers das RPCs de wallet
- `src/lib/billing/commissions.ts` — wrappers das RPCs de comissão + queries agregadas para o painel
- `src/lib/billing/revenue.ts` — função `recordRevenueStream(supabase, payload)` chamada do webhook
- `src/app/api/cron/wallet-expire/route.ts`
- `src/app/api/cron/order-timeout/route.ts` — horário; busca orders/bookings em `pending` há >24h, consulta status no Asaas, cancela e reverte cashback se necessário
- `src/app/admin/financeiro/page.tsx` — dashboard financeiro
- `src/app/admin/financeiro/comissoes/page.tsx` — lista de allocations
- `src/app/admin/financeiro/afiliado-externo/page.tsx` — form de payout mensal
- `src/app/admin/team/page.tsx` — CRUD `team_members`
- `src/app/admin/team/regras/page.tsx` — CRUD `commission_rules`
- `src/app/admin/plans/page.tsx` — editor de `plans`

### 8.2 Arquivos a editar

- `src/lib/asaas/config.ts` — remover `PLAN_PRICES`, `PLAN_DESCRIPTIONS`, `PLAN_HIERARCHY`. Manter `ASAAS_CONFIG`.
- `src/lib/asaas/webhook.ts:52` `planTierFromValue` — delegar para `lib/billing/plans.ts`.
- `src/lib/asaas/webhook.ts` — após `webhook_events` insert, chamar `recordRevenueStream`. No PAYMENT_CONFIRMED, lógica de criação automática de consultoria muda: `plano2`/`plano3` → `mensal`; `atleta` → `premium`.
- `src/lib/asaas/checkout.ts` — `processCheckout` lê `asaas_value` e `asaas_description` da tabela.
- `src/lib/validations.ts:4` — atualizar `planTierSchema`.
- `src/lib/supabase/types.ts` — atualizar `PlanTier`. **Regenerar** após migration via `supabase gen types typescript`.
- `src/app/(app)/planos/page.tsx` — fetch `plans` table; render dinâmico; remover const hardcoded.
- `src/app/(app)/planos/subscribe-button.tsx` — apenas labels mudam, sem refactor estrutural.
- `src/app/(app)/loja/store-grid.tsx` — desconto vem de `lib/billing/plans.ts`.
- `src/app/(app)/loja/page.tsx` — idem.
- `src/app/api/loja/checkout/route.ts` — substituir lookup de `discount_*` por `getStoreDiscountPct(planTier)`. Adicionar suporte a `use_cashback_cents`.
- `src/app/api/loja/payment/route.ts` — preencher `cashback_used_cents` em `orders` (campo a adicionar), valor enviado ao Asaas é `amount_paid_cash`.
- `src/app/(app)/kath-estetica/agendar/[serviceId]/booking-form.tsx` — desconto vem de `lib/billing/plans.ts`. UI para usar cashback.
- `src/app/api/estetica/bookings/route.ts` — idem.
- `src/app/api/estetica/bookings/[id]/payment/route.ts` — idem.
- `src/app/admin/loja/product-form.tsx` — remover campos `discount_*`, adicionar `cost_cents`.
- `src/app/admin/loja/order-list.tsx` — botão "Marcar como entregue" chama action que credita cashback.
- `src/app/admin/kath-estetica/servicos/service-form.tsx` — adicionar `cost_cents` e `requires_paid_plan`.
- `src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx` — botão "Marcar como concluída" chama action que credita cashback.
- `src/app/(app)/perfil/page.tsx` — exibir saldo de cashback (`wallet_active_cents`) + extrato.
- `src/app/admin/dashboard/page.tsx` — atualizar métricas para usar `revenue_streams`.
- `src/app/(app)/chat/chat-room.tsx` — render de mensagem usa `sender_role` (não mais `is_from_kath`).
- `src/app/admin/chat/admin-chat-inbox.tsx` — admin escolhe quem está respondendo (Kath ou Sidney).

### 8.3 Arquivos a remover

- Nenhum arquivo a remover. Apenas reescritas dentro de arquivos existentes.

### 8.4 Atualização do wiki

Após implementação, atualizar:
- `docs/wiki/dominio/perfil-onboarding-planos.md` — novo modelo de planos
- `docs/wiki/dominio/loja.md` — desconto via `plans`, `cost_cents`, cashback
- `docs/wiki/dominio/kath-estetica.md` — desconto via `plans`, `cost_cents`, `requires_paid_plan`
- `docs/wiki/dominio/chat.md` — agora Plano 3+, com `sender_role`
- `docs/wiki/plataforma/pagamentos-asaas.md` — `revenue_streams`, `commission_*`, fluxo completo
- Criar `docs/wiki/plataforma/financeiro.md` novo, cobrindo modelo de receita unificada + comissões + wallet

## 9. UI

### 9.1 `/planos` (user-facing)

Render dinâmico com 6 cards, lê de `plans` table. Card destaca `plano3` como "Mais escolhido" e `atleta` como "Premium". Cada card mostra:

- Nome + preço
- Lista de features (derivada de `features` jsonb com mapeamento i18n para texto humano)
- Preço com desconto se já é assinante atual
- Botão "Assinar" → abre `<SubscribeButton>` (existente)

`SubscribeButton` mantém os 3 métodos (PIX/BOLETO/CREDIT_CARD).

### 9.2 `/perfil` — bloco de cashback

Novo bloco abaixo do bloco de plano:

```
[ Carteira KathApp ]
Saldo ativo: R$ 14,50
Próximo a expirar: R$ 3,20 em 12/06/2026

[Ver extrato]
```

Página `/perfil/cashback` mostra extrato (lista de `wallet_credits`).

### 9.3 Aplicar cashback no checkout

Em `app/(app)/loja/pedido/payment-panel.tsx` e `app/(app)/kath-estetica/agendar/.../booking-form.tsx`:

```
Total: R$ 200,00
Cashback disponível: R$ 14,50
Aplicar cashback? [______] (max R$ 100,00 ─ 50% do total)
                  Você usará R$ 14,50, paga R$ 185,50
```

### 9.4 Admin `/admin/financeiro`

Tabs:
- **Visão geral**: gráfico mensal por `revenue_streams.type` + KPIs (receita 30d, ticket médio, churn, passivo de cashback).
- **Comissões**: lista `commission_allocations` filtrável por sócio, status, mês. Botão "Aprovar lote" (draft → approved), "Marcar como pago" (approved → paid).
- **Afiliados externos**: form para registrar payout mensal por plataforma. Mostra histórico.
- **Carteira**: visão agregada de `wallet_balance` (passivo total ativo, expirado, gasto).

### 9.5 Admin `/admin/team` e `/admin/team/regras`

CRUD simples. `team_members` cadastra sócio (email, role, dados de PIX). `commission_rules` define regras com vigência.

### 9.6 Admin `/admin/plans`

Editor de planos. Permite editar:
- `name`, `price_cents` (e `asaas_value` derivado), `asaas_description`
- `cashback_pct`, `store_discount_pct`, `estetica_discount_pct`
- `features` jsonb (UI com toggles para chaves conhecidas + textarea para JSON livre)
- `is_active`, `sort_order`

Mudanças em preço **não afetam** assinantes existentes (Asaas mantém valor antigo até nova subscription) — UI exibe aviso.

### 9.7 Chat

`messages.sender_role` permite render distinto:
- `user`: balão à direita (cinza)
- `kath`: balão à esquerda com avatar Kath e badge "Kath"
- `sidney`: balão à esquerda com avatar Sidney e badge "Sidney"
- `admin`: igual `kath` (compatibilidade futura, raro)

Admin inbox tem dropdown "Responder como: Kath / Sidney" antes de enviar.

## 10. Erros e edge cases

| Cenário | Comportamento |
|---------|---------------|
| User tenta aplicar cashback > 50% do total | Server clampa em 50%; UI mostra mensagem |
| User tenta aplicar cashback > saldo ativo | Server clampa; UI mostra saldo real |
| Webhook chega antes de a transição de status (loja `delivered`) | Cashback creditado só na transição (independente do webhook) |
| Pedido cancelado **antes** do webhook (PIX expirou, user fechou) | Cron horário detecta + reversão de cashback (cria `wallet_credits` positivo de mesmo valor); ordem vai para `status='canceled'`; estoque é incrementado de volta |
| Pedido cancelado **depois** do webhook PAYMENT_CONFIRMED (refund) | `revenue_streams.status` → `'refunded'`; `commission_allocations` afetadas viram `'failed'`; cashback gerado pela transação que ainda não foi usado é revogado (debit em `wallet_credits`); cashback consumido na transação é mantido perdido (não ressuscita) |
| Duas requests paralelas tentando gastar o mesmo crédito | RPC `spend_wallet_cents` usa `for update`; serializa naturalmente |
| Preço de plano alterado | Asaas mantém valor antigo até a próxima renovação. Painel admin avisa. Sem migração automática |
| Sócio adicionado depois | Nova `commission_rule` cria allocations só para `revenue_streams` futuras. Histórico não é recalculado |
| Sócio removido (`is_active = false`) | Allocations existentes mantêm. Novas não são criadas. UI esconde sócio inativo |
| `revenue_streams.cost_cents > gross_cents` | Constraint impede `net_cents` negativo via CHECK em prévia? Não. O generated column permite negativo. Adicionar CHECK: `cost_cents <= gross_cents`. **Decisão:** sim, `check (cost_cents <= gross_cents)` na migration |

## 11. Testes (foco mínimo)

Vitest, em `src/lib/billing/*.test.ts`:

- `parseExternalReference`: cobrir 4 casos (estetica, loja, mensalidade, afiliado).
- `planTierFromValue`: cobrir limites entre tiers (19, 19.90, 39.89, 39.90, 99.90, 309.90, 0).
- Spend wallet com FIFO: créditos antigos consumidos primeiro.
- Spend wallet com split: parcial em um crédito grande.
- Compute commissions: regras gerais + específicas com prioridade.
- Compute cashback: clamp em 0 quando plano free.

Integration tests não mockam DB (rodam contra Supabase local).

## 12. Plano de migração SQL

Os DDL deste spec viram um único arquivo: `supabase/migration_modelo_financeiro.sql` que executa:

1. CREATE TABLE `plans` + RLS + index + seed.
2. CREATE TABLE `team_members` + RLS + seed.
3. CREATE TABLE `commission_rules` + RLS + index + seed (DO block).
4. CREATE TABLE `commission_allocations` + RLS + index.
5. CREATE TABLE `revenue_streams` + RLS + indexes.
6. CREATE TABLE `wallet_credits` + RLS + index.
7. CREATE TABLE `wallet_balance` + RLS.
8. CREATE TABLE `monthly_usage` + RLS.
9. ALTER TABLE em `profiles`, `workout_videos`, `affiliate_links`, `coupons`, `moto_events` (CHECK constraints).
10. ALTER TABLE em `products`, `estetica_services` (cost, drop discounts).
11. ALTER TABLE em `messages` (`sender_role`, drop `is_from_kath`, reescrever policy).
12. CREATE OR REPLACE FUNCTION `plan_tier_level`, `compute_cashback_cents`, `wallet_active_cents`, `spend_wallet_cents`, `credit_wallet_cents`, `expire_wallet_credits`, `compute_commissions`.
13. ALTER FUNCTION `webhook_events` (já existe — sem mudança).

Após aplicar:
- Regenerar `lib/supabase/types.ts` via `supabase gen types`.
- Atualizar `schema.sql` consolidado para refletir o novo estado.
- Smoke test: criar customer test no sandbox Asaas, simular `PAYMENT_CONFIRMED` para cada um dos 5 planos pagos, conferir que `revenue_streams + commission_allocations` foram criadas corretamente e cashback creditado.

## 13. Aprovação

- Decisões de produto: aprovadas pelo owner em 2026-05-02 durante brainstorming.
- Vocabulário canônico: alinhado com mapeamento de 2026-05-02 (auditoria do projeto).
- Próximo passo: criar plano de implementação detalhado via skill `writing-plans`.
