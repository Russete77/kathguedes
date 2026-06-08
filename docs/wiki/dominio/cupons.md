# Setor: Cupons

## 1. Visão geral
- **Propósito:** Disponibilizar cupons de desconto exclusivos negociados pela Kath com marcas parceiras (fitness, moto, geral) para assinantes do KathApp, com gating por plano (`free`, `start`, `pro`, `vip`) e suporte a "Flash Deals" com contagem regressiva.
- **Quem usa:** Usuário final autenticado (consome cupons em `/cupons`) e Admin (cria/edita/desativa em `/admin/cupons`).
- **Status percebido:** production. Há fluxo completo (listagem, copiar código, registro de uso via RPC, CRUD admin, push notification para assinantes ao criar cupom). Faltam telas de "limite por usuário" individualizado — `uses_count` é global por cupom e a verificação "se o usuário já utilizou este cupom" descrita no comentário da rota (`route.ts:8`) não está de fato implementada.

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/cupons` | `src/app/(app)/cupons/page.tsx:12` | Server Component (App Router) | Lista cupons ativos para assinante; separa "Flash Deals" (`is_flash=true`) de "Cupons Ativos". Filtragem aplicada via RLS por plano. |
| `/admin/cupons` | `src/app/admin/cupons/page.tsx:7` | Server Component (Admin) | Painel admin: lista todos os cupons (via `getCoupons()`) e expõe formulário de criação. |
| `/api/coupon/use` | `src/app/api/coupon/use/route.ts:10` | Route Handler `POST` | Registra uso do cupom incrementando `uses_count` via RPC `increment_coupon_uses`. |

Observações de roteamento:
- `/cupons(.*)` é rota protegida pelo `clerkMiddleware` (`src/middleware.ts:9`).
- `/admin(.*)` exige `sessionClaims.metadata.role === "admin"` (`src/middleware.ts:32-37`).

## 3. Componentes
- **`CouponCard`** (`src/components/coupons/coupon-card.tsx:23`) — Cartão visual de cupom para o usuário final. Renderiza parceiro, percentual de desconto, título, módulo, contagem regressiva (`Countdown`) até `valid_until`, código copiável e botão "Ir para a loja" que abre `partner_url` em nova aba. Ao copiar (`handleCopy` em `coupon-card.tsx:36-51`), chama `POST /api/coupon/use` em fire-and-forget e dispara toast `sonner`. Estilo diferenciado para `is_flash` (borda amarela tracejada + badge FLASH).
- **`CouponForm`** (`src/app/admin/cupons/coupon-form.tsx:23`) — Dialog admin com formulário (`<form action={handleSubmit}>`) para criar cupom. Campos: `title`, `code`, `discount_pct`, `partner_name`, `partner_url`, `module` (select fitness/moto/geral), `required_plan` (select free/start/pro/vip), `valid_until` (datetime-local), `max_uses`, `is_flash` (hidden=false). Submete via Server Action `createCoupon`.
- **`CouponList`** (`src/app/admin/cupons/coupon-list.tsx:31`) — Tabela admin lista cupons com colunas: Cupom, Código, Parceiro, Módulo, Plano, Usos (`uses_count/max_uses`), Status (Ativo / Inativo / Expirado / Flash) e Ações (toggle ativo via `toggleCouponActive` e excluir via `deleteCoupon` com `confirm()`).

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `getCoupons()` | Server Action (admin) | — | `Coupon[]` (todos os cupons, ordenados por `valid_until desc`) | `src/app/admin/cupons/page.tsx:8` |
| `createCoupon(formData)` | Server Action (admin) | `FormData` validado por `createCouponSchema` | `void` (revalida `/admin/cupons`); dispara push via `notifyByPlan` | `src/app/admin/cupons/coupon-form.tsx:30` |
| `updateCoupon(id, formData)` | Server Action (admin) | `id: string`, `FormData` validado por `createCouponSchema` | `void` (revalida `/admin/cupons`) | Definida em `src/app/admin/actions.ts:172` — sem chamador atual no escopo (UI de edição não acessível pelo `CouponList`). |
| `deleteCoupon(id)` | Server Action (admin) | `id: string` | `void` (revalida `/admin/cupons`) | `src/app/admin/cupons/coupon-list.tsx:119` |
| `toggleCouponActive(id, active)` | Server Action (admin) | `id: string`, `active: boolean` | `void` | `src/app/admin/cupons/coupon-list.tsx:105` |
| `POST /api/coupon/use` | API Route | JSON `{ couponId: string }` | `{ used: true }` ou `{ error }` (401/400) | `src/components/coupons/coupon-card.tsx:41` (fire-and-forget no clipboard copy) |

Notas:
- Todas as Server Actions admin executam `await requireAdmin()` (`src/app/admin/actions.ts:19-26`), que verifica `sessionClaims.metadata.role === "admin"` via Clerk.
- `POST /api/coupon/use` exige `auth()` Clerk (`route.ts:11-14`) mas usa `createAdminSupabaseClient()` (`route.ts:25`) para contornar RLS. O fallback manual (`route.ts:34-45`) replica a lógica de `increment_coupon_uses` no client TypeScript caso a RPC falhe.

## 5. Modelo de dados

### Tabela `coupons` (`supabase/migrations/20260101000000_initial_schema.sql:253-268`)
- `id`: `uuid` PK (default `gen_random_uuid()`)
- `title`: `text` not null — título da promoção
- `code`: `text` unique not null — código que o usuário cola no parceiro (uppercase forçado pelo schema Zod)
- `discount_pct`: `int` — percentual de desconto (nullable; quando null, card mostra "DESCONTO" em vez de "X% OFF")
- `partner_name`: `text` not null — nome da marca parceira
- `partner_url`: `text` not null — URL externa do parceiro (botão "Ir para a loja")
- `module`: `text` not null check `in ('fitness', 'moto', 'geral')`
- `required_plan`: `text` not null default `'free'` check `in ('free', 'start', 'pro', 'vip')` — gating por plano
- `max_uses`: `int` (nullable, ilimitado quando null)
- `uses_count`: `int` not null default `0` — incrementado por `increment_coupon_uses`
- `valid_until`: `timestamptz` not null — data de expiração
- `is_flash`: `boolean` not null default `false` — Flash Deal (estilo amarelo + badge)
- `is_active`: `boolean` not null default `true` — toggle admin
- **RLS:**
  - `coupons_select_by_plan` (`migration:273-282`): `authenticated` enxerga apenas onde `is_active = true AND valid_until > now() AND plan_tier_level(profile.plan_tier) >= plan_tier_level(required_plan)`. A função `plan_tier_level` é compartilhada (Infra Compartilhada).
  - `coupons_admin` (`migration:285-289`): `service_role` tem `ALL` (sem restrição).

### Função `increment_coupon_uses(coupon_id uuid)` (`migration:522-534`)
- `SECURITY DEFINER`, `language plpgsql`.
- Faz `update coupons set uses_count = uses_count + 1 where id = coupon_id and is_active = true and (max_uses is null or uses_count < max_uses)`.
- Chamada via RPC pelo route handler `POST /api/coupon/use` (`route.ts:28-30`).

### Índices (`migration:488-489`)
- `idx_coupons_module` em `(module, is_active)`
- `idx_coupons_valid` em `(valid_until)`

## 6. Integrações externas
- **Push Notifications (Web Push / VAPID):** ao criar cupom, `createCoupon` dispara `notifyByPlan(required_plan, { title, body, icon: "Tag", url: "/cupons" })` (`src/app/admin/actions.ts:162-167`) em fire-and-forget. Detalhes do subsistema de push vivem no setor de Notificações (`src/lib/notifications.ts:68`).
- **Parceiros externos:** apenas via `partner_url` (link out). Não há OAuth/affiliate tracking nem callbacks — o cupom é um código textual que o usuário copia e cola no checkout do parceiro.
- **Clerk:** auth dos endpoints `/cupons` e `/api/coupon/use`; gating admin em `/admin/cupons`. Detalhes em setor de Plataforma/Auth.
- **Asaas/Pagamentos:** N/A — cupons não interagem com gateway de pagamento; o desconto é aplicado no site do parceiro, não no checkout interno do KathApp.

## 7. Validações
- **`createCouponSchema`** (`src/lib/validations.ts:25-36`) — schema Zod compartilhado. Cupons é o setor dono lógico:
  - `title`: string min 1, max 200
  - `code`: string min 1, max 50, transformado para uppercase
  - `discount_pct`: int 0–100, nullable/optional
  - `partner_name`: string min 1, max 200
  - `partner_url`: URL válida
  - `module`: enum `['fitness', 'moto', 'geral']`
  - `required_plan`: `planTierSchema` (`['free','start','pro','vip']`) default `'free'`
  - `max_uses`: int >= 0, nullable/optional
  - `valid_until`: string min 1 (vem do input `datetime-local`, sem `.datetime()`)
  - `is_flash`: boolean coerced, default `false`
- O `planTierSchema` é compartilhado e definido em `src/lib/validations.ts:4` (consumido também por afiliados, produtos etc.).
- A rota `POST /api/coupon/use` (`route.ts:17-23`) faz validação inline do payload: exige `couponId` truthy, retorna 400 caso contrário. Não usa Zod.

## 8. Fluxos principais

### Fluxo: Usuário copia cupom
1. Usuário autenticado acessa `/cupons` (Clerk middleware valida sessão — `middleware.ts:9`).
2. Server Component executa `supabase.from("coupons").select("*").order("is_flash", desc).order("valid_until", asc)` (`page.tsx:15-19`). RLS filtra por `is_active`, validade e `plan_tier_level`.
3. Cupons são separados em `flashCoupons` e `regularCoupons` (`page.tsx:21-22`) e renderizados via `CouponCard`.
4. Usuário clica em "Copiar"; `handleCopy` (`coupon-card.tsx:36-51`):
   - `navigator.clipboard.writeText(code)`
   - `setCopied(true)` por 2s
   - `fetch("/api/coupon/use", { method: "POST", body: { couponId } })` em fire-and-forget (`.catch(() => {})`)
   - exibe toast `sonner` com cor de sucesso
5. Route handler `POST /api/coupon/use` valida auth Clerk, chama RPC `increment_coupon_uses`. Se RPC falhar, faz fallback manual: lê `(uses_count, max_uses, is_active)`, valida limite e faz `update` (`route.ts:32-46`).
6. Usuário clica "Ir para a loja" → `window.open(partner_url, "_blank", "noopener,noreferrer")` (`coupon-card.tsx:53-55`). Não há tracking de outclick.

### Fluxo: Admin cria cupom
1. Admin acessa `/admin/cupons` (`middleware.ts:32-37` valida role admin via Clerk).
2. `AdminCuponsPage` chama `getCoupons()` (Server Action) e renderiza `CouponList` + `CouponForm`.
3. Admin clica "Novo Cupom" → abre `Dialog`. Submete formulário.
4. `createCoupon(formData)` (`actions.ts:140-170`):
   - `requireAdmin()` re-valida role
   - `parseFormData(createCouponSchema, formData)` (Zod)
   - `supabase.from("coupons").insert({...})` com `is_active: true` forçado
   - Em sucesso, `notifyByPlan(required_plan, {...})` envia push para assinantes do plano-alvo (link `/cupons`)
   - `revalidatePath("/admin/cupons")`
5. Lista atualiza com novo cupom.

### Fluxo: Admin desativa / exclui cupom
1. No `CouponList`, admin clica toggle → `toggleCouponActive(id, !is_active)` faz `update is_active`.
2. Cupom desativado some imediatamente para usuários (RLS `is_active = true`).
3. Trash → `confirm()` nativo + `deleteCoupon(id)` faz `delete`.

## 9. Observações (notas para Fase B — não auditar agora)
- **Discrepância no comentário da rota:** `src/app/api/coupon/use/route.ts:8` declara "Verifica se o usuário já utilizou este cupom antes", mas a implementação não persiste relação `user_id × coupon_id`. O `uses_count` é global e o mesmo usuário pode incrementar múltiplas vezes (cada cópia conta).
- **`updateCoupon` órfão na UI:** `src/app/admin/actions.ts:172-196` existe mas não há botão de "Editar" em `CouponList` (apenas toggle e delete).
- **Validação `valid_until` fraca:** schema aceita `z.string().min(1)` (`validations.ts:34`) sem `.datetime()`. Strings inválidas só falham quando o Postgres tenta cast em `timestamptz`.
- **Push fire-and-forget sem retry:** `notifyByPlan(...).catch(() => {})` (`actions.ts:167`) silencia falhas — se a entrega falhar parcialmente, nem o admin nem logs estruturados ficam sabendo.
- **Sem rate-limit em `/api/coupon/use`:** clique repetido em "Copiar" no card incrementa `uses_count` indefinidamente até atingir `max_uses` (caso definido). Considerar throttling ou idempotency-key.
- **`confirm()` nativo** (`coupon-list.tsx:119`) — substituível por dialog estilizado para UX consistente.
- **Fallback manual em `route.ts:34-46`** existe mas é silencioso: nunca loga qual erro veio da RPC.
- **`partner_url` sem validação de UTM/tracking:** sem identificação de origem KathApp no clique para o parceiro (poderia ajudar negociação comercial).

## 10. Referências

### Arquivos-chave
- `src/app/(app)/cupons/page.tsx:12` — listagem do usuário final
- `src/components/coupons/coupon-card.tsx:23` — card client component
- `src/app/api/coupon/use/route.ts:10` — POST registro de uso
- `src/app/admin/cupons/page.tsx:7` — painel admin
- `src/app/admin/cupons/coupon-form.tsx:23` — dialog de criação
- `src/app/admin/cupons/coupon-list.tsx:31` — tabela admin
- `src/app/admin/actions.ts:129-219` — Server Actions (`getCoupons`, `createCoupon`, `updateCoupon`, `deleteCoupon`, `toggleCouponActive`)
- `src/lib/validations.ts:25-36` — `createCouponSchema`

### Migrations
- `supabase/migrations/20260101000000_initial_schema.sql:250-289` — tabela `coupons` + policies RLS
- `supabase/migrations/20260101000000_initial_schema.sql:488-489` — índices
- `supabase/migrations/20260101000000_initial_schema.sql:521-534` — função RPC `increment_coupon_uses`

### Setores cruzados (não documentados aqui)
- **Plataforma / Auth (Clerk):** `requireAdmin()` em `src/app/admin/actions.ts:19`, `clerkMiddleware` em `src/middleware.ts`. Documentado pelo agente de Auth.
- **Plataforma / Supabase + RLS compartilhado:** função `plan_tier_level()` consumida em `coupons_select_by_plan` (`migration:279`); helper `createAdminSupabaseClient` (`src/lib/supabase/server.ts`). Documentado pelo agente de Infra Compartilhada.
- **Notificações Push (Web Push / VAPID):** `notifyByPlan` em `src/lib/notifications.ts:68`. Documentado pelo agente de Notificações/Push.
- **Validações compartilhadas:** `planTierSchema` e helper `parseFormData` em `src/lib/validations.ts:4`. Esquema-compartilhado documentado pelo agente de Infra/Validations; `createCouponSchema` é dono lógico deste setor.
- **Perfis / `profiles.plan_tier`:** consumido pela RLS de cupons; modelado pelo agente de Perfis/Assinantes.
- **Afiliados (`affiliate_links`)** e **Loja (`products`/`orders`):** outros canais de monetização; mesmo padrão de gating por plano. Documentados em seus respectivos setores.
