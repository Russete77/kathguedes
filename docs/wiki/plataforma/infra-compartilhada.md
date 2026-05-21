# Setor: Infra Compartilhada

## 1. Visão geral
- **Propósito:** Camada transversal de infraestrutura do KathApp — clientes Supabase (browser/server/admin), validação de env vars, rate limiting global, tratamento padronizado de erros de API, schemas Zod centrais, utilitários (cn, YouTube) e o schema base do Postgres com helpers/RLS/triggers compartilhados.
- **Quem usa:** Infra (consumido por todos os domínios — Fitness, Loja, Estética, Consultoria, Cupons, Afiliados, Push, Auth/Onboarding).
- **Status percebido:** production. Contém pontos de alerta (TODOs em `database.types.ts` "manual"/"types em runtime", `validations.test.ts` com cobertura parcial, fallback in-memory do rate limiter quando `REDIS_URL` ausente, Sentry carregado dinamicamente).

## 2. Rotas
- N/A — infraestrutura não tem rotas próprias.

## 3. Componentes
- N/A — sem componentes UI (apenas helpers `lib/`).

## 4. Server Actions / API Routes
- N/A — não há rotas/actions próprias do setor. Os helpers (`createServerSupabaseClient`, `createAdminSupabaseClient`, `useSupabase`, `handleApiError`, `checkRateLimitAsync`, `checkRateLimit`, `parseFormData`, `cn`, `extractYoutubeId`, `youtubeThumbnail`) são consumidos pelas rotas de cada domínio. Veja "Bibliotecas e seu uso" na seção 8.

## 5. Modelo de dados
### Patterns globais

#### Convenções de naming (`supabase/schema.sql`)
- **Tabelas em `public.*`**, snake_case, plural (`profiles`, `workout_videos`, `consultations`, `workout_logs`, `affiliate_links`, `coupons`, `messages`, `products`, `orders`, `push_subscriptions`, `notifications`, `coupon_uses`, `plan_templates`, `webhook_events`, `moto_events`, `challenges`, `challenge_participants`).
- **PK**: `uuid primary key default gen_random_uuid()` (`schema.sql:87`, `:129`, `:180`, etc.). Exceção: `profiles.id` é `text primary key` porque guarda diretamente o Clerk `user_id` (formato `user_xxx`) (`schema.sql:32`).
- **FKs para usuário**: `user_id text not null references public.profiles(id)` — `text` (não uuid) por causa do Clerk (`schema.sql:130`, `:181`, `:297`, `:373`).
- **Cascade delete** em tabelas dependentes do user: `push_subscriptions`, `notifications`, `coupon_uses`, `challenge_participants` usam `on delete cascade` (`schema.sql:414`, `:448`, `:483`, `migration_fixes.sql:111`).
- **Timestamps**: `created_at timestamptz not null default now()` em todas as tabelas com histórico; `updated_at` apenas em `orders` (`schema.sql:384`) e `plan_templates` (`schema.sql:537`).
- **Money**: armazenado como `int` em **centavos** (sufixo `_cents`): `price_cents`, `subtotal_cents`, `discount_cents`, `total_cents`, `shipping_cost_cents`, `compare_price` (`schema.sql:337-378`).
- **Enum-like**: implementados como `text not null check (col in (...))` ao invés de tipos `enum` Postgres — facilita migrations (`schema.sql:35`, `:91-94`, `:131-135`, etc.).
- **JSONB livre**: `anamnesis`, `workout_plan`, `diet_plan`, `variants`, `items`, `shipping_info`, `data` (`schema.sql:136-138`, `:342`, `:376-380`, `:534`).
- **Arrays Postgres**: `interests text[] not null default '{}'` em `profiles` (`schema.sql:44`).
- **Sort/order**: campo `sort_order int not null default 0` em listas curáveis (`affiliate_links`, `products`) (`schema.sql:226`, `:348`).

