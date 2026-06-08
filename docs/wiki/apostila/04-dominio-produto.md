# Módulo 4 — Domínio do Produto: Gating por Plano, os 3 Módulos e Transversais

> **Apostila técnica KathApp — Módulo 4 de N**
> Público-alvo: desenvolvedores onboarding no repositório `kathguedes-main`. Leia o `CLAUDE.md` e o `docs/HANDBOOK.md` antes de tocar em qualquer arquivo.
> Versão baseada na auditoria `docs/audit/2026-05-22-cto-audit.md` (branch `kathguedes-app1.0`).

---

## Sumário

1. [Mapa dos domínios](#1-mapa-dos-domínios)
2. [Gating por plano: a escada de tiers](#2-gating-por-plano-a-escada-de-tiers)
3. [Módulo Fitness](#3-módulo-fitness)
4. [Módulo Kath Estética](#4-módulo-kath-estética)
5. [Módulo Loja](#5-módulo-loja)
6. [Transversais](#6-transversais)
   - 6.1 Consultoria VIP
   - 6.2 Cupons
   - 6.3 Afiliados
   - 6.4 Chat VIP
   - 6.5 Push / Notificações
   - 6.6 Cashback / Wallet
   - 6.7 Comissões e Equipe
7. [Exercícios](#7-exercícios)

---

## 1. Mapa dos Domínios

O KathApp é o app da atleta Kath Guedes (351 K seguidores). Tudo que gera receita converge em três produtos e um conjunto de features transversais:

```
┌─────────────────── KathApp ────────────────────────────────┐
│  3 PRODUTOS PRINCIPAIS                                      │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   FITNESS  │  │  KATH ESTÉTICA   │  │      LOJA      │  │
│  │  treinos   │  │  moto / serviços │  │   e-commerce   │  │
│  │  streak    │  │  booking + Pix   │  │   frete Melhor │  │
│  │  desafio   │  │  walk-in         │  │   Envio        │  │
│  └────────────┘  └──────────────────┘  └────────────────┘  │
│                                                              │
│  TRANSVERSAIS (cruzam todos os produtos)                    │
│  Consultoria VIP · Cupons · Afiliados · Chat VIP            │
│  Push/Notificações · Cashback/Wallet · Comissões/Equipe    │
│                                                              │
│  PLATAFORMA (base compartilhada)                            │
│  Clerk (auth) · Supabase Postgres (RLS) · Asaas (Pix)      │
│  plans table · revenue_streams · PLAN_LEVELS               │
└─────────────────────────────────────────────────────────────┘
```

Cada módulo tem sua própria subárvore de rotas:

| Módulo | Rotas usuário | Rotas admin | API |
|--------|--------------|-------------|-----|
| Fitness | `/fitness/**`, `/desafio`, `/calculadora` | `/admin/treinos` | `/api/workout/complete` |
| Estética | `/kath-estetica/**` | `/admin/kath-estetica/**` | `/api/estetica/**` |
| Loja | `/loja/**` | `/admin/loja` | `/api/loja/**` |
| Consultoria | `/consultoria/**` | `/admin/consultorias/**` | `/api/consultoria/**` |
| Cupons | `/cupons` | `/admin/cupons` | `/api/coupon/use` |
| Afiliados | `/afiliados` | `/admin/afiliados` | `/api/affiliate/click` |
| Chat | `/chat` | `/admin/chat` | — |

---

## 2. Gating por Plano: a Escada de Tiers

### 2.1 Conceito: a escada de níveis

O acesso a conteúdo e funcionalidades no KathApp é determinado pelo `plan_tier` do usuário — um slug guardado em `profiles.plan_tier`. A lógica de acesso é ordinal: cada tier inclui tudo dos anteriores ("gating cumulativo"). O app tem seis tiers, do mais básico ao mais completo:

| Slug | Nome exibido | Level | Preço (default) | Cashback | Loja off | Estética off |
|------|-------------|:-----:|----------------:|:--------:|:--------:|:------------:|
| `free` | Free | 0 | — | 0% | 0% | 0% |
| `acesso` | Acesso | 1 | R$ 19,90/mês | 2% | 5% | 5% |
| `plano1` | Plano 1 — Treino | 2 | R$ 39,90/mês | 3% | 8% | 7% |
| `plano2` | Plano 2 — Treino + Dieta | 3 | R$ 74,90/mês | 5% | 12% | 10% |
| `plano3` | Plano 3 — Saúde Completa | 4 | R$ 99,90/mês | 7% | 18% | 12% |
| `atleta` | Atleta | 5 | R$ 309,90/mês | 10% | 25% | 15% |

> **Fonte de verdade**: a tabela `plans` no Supabase. Os percentuais acima são defaults — o admin pode alterá-los em `/admin/plans`. A migration consolidada fica em `supabase/migration_modelo_financeiro.sql`.

### 2.2 No KathApp: `src/lib/billing/access.ts`

A lógica de comparação de tiers é síncrona (sem round-trip ao banco) e vive em:

**`src/lib/billing/access.ts` (completo, 42 linhas)**

```typescript
// PLAN_LEVELS: mapa slug → número ordinal.
// Os slugs são fixos por constraint SQL; não referencie literais externos.
export const PLAN_LEVELS: Record<PlanTier, number> = {
  free: 0,
  acesso: 1,
  plano1: 2,
  plano2: 3,
  plano3: 4,
  atleta: 5,
};

export const TOP_PLAN: PlanTier = "atleta";

/** Retorna o nível numérico de um tier. null/undefined/desconhecido = 0. */
export function planLevel(tier: PlanTier | string | null | undefined): number {
  if (!tier) return 0;
  return PLAN_LEVELS[tier as PlanTier] ?? 0;
}

/** true se `tier` tem nível >= ao tier mínimo exigido. */
export function hasPlanAccess(
  tier: PlanTier | string | null | undefined,
  required: PlanTier,
): boolean {
  return planLevel(tier) >= planLevel(required);
}

/** true se `tier` é o topo — não há upgrade possível. */
export function isTopPlan(tier: PlanTier | string | null | undefined): boolean {
  return planLevel(tier) >= planLevel(TOP_PLAN);
}
```

O helper `hasPlanAccess` é o único ponto de comparação de tiers em código TS. **Nunca use literais de string para comparar planos** (ver armadilha abaixo).

### 2.3 A tabela `plans` como fonte de verdade de preço

Enquanto `PLAN_LEVELS` é estático em código (necessário para gating síncrono), os valores financeiros — preço, desconto, cashback, features — são lidos da tabela `plans` em tempo de execução:

**`src/lib/billing/plans.ts` — funções de acesso**

```typescript
// Cache de 60 segundos para evitar round-trip por request
const TTL_MS = 60_000;
let cache: { data: Plan[]; expiresAt: number } | null = null;

export async function getAllPlans(): Promise<Plan[]> { ... }
export async function getPlan(slug: PlanTier): Promise<Plan | null> { ... }
export async function getStoreDiscountPct(slug: PlanTier): Promise<number> { ... }
export async function getEsteticaDiscountPct(slug: PlanTier): Promise<number> { ... }
export async function getCashbackPct(slug: PlanTier): Promise<number> { ... }

// Mapeia valor Asaas (em reais) → tier: usado no webhook de confirmação
export async function planTierFromValue(value: number): Promise<PlanTier> { ... }
```

> Arquivo: `src/lib/billing/plans.ts:70–111`

No checkout, o servidor **nunca** usa o plano ou preço enviado pelo cliente. Ele busca o `plan_tier` autoritativo em `profiles` e o preço em `plans`:

```typescript
// src/app/api/loja/checkout/route.ts:67-73
const { data: profile } = await supabase
  .from("profiles")
  .select("plan_tier")
  .eq("id", userId)
  .single();
const planTier = (profile?.plan_tier as PlanTier | undefined) ?? "free";
const discountPct = await getStoreDiscountPct(planTier); // lê plans table
```

### 2.4 Gating no banco: a função SQL `plan_tier_level()`

O gating também é enforçado diretamente no Postgres via RLS, eliminando a possibilidade de bypass por URL direta. A função `public.plan_tier_level(slug text) → int` faz lookup dinâmico em `plans` e é usada em múltiplas policies:

```sql
-- Exemplo: policy de workout_videos (schema.sql:107-115)
create policy "workouts_select_by_plan" on workout_videos
  for select to authenticated
  using (
    is_published = true
    and plan_tier_level(
          (select plan_tier from profiles where id = auth.jwt()->>'sub')
        ) >= plan_tier_level(required_plan)
  );
```

A mesma função aparece nas RLS de `affiliate_links`, `coupons` e `messages` (para insert de chat).

### 2.5 Mudança de preço e impacto em assinantes existentes

> **Regra de ouro do produto**: alterar o preço de um plano em `/admin/plans` **não afeta** assinantes existentes no Asaas. O Asaas mantém o valor original da subscription até a próxima renovação. Novos assinantes pagam o novo preço.

Essa distinção é crítica: se você mudar `plano1` de R$ 39,90 para R$ 49,90, quem já paga R$ 39,90 continua pagando esse valor. O webhook `planTierFromValue` encontra o tier pelo valor mais próximo menor ou igual ao pago — se existirem assinantes pagando o valor antigo e o novo tier com valor antigo não existir mais no banco, eles serão mapeados para o tier errado.

O painel admin exibe um aviso fixo em `/admin/plans` sobre esse comportamento. Veja `docs/wiki/plataforma/financeiro.md §8`.

---

> **⚠️ Armadilha: o slug `"vip"` está morto**
>
> A auditoria de 2026-05-22 identificou como **P0-crítico (C2)** que vários arquivos ainda comparam `plan_tier` com slugs da nomenclatura antiga (`"vip"`, `"pro"`, `"start"`). Esses slugs não existem mais como `PlanTier` válido — qualquer comparação `tier === "vip"` retorna `false` para 100% dos usuários, inclusive os que pagaram.
>
> **Nunca escreva:**
> ```typescript
> if (profile.plan_tier === "vip") { /* nunca será true */ }
> if (profile.plan_tier !== "pro") { /* sempre bloqueia */ }
> ```
>
> **Sempre escreva:**
> ```typescript
> import { hasPlanAccess } from "@/lib/billing/access";
> if (hasPlanAccess(profile.plan_tier, "plano3")) { /* correto */ }
> ```
>
> Evidências no código: `src/app/(app)/chat/page.tsx` já foi corrigido para `hasPlanAccess(profile?.plan_tier, "plano3")` (linha 27). Forms admin de cupom e afiliado ainda oferecem `"vip"` como opção — isso transforma cupons "VIP-only" em cupons públicos (level 0). Veja `docs/audit/2026-05-22-cto-audit.md §P3`.

---

> **⚠️ Armadilha: self-upgrade de plano via RLS permissiva**
>
> A auditoria identificou **P0-crítico (C1)**: a policy `profiles_update_own` em `schema.sql:76-80` permite `UPDATE` sem restrição de coluna. Um usuário autenticado com a anon key + JWT próprio pode executar `update profiles set plan_tier = 'atleta'` e obter acesso VIP gratuitamente. Todos os gates de plano leem essa coluna.
>
> A correção recomendada é um trigger `BEFORE UPDATE` que rejeita mudanças em `plan_tier`, `subscription_status` e `subscription_ends_at` fora do contexto `service_role`. Enquanto não corrigido, o RLS está bypassado para self-upgrade. Nenhuma feature nova deve depender só do `plan_tier` do profile sem dupla verificação server-side.

---

## 3. Módulo Fitness

### O que é

O módulo Fitness é a biblioteca de treinos em vídeo da Kath (embed YouTube), com registro de execução, sistema de streak diário e desafio de 7 dias. É o produto core do app — o conteúdo que justifica a assinatura para a maioria dos usuários.

### Como o gating de plano se aplica

Cada treino tem a coluna `required_plan` (um dos 6 slugs). A RLS `workouts_select_by_plan` filtra automaticamente na query de listagem. O usuário `free` vê apenas treinos com `required_plan = 'free'`; um `plano2` vê todos os treinos de `required_plan` em `{free, acesso, plano1, plano2}`.

**Listagem: `/fitness` usa RLS e não faz nada especial:**

```typescript
// src/app/(app)/fitness/page.tsx:27-39
const supabase = await createServerSupabaseClient(); // RLS aplica
let query = supabase
  .from("workout_videos")
  .select("*")
  .eq("is_published", true)
  .order("published_at", { ascending: false });
// A policy workouts_select_by_plan filtra por plan_tier automaticamente
const { data: workouts } = await query;
```

### Modelo de dados principal

**Tabela `workout_videos`** (`supabase/schema.sql:86`):

| Coluna | Tipo | Função |
|--------|------|--------|
| `id` | uuid PK | identificador |
| `youtube_id` | text | embed do player |
| `required_plan` | text CHECK | gating de plano |
| `category` | text CHECK (17 valores) | filtro de categoria |
| `level` | text CHECK | iniciante/intermediário/avançado |
| `is_published` | boolean | controle admin |
| `is_short` | boolean | altera aspect ratio (9:16 vs 16:9) |
| `views_count` | int | incrementado atomicamente por trigger |

**Tabela `workout_logs`** (`schema.sql:179`): registra cada execução com `user_id` e `workout_id`. O trigger `on_workout_log_insert` incrementa `views_count` atomicamente (padrão de counter atômico do handbook).

**Streak** em `profiles.workout_streak` e `profiles.last_workout_at`: calculado no route handler `POST /api/workout/complete`:

```typescript
// src/app/api/workout/complete/route.ts:50-62
// Janela de horas, não dias-calendário:
// < 24h  → mantém (mesmo dia)
// < 48h  → incrementa
// >= 48h → reseta para 1
```

### Arquivos de referência

- `src/app/(app)/fitness/page.tsx:25` — listagem com RLS
- `src/app/(app)/fitness/[id]/page.tsx:41` — detalhe (agora usando RLS client, não admin client)
- `src/app/api/workout/complete/route.ts:9` — registro + streak
- `src/lib/validations.ts:7-22` — `createWorkoutSchema` (Zod, dono lógico: Fitness)
- `supabase/schema.sql:107-115` — policy `workouts_select_by_plan`
- `supabase/migration_workout_v2.sql` — 17 categorias, `is_short`, `notes`, `equipment`

---

> **⚠️ Armadilha (C4): treino premium acessível por URL direta**
>
> Até o commit da correção indicada na auditoria, `src/app/(app)/fitness/[id]/page.tsx:43` usava `createAdminSupabaseClient()` para buscar o treino no detalhe. Isso bypassa o RLS de `workouts_select_by_plan`, tornando qualquer treino premium acessível diretamente via `/fitness/<uuid>` mesmo sem o plano correto.
>
> **Correto**: usar `createServerSupabaseClient()` (com RLS). O usuário sem o plano recebe 404 automaticamente. O arquivo já foi corrigido no branch atual para usar o RLS client (veja o comentário no código: linha 44-46 com "RLS client: a policy de workout_videos checa plan_tier_level").
>
> **Regra**: nunca use `createAdminSupabaseClient()` em rota de usuário para "facilitar". Se a RLS bloqueia um acesso legítimo, corrija a policy — não bypasse com service role.

---

> **⚠️ Armadilha: streak com janela de horas em vez de dias-calendário**
>
> O cálculo de streak em `route.ts:51-62` compara `diffHours` entre `last_workout_at` e `now()`. Consequência: treinar às 23:00 e no dia seguinte às 22:00 (23h de diferença) **mantém** o streak como "mesmo dia" em vez de incrementar. Treinar às 01:00 e às 23:00 do mesmo dia (22h) conta como dois dias. Em fusos horários diferentes do servidor, o comportamento é imprevisível.
>
> A correção correta é comparar datas-calendário no fuso do usuário (ou UTC fixo). Registre como dívida técnica antes de usar streak como gate de feature.

---

## 4. Módulo Kath Estética

### O que é

O módulo "Kath Guedes Estética Moto" é o segundo produto do app: catálogo de serviços de estética automotiva (lavagem, polimento, vitrificação, higienização, cristalização), com agendamento online, pagamento via Pix Asaas, walk-in presencial, programa de fidelidade (3 serviços pagos → 4º grátis) e painel admin completo (kanban de agendamentos, calendário, portfólio, preços, horários).

Este módulo tem a modelagem mais rica do sistema — e a maior concentração de código novo (walk-in, matriz de preços, payment_rules) que ainda carrega dívidas de tipagem (todos os `as never` na tabela estética apontam para o C5 da auditoria: tipos TypeScript dessincronizados das migrations recentes).

### Como o gating de plano se aplica

O gating de estética tem duas camadas:

1. **`requires_paid_plan`**: serviços premium (ex.: vitrificação) só podem ser agendados online por usuários com plano pago. Verificado em `POST /api/estetica/bookings`:

```typescript
// src/app/api/estetica/bookings/route.ts:94-99
if (service.requires_paid_plan && planTier === "free") {
  return NextResponse.json(
    { error: "Este servico exige um plano pago. Veja /planos." },
    { status: 403 },
  );
}
```

2. **Desconto por plano**: todos os usuários podem agendar serviços sem `requires_paid_plan`, mas o preço é recalculado com base no `plan_tier` via `getEsteticaDiscountPct(planTier)` (lido de `plans.estetica_discount_pct`):

```typescript
// src/lib/billing/plans.ts:104-106
export async function getEsteticaDiscountPct(slug: PlanTier): Promise<number> {
  return (await getPlan(slug))?.estetica_discount_pct ?? 0;
}
```

> Os campos `discount_start/pro/vip` que ainda aparecem em `estetica_services` são **colunas legadas** — o desconto atual vem exclusivamente de `plans.estetica_discount_pct`.

### A matriz de preços: `service_prices × vehicle_types`

A maior inovação do módulo é a **matriz de preços**: o valor de cada serviço varia por **tipo de moto** (sport, naked, scooter, touring...). As tabelas envolvidas:

- `estetica_vehicle_types`: catálogo de tipos de moto (`id, slug, label, sort_order, is_active`)
- `estetica_service_prices`: relação N×M (`service_id, vehicle_type_id, price_cents, is_active`)
- `estetica_payment_rules`: regras de pagamento por serviço (`allow_app_prepay, require_app_prepay, prepay_pct, allow_onsite_cash/pix/card`)

O helper que encapsula toda essa lógica:

```typescript
// src/lib/estetica/pricing.ts:41
export async function getServicePricing(serviceId: string): Promise<ServicePricing> {
  // Busca options (preço por tipo de moto) e payment_rule em paralelo
  const [pricesRes, ruleRes] = await Promise.all([
    supabase.from("estetica_service_prices").select("price_cents, vehicle_type:..."),
    supabase.from("estetica_payment_rules").select("...").eq("service_id", serviceId).maybeSingle(),
  ]);
  return { service_id: serviceId, options, payment_rule };
}
```

No agendamento, o preço final é recalculado server-side: se a matrix existe para o serviço e o cliente não enviou `vehicle_type_id`, o servidor rejeita com 400. O cliente **nunca** envia preço — apenas identifiers.

### O sinal (prepay)

A `payment_rule` define se um serviço exige sinal antecipado (ex.: 30% no app, restante na hora). O campo `prepay_pct` controla quanto. O booking é criado com `prepay_cents` e `remaining_cents`. O webhook Asaas detecta se o valor confirmado corresponde ao sinal ou ao total (com tolerância de ±1 centavo) e processa adequadamente.

```
Fluxo com sinal:
/agendar → POST /api/estetica/bookings → status=pending, prepay_cents=X
→ POST /api/estetica/bookings/[id]/payment → Asaas PIX (valor=prepay_cents)
→ ASAAS webhook PAYMENT_CONFIRMED → status=confirmed (sinal confirmado)
→ Serviço executado
→ Admin "quitar restante" → markBookingRemainderPaid → 2º revenue_stream
```

### Walk-in presencial

Para clientes que aparecem sem agendamento, o módulo tem um fluxo admin-only de walk-in:

```
/admin/kath-estetica/atendimento → walkin-form (Server Action createWalkinService)
  requireAdmin → normaliza placa → Zod → upload fotos (moto + placa)
  → busca veículo por placa (idempotente: reutiliza customer se já existe)
  → ou cria customer + vehicle → insert walkin_service (preço editável, sem Asaas)
```

As tabelas walk-in (`estetica_customers`, `estetica_vehicles`, `estetica_walkin_services`) são separadas das de booking online — walk-in não gera cobrança Asaas, é registrado localmente. OCR de placa é um stub deliberado (`src/lib/estetica/ocr.ts`).

### Fidelidade (3→4 grátis)

Após cada serviço marcado como `done` pelo admin, o usuário pode enviar uma foto. Quando o admin aprova 4 fotos em um mês, o usuário recebe a 5ª lavagem grátis (sinalizado por push). No próximo agendamento no mesmo mês, a RPC `check_loyalty_eligibility` retorna `true` e o booking é criado com `loyalty_free=true`, `total=0`, `status=confirmed`.

```
Tabela: estetica_loyalty_photos
  user_id, booking_id (UNIQUE — anti-fraude), month (YYYY-MM), approved (bool)
RPC: check_loyalty_eligibility(p_user_id) → boolean
```

### Kanban de agendamentos

`/admin/kath-estetica/agendamentos` oferece dois modos de visualização: kanban (colunas por status) e calendário. As transições de status são controladas por `nextStatusByCurrent` (`src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx:21`):

```
pending → confirmed | canceled
confirmed → in_progress | canceled | no_show
in_progress → done | canceled
done / canceled / no_show: terminais
```

Cada transição dispara push notification ao usuário via `notifyUser`.

### Arquivos de referência

- `src/app/(app)/kath-estetica/**` — área do usuário
- `src/app/api/estetica/bookings/route.ts:17` — criação de booking (Zod + rate-limit + RPC)
- `src/app/api/estetica/bookings/[id]/payment/route.ts:10` — geração de PIX Asaas
- `src/app/api/estetica/slots/route.ts:9` — slots disponíveis via RPC
- `src/app/api/estetica/loyalty/upload/route.ts:15` — upload foto fidelidade
- `src/app/admin/kath-estetica/actions.ts:1` — Server Actions admin (requireAdmin)
- `src/app/admin/kath-estetica/agendamentos/bookings-kanban.tsx:30` — kanban
- `src/app/admin/kath-estetica/agendamentos/bookings-calendar.tsx` — calendário
- `src/lib/estetica/pricing.ts` — matriz de preços
- `src/lib/estetica/types.ts:83-107` — helpers `finalPriceCents`, `formatPrice`
- `supabase/migration_kath_estetica.sql` — schema completo

---

> **⚠️ Armadilha: double-booking de slot**
>
> A RPC `get_available_slots` (`migration_kath_estetica.sql:298`) verifica slots disponíveis no momento da leitura, mas **não há lock nem constraint de exclusão** (EXCLUDE constraint em `tstzrange`) no banco. Dois usuários consultando ao mesmo tempo podem ver o mesmo slot disponível; se ambos submeterem o formulário em sequência rápida, ambos terão bookings para o mesmo horário.
>
> A correção definitiva é um EXCLUDE constraint `GIST` em `estetica_bookings(tstzrange(scheduled_at, scheduled_at + duration_min * interval '1 min'))` ou um INSERT serializado com `SERIALIZABLE`. Enquanto não implementada, o double-booking é um risco real em horários populares.

---

> **⚠️ Armadilha: cashback de sinal+restante nunca creditado**
>
> Quando um booking tem sinal + restante, são gerados dois `revenue_streams` confirmados. A ação `updateBookingStatus` usa `.maybeSingle()` para encontrar o stream do booking — mas com dois streams confirmados, `.maybeSingle()` falha silenciosamente, e o cashback não é creditado. Evidência: `src/app/admin/kath-estetica/actions.ts:276-282`. Correção: somar os streams ou usar `.select()` + loop.

---

> **⚠️ Armadilha: tipagem `as never` (C5)**
>
> As tabelas mais novas da estética (`estetica_vehicle_types`, `estetica_service_prices`, `estetica_payment_rules`) não estão em `supabase/schema.sql` nem em `src/lib/supabase/database.types.ts`. Por isso, todo acesso a essas tabelas usa cast `as never` (`pricing.ts:27`, `:54`, `:90`). Isso desativa o type-safety do Supabase SDK. Para regenerar os tipos: `supabase gen types typescript --project-id <ID> --schema public > src/lib/supabase/types.ts`.

---

## 5. Módulo Loja

### O que é

E-commerce de produtos físicos da marca Kath (stickers, camisetas, acessórios, suplementos). Inclui vitrine com carrinho em `localStorage`, cotação de frete multi-provedor (Melhor Envio real + 99/Lalamove stubs), checkout com PIX Asaas, acompanhamento de pedidos e gestão de etiquetas (Melhor Envio).

### Como o gating de plano se aplica

Todos os usuários (inclusive `free`) podem comprar na loja. O plano influencia apenas o **desconto no preço**. O desconto é calculado server-side via `getStoreDiscountPct(planTier)` (de `plans.store_discount_pct`):

```typescript
// src/app/api/loja/checkout/route.ts:99
const discountPct = await getStoreDiscountPct(planTier);
// discountPct: 0 (free), 5 (acesso), 8 (plano1), 12 (plano2), 18 (plano3), 25 (atleta)
```

O cliente só envia `product_id + quantity`. O servidor recalcula tudo: preço unitário, desconto, subtotal, e aplica clamp de cashback.

### Estoque atômico

O decremento de estoque usa RPCs atômicas para evitar race condition:

```typescript
// src/app/api/loja/checkout/route.ts:141-152
// Decrementa atomicamente via RPC (UPDATE SET stock = stock - qty WHERE stock >= qty)
const { error: stockError } = await supabase.rpc("decrement_stock_batch", { items });
if (stockError) {
  // Estoque insuficiente — rola back
  await supabase.rpc("increment_stock_batch", { items: alreadyDecremented });
  return NextResponse.json({ error: "Produto sem estoque" }, { status: 409 });
}
```

O padrão `RPC para counter` é uma regra inegociável do handbook (§7): nunca SELECT-then-UPDATE para contadores.

### Fluxo de frete

```
POST /api/loja/shipping/quote
  → Melhor Envio /shipment/calculate (REAL, com token)
  → 99 Entrega /v1/deliveries/estimate (STUB: auth básico)
  → Lalamove /v3/quotations (STUB: HMAC literal "signature", lat/lng=0,0)
  → ordena por preço, retorna ao cliente
  → cliente seleciona → POST /api/loja/checkout envia shipping_cost_cents
```

> Os stubs de 99 e Lalamove são inertes. Nunca retornam erro — retornam array vazio. Melhor Envio é o único provedor funcional em produção.

### Cashback na loja

O cashback da loja é creditado **somente** quando o admin marca o pedido como `delivered` (não no pagamento). O fluxo:

```
PAYMENT_CONFIRMED webhook → orders.status = 'paid' (sem cashback aqui)
Admin updateOrderStatus('delivered') → creditWalletCents(user, amount, streamId)
```

### Arquivos de referência

- `src/app/(app)/loja/page.tsx:19` — vitrine (RLS filtra produtos ativos)
- `src/app/(app)/loja/store-grid.tsx:59` — carrinho client + checkout modal
- `src/app/api/loja/checkout/route.ts:11` — cria pedido (Zod + rate-limit + desconto + stock atômico)
- `src/app/api/loja/payment/route.ts:14` — gera PIX Asaas
- `src/app/api/loja/shipping/quote/route.ts:14` — cotação multi-provedor
- `src/lib/shipping/melhor-envio.ts` — integração real Melhor Envio
- `src/lib/shipping/local-delivery.ts` — 99 e Lalamove (stubs)
- `src/app/admin/loja/order-list.tsx:77` — gestão de pedidos admin
- `src/app/admin/actions.ts:567-726` — Server Actions de produtos e pedidos
- `supabase/migration_loja.sql` — tabelas `products` e `orders` + RLS

---

> **⚠️ Armadilha (C3): cashback gasto em pedido não pago**
>
> Em versões anteriores (e em parte do código atual), `spendWalletCents` era chamado em `POST /api/loja/checkout` na criação do pedido (`status=pending`), antes do PIX ser pago. Um cliente que gerava o PIX e abandonava perdia o cashback definitivamente (sem estorno automático).
>
> O cron `order-timeout` (`/api/cron/order-timeout`) cancela pedidos pendentes há >24h, mas o estorno de cashback dentro dele precisava estar implementado corretamente. Verifique a lógica atual em `src/app/api/cron/order-timeout/route.ts` antes de assumir que está corrigido.

---

> **⚠️ Armadilha: double-credit de cashback ao re-salvar pedido**
>
> A action `updateOrderStatus` em `src/app/admin/actions.ts:673-719` credita cashback quando o status muda para `delivered`. Se o admin clicar em "Entregue" duas vezes (ou o status for salvo de `delivered` para `delivered` novamente), `creditWalletCents` é chamado sem verificar se o crédito já foi emitido para aquele `revenue_stream_id`.
>
> A proteção definitiva é a guarda de idempotência já existente em `creditWalletCents` (`src/lib/billing/wallet.ts:80-86`): ela verifica `source_revenue_stream_id` antes de creditar. Garanta que `sourceStreamId` correto seja passado sempre.

---

## 6. Transversais

As features transversais cruzam todos os produtos. Elas compartilham infraestrutura de plano, pagamento, push e comissões.

---

### 6.1 Consultoria VIP

**O que é**: consultoria personalizada (treino + dieta) montada pela Kath dentro do app — sem PDF (regra do handbook §10). O assinante preenche anamnese de 7 etapas; a Kath monta o plano em JSONB e entrega no app.

**Gating de plano**: a consultoria é criada automaticamente pelo webhook Asaas quando o pagamento de `plano2`, `plano3` ou `atleta` é confirmado (`ensureConsultationForTier`). Para `plano2`/`plano3`: `package_type = 'mensal'`. Para `atleta`: `package_type = 'premium'`. O admin também pode criar manualmente para qualquer usuário.

A tela do usuário (`/consultoria`) tem 4 estados conforme `consultations.status`:

```
sem consultoria → anamnese pendente (status=pending, anamnesis=null)
→ em progresso (status=in_progress)
→ entregue (status=delivered) — renderiza treino + dieta nativos
```

**Conteúdo in-app**: o `workout_plan` é um JSONB com `weeks[].days[].exercises[]`; o `diet_plan` é `meals[].foods[]`. Ambos renderizados via componentes React nativos. `ExerciseCard` (`src/app/(app)/consultoria/exercise-card.tsx:35`) suporta `youtube_id` para exercises com vídeo (inclusive `short:` prefix para Shorts).

**Arquivos**:
- `src/app/(app)/consultoria/page.tsx:30` — hub (4 estados)
- `src/app/(app)/consultoria/anamnese/anamnese-form.tsx:72` — 7 steps (1145 linhas)
- `src/app/admin/consultorias/[id]/plan-editor.tsx:135` — editor admin (1002 linhas)
- `src/lib/validations.ts:71-80` — `updateConsultationSchema`
- `supabase/migration_consultations_inapp.sql` — drop de colunas PDF, add de JSONB

---

> **⚠️ Armadilha: anamnese sem validação Zod server-side**
>
> `POST /api/consultoria/anamnese` (`src/app/api/consultoria/anamnese/route.ts:18-22`) verifica apenas a presença de `consultationId` e `anamnesis`, mas não valida a estrutura interna do payload (28+ campos chegam como `Record<string, unknown>`). Isso viola o handbook §3 e pode gravar dados malformados em JSONB. A correção é criar um `anamnesisSchema` em `src/lib/validations.ts`.

---

### 6.2 Cupons

**O que é**: cupons de desconto exclusivos negociados com marcas parceiras, com gating por plano, contagem regressiva para Flash Deals e contagem de usos.

**Gating de plano**: via RLS `coupons_select_by_plan` — o usuário só vê cupons cujo `required_plan` está no seu nível ou abaixo. O helper SQL `plan_tier_level()` faz a comparação. O incremento de uso é atômico via RPC `increment_coupon_uses` (padrão handbook §7).

**Fluxo do usuário**:
1. Acessa `/cupons` — RLS filtra automaticamente
2. Clica "Copiar" → `navigator.clipboard.writeText(code)` + `POST /api/coupon/use` (fire-and-forget)
3. Clica "Ir para a loja" → `window.open(partner_url)` com `noopener,noreferrer`

O desconto é aplicado **no site do parceiro** (o app não tem checkout para cupons). O KathApp só rastreia o clique.

**Arquivos**:
- `src/app/(app)/cupons/page.tsx:12`
- `src/components/coupons/coupon-card.tsx:23`
- `src/app/api/coupon/use/route.ts:10`
- `src/lib/validations.ts:25-36` — `createCouponSchema`
- `supabase/migrations/20260101000000_initial_schema.sql:521-534` — RPC `increment_coupon_uses`

---

> **⚠️ Armadilha: forms admin de cupom oferecem slug `"vip"` como opção**
>
> `src/app/admin/cupons/coupon-form.tsx:116` e `src/app/admin/afiliados/affiliate-form.tsx:128` ainda listam `"vip"` como opção de `required_plan`. Como `plan_tier_level("vip")` retorna 0 (slug não existe), um cupom criado como "VIP-only" se torna público — visível para todos os tiers. Corrija os selects para usar os 6 slugs reais (`free`, `acesso`, `plano1`, `plano2`, `plano3`, `atleta`).

---

### 6.3 Afiliados

**O que é**: vitrine de produtos recomendados pela Kath (Amazon, Mercado Livre, Shopee, parceiros diretos) com links externos. Admin cadastra; assinante clica.

**Gating de plano**: via RLS `affiliates_select_by_plan` — mesma lógica de `plan_tier_level`. Um link com `required_plan = 'plano2'` só aparece para assinantes plano2+.

**Contador de cliques**: incremento atômico via RPC `increment_affiliate_clicks(link_id)` (`schema.sql:512`). Porém a rota atual (`/api/affiliate/click`) faz SELECT + UPDATE manual, ignorando a RPC existente. Substituir pelo `supabase.rpc("increment_affiliate_clicks", { link_id })` elimina a condição de corrida.

**Limite FREE**: a auditoria (P1) apontou que `monthly_usage` nunca é lido nem escrito — o limite de 3 cliques/mês para `free` está totalmente inoperante.

**Arquivos**:
- `src/app/(app)/afiliados/page.tsx:12`
- `src/components/affiliates/affiliate-card.tsx:27`
- `src/app/api/affiliate/click/route.ts:10`
- `src/lib/validations.ts:39` — `createAffiliateSchema`
- `supabase/schema.sql:512-523` — RPC `increment_affiliate_clicks`

---

### 6.4 Chat VIP

**O que é**: canal de mensagens diretas entre assinantes Plano 3+ e a equipe (Kath ou Sidney), com Supabase Realtime para streaming em tempo real.

**Gating de plano**: exige `plano3` ou `atleta`. O gate é duplo: verificado no Server Component antes de renderizar o `ChatRoom`, e enforçado pela RLS `messages_insert_chat` no banco (impede inserção direta de mensagens por tiers inferiores):

```typescript
// src/app/(app)/chat/page.tsx:27
if (!hasPlanAccess(profile?.plan_tier, "plano3")) {
  return <UpsellCard />;
}
```

**Realtime**: o hook `useRealtimeMessages` (`src/hooks/use-realtime-messages.ts`) usa `postgres_changes` do Supabase para receber mensagens em tempo real no browser. O admin responde pelo canal `admin-chat-${userId}`.

**SLA**: Plano 3 tem SLA de 48h; Atleta tem SLA de 12h prioritário + vídeo 1-1 mensal. Esses SLAs são informativos — não enforçados em código, dependem de processo da equipe.

**Arquivos**:
- `src/app/(app)/chat/page.tsx:14`
- `src/app/(app)/chat/chat-room.tsx:13`
- `src/app/admin/chat/admin-chat-inbox.tsx:21`
- `src/hooks/use-realtime-messages.ts:19`
- `supabase/migrations/20260101000000_initial_schema.sql:293-326` — tabela `messages` + RLS

---

> **⚠️ Armadilha: admin chat quebrado por RLS**
>
> `admin-chat-inbox.tsx` usa `useSupabase()` (cliente browser autenticado) para inserir respostas. A policy `messages_insert_vip` exige `plan_tier = 'vip'` (slug morto) ou `plano3+`. Se o usuário admin não tiver `plan_tier = 'plano3'` em `profiles`, o INSERT falha silenciosamente.
>
> A correção correta: mover o envio de respostas admin para uma Server Action que use `createAdminSupabaseClient()`, que passa pela policy `messages_admin` (`service_role`). Nunca use browser client para operações que requerem service_role.

---

### 6.5 Push / Notificações

**O que é**: sistema de Web Push (VAPID) + notificações in-app, usado por todos os módulos para eventos (pagamento confirmado, treino publicado, pedido enviado, fidelidade desbloqueada, consultoria entregue).

**Arquitetura**:

```
Evento de domínio (server action / webhook)
  → notifyUser(userId, payload)    [1 usuário]
  → notifyByPlan(minPlan, payload) [todos de um tier]
  → notifyAll(payload)             [broadcast]

Cada função:
  1. INSERT em `notifications` (canal in-app, RLS select_own)
  2. sendPushToUser/sendPushBroadcast (VAPID via web-push)
     → lê push_subscriptions (service_role)
     → webPush.sendNotification() para cada endpoint
     → Promise.allSettled (não falha tudo por 1 erro)
```

**Gating**: `notifyByPlan` filtra `profiles.plan_tier` para enviar push apenas a tiers qualificados. Ex.: ao publicar treino PRO, só assinantes `plano1+` recebem.

**Problema crítico — `notifyAdmins` é no-op**: `team_members` são semeados sem `clerk_user_id`. Como a lookup de push é por `user_id` (Clerk id), alertas de booking, mensagem VIP e pagamento caem silenciosamente. Solução: linkar `clerk_user_id` nos registros de `team_members`.

**Problema — hook órfão**: `src/hooks/use-push-subscribe.ts` está implementado mas não consumido por nenhum componente. Sem o CTA de "Ativar notificações", `push_subscriptions` permanece vazia e nenhum push é entregue.

**Arquivos**:
- `src/lib/notifications.ts` — `notifyUser`, `notifyByPlan`, `notifyAll`
- `src/lib/push/webpush.ts` — `sendPushToUser`, `sendPushBroadcast`
- `src/app/api/push/subscribe/route.ts` — POST/DELETE subscription
- `src/app/api/push/send/route.ts` — disparo admin
- `public/sw.js` — Service Worker (push + notificationclick)
- `supabase/migration_notifications.sql` — `push_subscriptions` + `notifications`

---

### 6.6 Cashback / Wallet

**O que é**: sistema interno de cashback por plano — cada compra confirmada gera créditos na wallet do usuário, que podem ser gastos em compras futuras na Loja ou Estética (não em mensalidade).

**Regras**:

| Regra | Valor |
|-------|-------|
| Quando é creditado | Mensalidade: imediato no webhook. Loja: ao mudar para `delivered`. Estética: ao mudar para `done`. |
| Validade | 120 dias por crédito (FIFO no consumo) |
| Gasto em | Loja + Estética apenas |
| Limite por transação | Até 50% do `gross_cents` da compra |
| Cashback sobre cashback | Não — base é o `amount_paid_cash` |

**Stack de RPCs SQL** (todas `SECURITY DEFINER`):

```sql
credit_wallet_cents(p_user_id, p_amount, p_source_stream_id, p_validity_days)
spend_wallet_cents(p_user_id, p_amount, p_revenue_stream_id) -- FOR UPDATE (serialização)
wallet_active_cents(p_user_id) → int
expire_wallet_credits() → int  -- chamado pelo cron diário
```

**Wrappers TypeScript** em `src/lib/billing/wallet.ts`: `creditWalletCents`, `spendWalletCents`, `getWalletActiveCents`, `expireWalletCredits`.

Ambos `creditWalletCents` e `spendWalletCents` têm idempotência por `source_revenue_stream_id` — protege contra reprocessamento de webhook.

---

### 6.7 Comissões e Equipe

**O que é**: split automático de receita entre sócios (Russo, Sidney, Kath) a cada transação confirmada. Toda transação que gera dinheiro cria um `revenue_streams` row → `compute_commissions(stream_id)` aloca `commission_allocations` por `commission_rules` ativas.

**Modelo**:

```
revenue_streams (uma linha por transação confirmada)
  type: mensalidade | loja | estetica | afiliado_externo
  category: slug do plano (mensalidade) | módulo (loja/estética)
  gross_cents, cost_cents → net_cents (gerado, CHECK cost <= gross)

commission_rules (regras editáveis em /admin/team/regras)
  team_member_id + applies_to_type + applies_to_category + pct + vigência

compute_commissions(revenue_stream_id) → int (RPC)
  1. Itera rules ativas que matcham (type, category)
  2. Aloca pct * net_cents para partner/consultant
  3. Residual para owner (net_cents − soma explícitas − cashback_usado)
```

**Splits atuais** (defaults seed):

| Receita | Russo | Sidney | Kath |
|---------|:-----:|:------:|:----:|
| Mensalidade `acesso` | 25% | 0% | 75% |
| Mensalidade `plano1+` | 25% | 30% | 45% |
| Loja, Estética, Afiliado | 25% | 0% | 75% |

**Admin**:
- `/admin/financeiro/comissoes` — lista allocations, aprova lote, marca pago
- `/admin/team` — CRUD team_members (com `clerk_user_id` para push)
- `/admin/team/regras` — CRUD commission_rules

**Arquivos**:
- `src/lib/billing/commissions.ts` — `computeCommissions`, `listAllocations`, `approveAllocations`
- `src/lib/billing/revenue.ts` — `recordRevenueStream`
- `supabase/migration_modelo_financeiro.sql` — schema completo (637 linhas)
- `docs/wiki/plataforma/financeiro.md` — documentação completa do modelo

---

> **⚠️ Armadilha: revenue_stream + compute_commissions não são transacionais**
>
> `recordRevenueStream` insere em `revenue_streams` e depois chama `computeCommissions` em código TypeScript (`src/lib/billing/revenue.ts:33`). Se o processo morrer entre o INSERT e a RPC, o stream fica sem allocations. A correção é um trigger `AFTER INSERT` em `revenue_streams` que chama `compute_commissions` automaticamente no Postgres. Enquanto não implementado, o painel financeiro pode mostrar streams sem distribuição de comissão.

---

## 7. Exercícios

### Exercício 1 — Gating Seguro

Dado o código abaixo (extraído de uma página hipotética), identifique todos os erros e reescreva-o corretamente:

```typescript
// Código com problemas
const { data: profile } = await supabase.from("profiles").select("plan_tier").single();

if (profile?.plan_tier === "vip") {
  return <PremiumContent />;
}
if (profile?.plan_tier === "pro" || profile?.plan_tier === "start") {
  return <MidContent />;
}
return <FreeContent />;
```

**Dica**: use `hasPlanAccess` de `src/lib/billing/access.ts`. Considere que "premium" exige `plano3+` e "mid" exige `plano1+`.

---

### Exercício 2 — Adicionando um Tier

O time decide criar um tier `"elite"` entre `plano3` e `atleta` (level 4.5 → usar 5, empurrando `atleta` para 6). Liste todas as mudanças necessárias:

1. Qual arquivo TypeScript precisa ser atualizado primeiro?
2. Qual migration SQL é necessária? Dê o CHECK constraint correto para `plans.slug`.
3. Por que simplesmente adicionar `elite: 5` e `atleta: 6` em `PLAN_LEVELS` **quebra** assinantes existentes do `atleta` no Asaas?
4. Como `planTierFromValue` se comporta para um pagamento de R$ 309,90 (valor antigo do atleta) se o banco for atualizado com `atleta.asaas_value = 409,90`?

---

### Exercício 3 — Estética: Nova Regra de Sinal

O serviço "Vitrificação Completa" precisa exigir 50% de sinal obrigatório no app para motos do tipo `touring`. Descreva:

1. Qual tabela recebe a configuração do sinal?
2. Qual campo controla se o sinal é obrigatório vs opcional?
3. No fluxo de booking, em qual linha do `route.ts` o valor do sinal é calculado?
4. O Asaas webhook recebe dois pagamentos (sinal + restante). Como o handler distingue qual é qual?

---

### Exercício 4 — Diagnóstico de Bug de Cashback

Um usuário reporta que comprou na loja, pagou R$ 200, e seu saldo de cashback não mudou. Descreva o passo-a-passo de diagnóstico:

1. Verifique se `orders.status` chegou a `'delivered'` (onde isso acontece no código?).
2. Verifique se `revenue_streams` tem uma row para esse pedido e qual `status` ela tem.
3. Verifique se `commission_allocations` têm rows para esse `revenue_stream_id`.
4. Verifique se `wallet_credits` tem alguma row com `source_revenue_stream_id` apontando para esse stream.
5. Se tudo acima existir mas o saldo for zero: qual cron pode estar expirando créditos prematuramente?

---

### Exercício 5 — Walk-in vs Booking Online

Explique a diferença de fluxo entre um agendamento online e um walk-in presencial respondendo:

1. Qual é a tabela destino de cada um?
2. Por que o walk-in não usa Asaas?
3. O walk-in contribui para o programa de fidelidade? Em qual tabela isso seria registrado?
4. Um desenvolvedor propõe unificar as duas tabelas em uma. Quais colunas são incompatíveis? Quais riscos de RLS esse merge traria?

---

*Fim do Módulo 4.*

> **Próximo**: Módulo 5 — Infraestrutura, Deploy & Operação.