#### Helpers SQL globais
- **`public.plan_tier_level(tier text) returns int`** (`schema.sql:13-25`): mapeia `free=0, start=1, pro=2, vip=3` para permitir comparação numérica (`>=`) dentro de policies — base de todo gating por plano.
- **`public.increment_views()`** trigger function (`schema.sql:579-590`): incrementa `workout_videos.views_count` em cada `workout_logs` insert (trigger `on_workout_log_insert`, `schema.sql:592-595`).
- **`public.increment_coupon_uses(coupon_id uuid)`** (`schema.sql:598-610`): increment atômico com guard `is_active` e `max_uses`.
- **`public.increment_affiliate_clicks(link_id uuid)`** (`schema.sql:512-523`): RPC `security definer` para clicks atômicos.
- **`public.decrement_stock(p_product_id uuid, p_quantity int)`** e **`public.increment_stock(...)`** (`migration_fixes.sql:27-47`): decremento atômico de estoque com `WHERE stock >= quantity` e `RAISE EXCEPTION` se insuficiente — evita race condition no checkout.

#### Padrão de RLS
- **Toda tabela tem `enable row level security`** logo após o `create table` (`schema.sql:48`, `:104`, `:147`, etc.).
- **Identificação do usuário** dentro de policies: `(select auth.jwt()->>'sub')` — `sub` do JWT é o Clerk user ID (formato `user_xxx`). Não há custom helper SQL — é uma chamada inline reaproveitada (`schema.sql:54`, `:60`, `:153`, etc.).
- **Quatro policies-padrão por tabela**:
  1. `<entidade>_select_own` para `to authenticated` quando user vê só seu (`schema.sql:51-54`, `:150-153`, `:189-193`).
  2. `<entidade>_insert_own` com `with check ((select auth.jwt()->>'sub') = user_id)` (`schema.sql:156-159`, `:196-199`).
  3. `<entidade>_update_own` com `using` + `with check` (`schema.sql:57-61`, `:162-166`, `:464-468`).
  4. `<entidade>_admin` para `to service_role` com `for all using(true) with check(true)` — bypass total (`schema.sql:69-80`, `:118-122`, `:169-173`).
- **Catálogo público gated por plano** (treinos, afiliados, cupons): policy `_select_by_plan` faz join com `profiles` para obter o `plan_tier` do usuário e compara via `plan_tier_level()` (`schema.sql:107-122`, `:232-247`, `:273-289`).
- **VIP-only**: `messages_insert_vip` exige `plan_tier = 'vip'` no `with check` (`schema.sql:313-319`).
- **Loja**: `products_select_active` permite qualquer authenticated ver produtos com `is_active = true` (`schema.sql:355-358`).
- **`auth.jwt()->>'sub'` como default em colunas** `user_id` (em `workout_logs` e `messages`) — economiza precisar setar o id manualmente no insert (`schema.sql:181`, `:297`).

#### Tabelas genuinamente compartilhadas / infra
Estas não pertencem a um domínio específico:
- **`webhook_events`** (`migration_fixes.sql:57-61`): tabela de **idempotência** para webhooks (PK = `payment_id`, ignora replays). Consumida por `src/app/api/webhook/asaas/route.ts` e citada em `src/app/api/health/route.ts`. Documentada plenamente no setor de Pagamentos/Asaas.
- **`plan_templates`** (`schema.sql:529-538`, índice `:571`): templates de workout/diet usados pelo painel admin de consultoria (RLS apenas service_role, `templates_admin`). Documentada no setor Consultoria/Admin.
- **`profiles`** é compartilhada (Clerk user ↔ Asaas customer ↔ plan_tier) e funciona como hub do JWT — referenciada via FK por quase todas as tabelas. Documentada no setor de Auth/Onboarding.

> **Tabelas de domínio** (`workout_videos`, `workout_logs`, `consultations`, `affiliate_links`, `coupons`, `coupon_uses`, `messages`, `products`, `orders`, `push_subscriptions`, `notifications`, `moto_events`, `challenges`, `challenge_participants`) não são detalhadas aqui — apenas citadas para contextualizar os patterns. Cada setor de domínio é dono.

## 6. Integrações externas

### Supabase (Postgres + RLS) com Clerk como auth provider
- **Project ID** (citado em comentário): `auplhaxwaecsppqizxej` (`src/lib/supabase/client.ts:12`, `server.ts:9`).
- **Browser client** — `useSupabase()` hook React (`src/lib/supabase/client.ts:14-30`):
  - Usa `useSession()` do Clerk (`@clerk/nextjs`) para obter token.
  - `createClient<Database>(URL, ANON_KEY, { async accessToken() { return session?.getToken() ?? null } })`.
  - Memorizado por `session` via `useMemo`.
  - Marcado `"use client"` (`client.ts:1`).
- **Server client** — `createServerSupabaseClient()` (`src/lib/supabase/server.ts:11-21`):
  - Async; usa `auth()` de `@clerk/nextjs/server` para obter token via `(await auth()).getToken()`.
  - Mesmas envs públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — RLS depende do JWT do Clerk.
- **Admin client** — `createAdminSupabaseClient()` (`src/lib/supabase/server.ts:29-36`):
  - **Bypassa RLS** usando `SUPABASE_SERVICE_ROLE_KEY`.
  - Lança erro explicito se URL ou key faltarem (`server.ts:32-34`).
  - **APENAS** para webhooks, cron, operações admin (comentário `:24-27`).
- **Integração JWT**: Supabase valida o JWT do Clerk via JWKS — integração nativa "third-party auth" (sem custom JWT secret); o claim `sub` vira o `user_id` que as policies usam (`auth.jwt()->>'sub'`).
- **Geração de types**: `npx supabase gen types typescript --project-id auplhaxwaecsppqizxej > src/lib/supabase/database.types.ts` (`client.ts:12`, `server.ts:9`). O arquivo gerado tem 1225 linhas (`database.types.ts`); `types.ts` mantém uma tipagem "manual" paralela com domínios narrow (`PlanTier`, `WorkoutCategory`, `ConsultationStatus`, `OrderStatus`, etc.) e contratos JSON (`WorkoutPlan`, `DietPlan`, `OrderItem`, `ShippingInfo`) — `types.ts:10-248`.

### YouTube
- **Sem SDK / sem API key** — apenas parsing client-side de URL/ID e geração de URL de thumbnail estática:
  - `extractYoutubeId(input: string)` (`src/lib/youtube/embed.ts:9-42`): aceita ID puro, `youtu.be/ID`, `youtube.com/watch?v=ID`, `embed/`, `shorts/`, `v/`. Tem fallback regex para qualquer string.
  - `youtubeThumbnail(youtubeId, quality?)` (`embed.ts:48-55`): mapeia `maxres | hq | mq` para `maxresdefault | hqdefault | mqdefault` em `https://img.youtube.com/vi/{id}/{q}.jpg`.
- **Consumidores**: `src/app/admin/actions.ts` (form de criação de workout) e `src/lib/youtube/embed.ts` (auto-uso). Os componentes do domínio Fitness (`src/components/fitness/video-player.tsx`) reutilizam estes helpers para gerar embeds.

### Redis (rate limiter)
- Driver: `ioredis` (`src/lib/rate-limit.ts:10`).
- Conexão **lazy/singleton** com `connectTimeout: 3000`, `maxRetriesPerRequest: 1`, `lazyConnect: true` (`rate-limit.ts:27-31`). Hospedado no Railway (comentário `:3`).
- Falha ao conectar → fallback in-memory automático (`rate-limit.ts:38-42`).

### Sentry (opcional)
- Carregado **dinamicamente** via `import("@sentry/nextjs")` apenas se `SENTRY_DSN` estiver setado (`src/lib/api-error.ts:16-28`). Pacote opcional — se não instalado, degrada para `console.error` puro (`api-error.ts:21`).

## 7. Validações

Schemas Zod centrais em `src/lib/validations.ts` (todos exportados, mesmo que consumidos por outros setores):

- **`planTierSchema`** (`src/lib/validations.ts:4`) — `z.enum(["free", "start", "pro", "vip"])`. Reutilizado nos demais schemas como `required_plan`.
- **`createWorkoutSchema`** (`src/lib/validations.ts:7-22`) — `title` (1-200), `description?` (≤2000), `youtube_id` (1-500), `category` enum com 17 valores (`gluteo`, `pernas`, `costas`, `ombro`, `biceps`, `triceps`, `peito`, `abdomen`, `superior`, `hiit`, `cardio`, `funcional`, `full`, `alongamento`, `aquecimento`, `viagem`, `competicao`), `level` enum (`iniciante`/`intermediario`/`avancado`), `duration_minutes` (1-300), `required_plan` default `free`, `is_published` default `false`, `is_short` default `false`, `notes?` (≤2000). Coerce em number/boolean para FormData.
- **`createCouponSchema`** (`src/lib/validations.ts:25-36`) — `title` (1-200), `code` (1-50, uppercase via `transform`), `discount_pct?` (0-100, opcional/nullable), `partner_name`, `partner_url` (url), `module` enum (`fitness`/`moto`/`geral`), `required_plan`, `max_uses?`, `valid_until` (string), `is_flash` default `false`.
- **`createAffiliateSchema`** (`src/lib/validations.ts:39-48`) — `title`, `description?`, `image_url` (url), `module` enum (`fitness`/`moto`), `category`, `platform` enum (`amazon`/`mercadolivre`/`shopee`/`direto`), `affiliate_url` (url), `required_plan`.
- **`createProductSchema`** (`src/lib/validations.ts:51-68`) — `title`, `description?`, `image_url` (url), `price` (>0.01), `compare_price?`, `category`, `module` (default `geral`), `stock` (default 0), **dimensões para frete**: `weight_kg` default 0.5, `height_cm` default 10, `width_cm` default 20, `length_cm` default 30, e descontos por plano (`discount_start`/`discount_pro`/`discount_vip` em %).
- **`updateConsultationSchema`** (`src/lib/validations.ts:71-80`) — `workout_plan?`/`diet_plan?` como `z.unknown()` (JSON livre validado fora do Zod), macros diários, `status` enum (`pending`/`in_progress`/`delivered`/`expired`), `notes_admin?` (≤5000).
- **`updateOrderStatusSchema`** (`src/lib/validations.ts:83-87`) — `id` uuid, `status` enum (`pending`/`paid`/`shipped`/`delivered`/`canceled`), `trackingCode?` (≤100).
- **`parseFormData<T>(schema, formData)`** (`src/lib/validations.ts:90-96`) — helper genérico que converte `FormData` em objeto, transformando string vazia em `null` e roda `schema.parse()`. Pattern usado em todas as Server Actions admin.

**Cobertura de testes** (`src/lib/validations.test.ts`): casos felizes e de rejeição para `createWorkoutSchema`, `createCouponSchema`, `createAffiliateSchema`, `createProductSchema`, `updateConsultationSchema` (`validations.test.ts:10-175`). `updateOrderStatusSchema` e `parseFormData` **não** têm testes ainda.

### Validação de variáveis de ambiente
- **`src/lib/env.ts`** centraliza lookups com fail-fast:
  - `required(name)` (`env.ts:6-12`) — joga `Error` na ausência.
  - `optional(name, fallback)` (`env.ts:14-16`) — fallback string.
  - `requiredInProduction(name)` (`env.ts:23-35`) — exige só quando `NODE_ENV=production` E `VERCEL_ENV !== "preview"`. Útil para `REDIS_URL` (rate limit funciona in-memory em dev) e `SENTRY_DSN` (não queremos enviar erros de dev).
  - `env` é objeto **com getters** (`env.ts:37-74`): public vars (`NEXT_PUBLIC_*`) são strings imediatas; secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `VAPID_PRIVATE_KEY`, `REDIS_URL`, `SENTRY_DSN`) só validam no acesso. `ASAAS_ENV` default `sandbox`, `VAPID_EMAIL` default `mailto:contato@kathapp.com`.

## 8. Bibliotecas e seu uso

### `src/lib/supabase/`
- **`client.ts` — `useSupabase()`**: hook React Client Component. Consumido por componentes interativos (chat em tempo real, toggles de favorito, etc.). Por exemplo, `src/hooks/use-realtime-messages.ts`, `src/app/admin/chat/admin-chat-inbox.tsx`.
- **`server.ts` — `createServerSupabaseClient()`**: Server Components, Route Handlers e Server Actions de **todos** os setores. Aparece em ~50 arquivos (admin, app, api). Consumido em `src/app/api/loja/checkout/route.ts`, `src/app/(app)/dashboard/page.tsx`, `src/app/api/consultoria/anamnese/route.ts`, etc.
- **`server.ts` — `createAdminSupabaseClient()`**: bypass RLS. Consumido por `src/app/api/webhook/asaas/route.ts`, `src/lib/notifications.ts`, `src/lib/push/webpush.ts`, `src/app/api/health/route.ts`.
- **`types.ts` — `Database`/contracts**: tipagem manual com domínios estreitos e contratos JSON. Importado pelas tipagens de Server Actions e helpers.
- **`database.types.ts`**: types gerados via supabase CLI. Usado pelo generic `createClient<Database>(...)`.

### `src/lib/env.ts`
Importado em ~15 lugares — sempre que houver acesso a secret server-side. Demais arquivos lêem `process.env.*` direto (especialmente vars `NEXT_PUBLIC_*` e `ASAAS_*`).

### `src/lib/rate-limit.ts`
Consumido por endpoints sensíveis a abuso:
- `src/app/api/loja/checkout/route.ts`
- `src/app/api/estetica/bookings/route.ts`
- `src/app/api/affiliate/click/route.ts`
- `src/app/api/checkout/subscribe/route.ts`
- `src/app/api/loja/shipping/quote/route.ts`
- `src/app/api/push/send/route.ts`

Default: **30 requests / 60s** por chave. Sliding window via Redis (ZSET com `zremrangebyscore` + `zcard` + `zadd` em pipeline atômico, `rate-limit.ts:104-122`). Fallback in-memory token bucket com cleanup a cada 5 min (`rate-limit.ts:156-168`).

### `src/lib/api-error.ts`
**Único consumidor direto** é o próprio módulo (descoberto via grep: `Found 1 file: src\lib\api-error.ts`). Apesar de exportado, parece **subutilizado** — a maioria das routes faz `try/catch` próprio com `NextResponse.json({ error })`. Oportunidade de padronização.

### `src/lib/validations.ts`
Importado por:
- `src/app/admin/actions.ts` (server actions admin: criar workout/coupon/affiliate/product, atualizar consultation/order)
- `src/lib/validations.test.ts` (vitest)

> Validações de **outros domínios** (Estética, Loja checkout, Onboarding, Asaas) ficam em arquivos próprios — este não é o único ponto de validação.

### `src/lib/utils.ts`
`cn(...inputs)` (combina `clsx` + `tailwind-merge`) — usado em ~36 arquivos, em todos os componentes UI (`src/components/ui/*`), layout, fitness, coupons, admin e formulários.

### `src/lib/youtube/embed.ts`
- `extractYoutubeId` consumido por `src/app/admin/actions.ts` ao salvar workout (normaliza qualquer formato para o ID puro).
- `youtubeThumbnail` consumido pelos componentes de listagem em Fitness (cards, players).

## 9. Observações (notas para Fase B — não auditar agora)

- **Duas tipagens paralelas do Supabase**: `src/lib/supabase/types.ts` (manual, narrow) coexiste com `src/lib/supabase/database.types.ts` (gerado, 1225 linhas). O comentário em `types.ts:1-8` indica intenção de migrar. **Risco**: drift entre ambas. Os enums string como `PlanTier`, `WorkoutCategory`, etc. estão **só** em `types.ts`; o gerado usa `string` puro.
- **`createAdminSupabaseClient` aceita `<Database>` mas o comentário diz "types inferidos em runtime"** (`server.ts:28`). Comentário e código divergem (`server.ts:35` passa o generic explicitamente).
- **`api-error.ts` praticamente não é consumido**. A grep retorna apenas o próprio arquivo. Padronizar os ~40+ try/catch espalhados nas routes seria ganho real (logs estruturados + Sentry).
- **`@sentry/nextjs` é dependência opcional** (`api-error.ts:21-22`). Em produção sem o pacote instalado, erros caem só no console do Vercel.
- **Rate limiter in-memory em ambiente serverless multi-instância**: o limite efetivo passa a ser `N x maxRequests` quando `REDIS_URL` falha (`env.ts:55-62` documenta isso). `requiredInProduction` deveria garantir, mas o `getRedis()` ainda tem fallback silencioso (`rate-limit.ts:21-24`) — em prod, a falha de conexão também cai pro in-memory (`:38-42`), o que pode ser indesejado.
- **`validations.test.ts` cobre 5 dos 7 schemas** — faltam `planTierSchema` e `updateOrderStatusSchema` e o helper `parseFormData`.
- **`createWorkoutSchema` aceita 17 categorias** (`validations.ts:11-15`), mas o **DB constraint** em `workout_videos.category` aceita apenas 6 (`gluteo`/`pernas`/`superior`/`hiit`/`full`/`viagem`) — `schema.sql:91-92`. Discrepância grave que vai gerar erro 500 ao tentar criar workout com categorias novas (`costas`, `ombro`, `biceps`, etc.). Provável fonte de bug a auditar.
- **`createWorkoutSchema` valida `is_short` e `notes`** (`validations.ts:19-21`), colunas adicionadas via `migration_fixes.sql:12-13`. OK.
- **`createProductSchema` valida `weight_kg`/`height_cm`/`width_cm`/`length_cm`** (`validations.ts:60-64`), colunas adicionadas via `migration_audit_fixes.sql:9-13`. OK.

### Migrations de fixes (hotfixes globais)

#### `supabase/migration_fixes.sql` (Março 2026)
- **`profiles`**: adiciona `phone TEXT` (`migration_fixes.sql:9`) — usado pelo onboarding (não estava no schema original).
- **`workout_videos`**: `is_short BOOLEAN DEFAULT false` e `notes TEXT` (`migration_fixes.sql:12-13`).
- **`orders`**: `payment_method`, `payment_id`, `paid_at`, `shipping_cost_cents`, `shipping_method`, `shipping_label_url`, `estimated_delivery` (`migration_fixes.sql:16-22`).
- **RPCs `decrement_stock`/`increment_stock`** atômicos (`migration_fixes.sql:27-47`).
- **Índices**: `idx_notifications_created_at`, `idx_messages_user_is_read`, `idx_orders_user_status` (`migration_fixes.sql:51-53`).
- **Tabela `webhook_events`** (`migration_fixes.sql:57-61`) — idempotência de webhooks Asaas.
- **Tabela `moto_events`** (`migration_fixes.sql:65-90`) com RLS.
- **Tabelas `challenges` e `challenge_participants`** (`migration_fixes.sql:94-143`) com RLS por `auth.jwt()->>'sub'`.

#### `supabase/migration_audit_fixes.sql` (29/03/2026 — auditoria CTO)
- **`products`**: dimensões para frete (`weight_kg`, `height_cm`, `width_cm`, `length_cm`) com defaults (`migration_audit_fixes.sql:9-13`).
- **`orders`**: `asaas_payment_id`, `melhor_envio_order_id`, `shipping_label_url`, `shipping_cost_cents`, `shipping_method`, `estimated_delivery` (`migration_audit_fixes.sql:21-27`). **Há sobreposição com `migration_fixes.sql`** — campos `shipping_cost_cents`, `shipping_method`, `shipping_label_url`, `estimated_delivery` aparecem nos dois (todos com `IF NOT EXISTS`, então rodar duas vezes é seguro).
- **`profiles`**: `onboarding_completed BOOLEAN DEFAULT false` (`migration_audit_fixes.sql:38`) com backfill `UPDATE profiles SET onboarding_completed = true WHERE phone IS NOT NULL` (`:43`).
- Índices novos: `idx_orders_user_status`, `idx_orders_asaas_payment` (parcial), `idx_profiles_onboarding` (parcial) (`migration_audit_fixes.sql:46-48`).

#### Outras migrations (citadas, fora do escopo deste setor)
- `migration_consultations_inapp.sql`, `migration_loja.sql`, `migration_kath_estetica.sql`, `migration_notifications.sql`, `migration_phone.sql`, `migration_product_shipping.sql`, `migration_workout_v2.sql` — pertencem aos setores de domínio.
- `supabase/migrations/20260101000000_initial_schema.sql` (534 linhas) parece ser **versão paralela menos completa** do `schema.sql` raiz (sem `plan_templates`, `coupon_uses` extra, etc.). Verificar qual é o source-of-truth.

## 10. Referências

### Arquivos-chave
- `src/lib/supabase/client.ts:14-30` — `useSupabase()` (browser)
- `src/lib/supabase/server.ts:11-21` — `createServerSupabaseClient()`
- `src/lib/supabase/server.ts:29-36` — `createAdminSupabaseClient()` (service_role)
- `src/lib/supabase/types.ts:10-248` — types manuais (PlanTier, WorkoutPlan, OrderItem, ShippingInfo, etc.)
- `src/lib/supabase/database.types.ts:1-1225` — types gerados via `supabase gen types`
- `src/lib/env.ts:6-35` — helpers `required`/`optional`/`requiredInProduction`
- `src/lib/env.ts:37-74` — objeto `env` com getters lazy
- `src/lib/rate-limit.ts:65-81` — `checkRateLimitAsync`
- `src/lib/rate-limit.ts:87-92` — `checkRateLimit` (sync, in-memory)
- `src/lib/rate-limit.ts:95-123` — sliding window Redis
- `src/lib/api-error.ts:30-47` — `handleApiError`
- `src/lib/validations.ts:4-87` — todos os schemas Zod
- `src/lib/validations.ts:90-96` — `parseFormData`
- `src/lib/validations.test.ts` — testes vitest dos schemas
- `src/lib/utils.ts:4-6` — `cn`
- `src/lib/youtube/embed.ts:9-42` — `extractYoutubeId`
- `src/lib/youtube/embed.ts:48-55` — `youtubeThumbnail`

### Migrations
- `supabase/schema.sql` (611 linhas) — schema canônico v1.0 com 13 tabelas + helpers + triggers + RPCs
- `supabase/migration_fixes.sql` (147 linhas — Março 2026) — fixes globais
- `supabase/migration_audit_fixes.sql` (60 linhas — 29/03/2026) — auditoria CTO
- `supabase/migrations/20260101000000_initial_schema.sql` (534 linhas) — versão Supabase CLI
- Outras migrations de domínio: `migration_consultations_inapp.sql`, `migration_kath_estetica.sql`, `migration_loja.sql`, `migration_notifications.sql`, `migration_phone.sql`, `migration_product_shipping.sql`, `migration_workout_v2.sql`

### Setores cruzados (consumo das libs)
- **Auth/Onboarding**: usa `createServerSupabaseClient`, `env`, tabelas `profiles` (com FK Clerk), helper SQL `auth.jwt()->>'sub'`. Schema base de `profiles` em `schema.sql:31-46`. Hotfix `phone` e `onboarding_completed` em `migration_fixes.sql:9` e `migration_audit_fixes.sql:38`.
- **Fitness**: usa `useSupabase`, `extractYoutubeId`, `youtubeThumbnail`, `createWorkoutSchema`. Tabelas `workout_videos`, `workout_logs`, trigger `increment_views` (`schema.sql:579-595`).
- **Loja**: usa `createServerSupabaseClient`, `createAdminSupabaseClient`, `checkRateLimitAsync`, `createProductSchema`, `updateOrderStatusSchema`, `parseFormData`, RPCs `decrement_stock`/`increment_stock` (`migration_fixes.sql:27-47`). Tabelas `products`, `orders`.
- **Consultoria**: usa `createServerSupabaseClient`, `updateConsultationSchema`, tabela `plan_templates` (`schema.sql:529-538`), tabela `consultations`.
- **Cupons**: usa `createCouponSchema`, RPC `increment_coupon_uses` (`schema.sql:598-610`), tabelas `coupons`/`coupon_uses`.
- **Afiliados**: usa `createAffiliateSchema`, RPC `increment_affiliate_clicks` (`schema.sql:512-523`), tabela `affiliate_links`. Rate limit em `src/app/api/affiliate/click/route.ts`.
- **Chat VIP**: usa `useSupabase` (realtime), tabela `messages` com policy `messages_insert_vip` (`schema.sql:313-319`).
- **Push/Notifications**: usa `createAdminSupabaseClient`, `env.VAPID_PRIVATE_KEY`/`VAPID_EMAIL`, tabelas `push_subscriptions`, `notifications`. Rate limit em `src/app/api/push/send/route.ts`.
- **Estética**: usa `createServerSupabaseClient`, `checkRateLimitAsync`. Schema próprio em `migration_kath_estetica.sql`.
- **Pagamentos/Asaas**: usa `createAdminSupabaseClient`, `env.ASAAS_*`, tabela `webhook_events` (`migration_fixes.sql:57-61`) para idempotência.
- **Moto/Desafios**: tabelas `moto_events`, `challenges`, `challenge_participants` (`migration_fixes.sql:65-143`).
- **Health-check**: `src/app/api/health/route.ts` toca em `webhook_events` para verificar conectividade do banco.
