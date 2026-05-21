# Setor: Admin Core

## 1. Visão geral
- **Propósito:** Núcleo do painel administrativo do KathApp — fornece o shell de navegação, autorização por role `admin`, dashboard de overview com métricas agregadas e gestão de assinantes (perfis dos usuários). Centraliza também a maior parte das Server Actions usadas por todas as subseções de admin (`actions.ts`).
- **Quem usa:** Apenas administradores (Kath Guedes e equipe). Verificado via `sessionClaims.metadata.role === "admin"` (Clerk).
- **Status percebido:** production — fluxo completo de auth, layout responsivo (mobile/desktop), métricas reais do banco e listagem com filtros funcional.

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/admin` | `src/app/admin/page.tsx:4` | Server (redirect) | Redireciona para `/admin/dashboard`. |
| `/admin/*` (layout) | `src/app/admin/layout.tsx:70` | Client Layout | Sidebar com navegação principal e grupos colapsáveis (Estética Moto). Inclui `<meta name="robots" content="noindex">` em `layout.tsx:96`. |
| `/admin/dashboard` | `src/app/admin/dashboard/page.tsx:39` | Server Component | Painel de overview: alertas operacionais, receita, distribuição de planos, status de pedidos/consultorias, rankings, estoque baixo, signups recentes. |
| `/admin/assinantes` | `src/app/admin/assinantes/page.tsx:6` | Server Component | Lista todos os perfis (`profiles`) ordenados por `created_at desc` e renderiza `<AssinantesList>`. |
| `/api/admin/loja/shipping/label` | `src/app/api/admin/loja/shipping/label/route.ts:16` | API Route (POST) | Única rota REST sob `/api/admin/*` — gera etiqueta Melhor Envio (escopo loja, ver "10. Referências"). |

Nota: `/admin/{treinos,cupons,afiliados,consultorias,templates,loja,chat,push,kath-estetica/*}` existem como rotas mas pertencem a outros setores (ver "10. Referências").

## 3. Componentes
### Layout/navegação
- **`AdminLayout`** (`src/app/admin/layout.tsx:70`) — shell com sidebar fixa em desktop e drawer em mobile. Usa `usePathname` para destacar o item ativo (`layout.tsx:91`). Inclui `<UserButton/>` do Clerk (`layout.tsx:113`, `:249`).
- **`appNav`** (`src/app/admin/layout.tsx:42-53`) — array de `NavItem` com 10 entradas principais (Dashboard, Treinos, Cupons, Afiliados, Assinantes, Consultorias, Templates, Loja, Chat VIP, Push).
- **`navGroups`** (`src/app/admin/layout.tsx:55-68`) — grupos colapsáveis. Atualmente apenas "Estética Moto" com 5 sub-itens. Estado `openGroups` inicializado expandido se a rota atual pertence ao grupo (`layout.tsx:79-85`).

### Dashboard
- **`AdminDashboardPage`** (`src/app/admin/dashboard/page.tsx:39`) — agrega `getDashboardMetrics()` (single Promise.all com 27 queries) e renderiza seções: alertas, receita, usuários, consultorias/pedidos, conteúdo, rankings, estoque baixo e signups recentes.
- **`StatCard`** (`src/app/admin/dashboard/page.tsx:327`) — card de KPI com ícone, valor, label, sub-label e indicador opcional de trend.
- **`MiniStat`** (`src/app/admin/dashboard/page.tsx:358`) — variante compacta usada em consultorias/pedidos.
- **`RankingCard`** (`src/app/admin/dashboard/page.tsx:376`) — top-5 com numeração mono.
- **`PlanBadge`** (`src/app/admin/dashboard/page.tsx:410`) — badge colorido por tier (free/start/pro/vip).
- Helpers: `formatBRL` (`page.tsx:25`) e `timeAgo` (`page.tsx:29`).

### Assinantes
- **`AdminAssinantesPage`** (`src/app/admin/assinantes/page.tsx:6`) — usa `createAdminSupabaseClient()` direto (não passa por server action), faz select-all em `profiles`.
- **`AssinantesList`** (`src/app/admin/assinantes/assinantes-list.tsx:34`) — client component com:
  - Stats: cards Total/Free/Start/Pro/VIP (`assinantes-list.tsx:66-78`).
  - Filtros: busca por `full_name` ou `id` + filtro por plano (`assinantes-list.tsx:38-45`, `:92-106`).
  - Tabela: nome, plano, status, streak, telefone, vencimento, cadastro (`assinantes-list.tsx:111-157`).
  - Maps `planBadge`/`statusBadge` (`assinantes-list.tsx:21-32`).

### Componentes admin compartilhados
- **`src/components/admin/`** — diretório existe (git status mostra a pasta) mas está **vazio**. Componentes admin estão colocados ao lado das suas páginas (`src/app/admin/<setor>/*.tsx`) em vez de centralizados.

## 4. Server Actions / API Routes

Todas as ações em `actions.ts` chamam `requireAdmin()` (`src/app/admin/actions.ts:19-26`) antes de qualquer operação no banco. Seleção das ações **transversais ao admin core** (dashboard + perfis); ações específicas de domínio são listadas mas marcadas com seu setor.

| Endpoint/Action | Método | Input | Output | Quem chama / Setor |
|---|---|---|---|---|
| `requireAdmin()` | helper | — | `userId` ou throw | Todas as actions de `actions.ts` |
| `getDashboardMetrics()` | server action | — | objeto agregado com 20+ contadores e listas top-5 | `dashboard/page.tsx:40` (admin core) |
| `getProfilesList()` | server action | — | `{id, full_name, plan_tier}[]` | Admin core (perfis) — usado por `consultorias` para autocomplete |
| `getWorkouts/createWorkout/updateWorkout/toggleWorkoutPublished/deleteWorkout` | server action | FormData/id | — | Setor **admin/treinos** (ver refs) |
| `getCoupons/createCoupon/updateCoupon/deleteCoupon/toggleCouponActive` | server action | FormData/id | — | Setor **admin/cupons** |
| `getAffiliateLinks/createAffiliateLink/updateAffiliateLink/deleteAffiliateLink/toggleAffiliateActive` | server action | FormData/id | — | Setor **admin/afiliados** |
| `getConsultations/updateConsultationPlan/updateConsultationStatus/createConsultation` | server action | FormData/id/payload | — | Setor **admin/consultorias** |
| `getProducts/createProduct/updateProduct/deleteProduct/toggleProductActive` | server action | FormData/id | — | Setor **admin/loja** |
| `getOrders/updateOrderStatus` | server action | id, status, trackingCode? | — | Setor **admin/loja** (notifica usuário em `actions.ts:697-723`) |
| `getTemplates/createTemplate/updateTemplate/deleteTemplate/seedDefaultTemplates` | server action | FormData/type | — | Setor **admin/templates** |
| `POST /api/admin/loja/shipping/label` | REST | `{orderId, serviceId?}` | `{tracking_code, label_url}` | Setor **admin/loja** (única rota sob `/api/admin/*`) |

A guarda admin na rota REST é replicada inline (`route.ts:17-21`), não usa `requireAdmin()` de `auth-helpers.ts` — divergência menor.

## 5. Modelo de dados

O Admin Core não possui tabelas exclusivas — não há audit trail nem tabela de admin actions. Ele consome principalmente:

- **`profiles`** (migration `20260101000000_initial_schema.sql:31`) — fonte primária da página `/admin/assinantes`. Campos relevantes lidos: `id, full_name, plan_tier, subscription_status, subscription_ends_at, workout_streak, phone, created_at` (`assinantes-list.tsx:10-19`). RLS dedicada para admin: políticas `profiles_select_admin` e `profiles_update_admin` aplicadas a `service_role` (`20260101000000_initial_schema.sql:70-79`).
- O dashboard agrega counts/sums das tabelas `profiles, orders, consultations, messages, workout_videos, coupons, affiliate_links, products` (`actions.ts:347-388`) — cada uma documentada no setor de domínio respectivo.

Consequência: bypass total de RLS é feito via `createAdminSupabaseClient()` (`src/lib/supabase/server.ts:29`) que usa `SUPABASE_SERVICE_ROLE_KEY`. A autorização efetiva é unicamente o role Clerk verificado em `requireAdmin()`/middleware.

## 6. Integrações externas
- **Clerk Roles** — autorização baseada em `sessionClaims.metadata.role === "admin"`. Três pontos de verificação:
  1. Middleware (`src/middleware.ts:32-38`) — bloqueia toda rota `/admin/*` redirecionando para `/dashboard`.
  2. Server actions (`src/app/admin/actions.ts:22-25`) via `requireAdmin()`.
  3. API routes (`src/app/api/admin/loja/shipping/label/route.ts:17-21`) — check inline.
  4. Helper centralizado em `src/lib/auth-helpers.ts:7-21` (`isAdmin`/`requireAdmin`) que tolera `metadata.role` ou claim `user_role`. Não é usado pela `actions.ts` do admin (que faz seu próprio check inline).
- **Supabase service-role** — `createAdminSupabaseClient()` (`src/lib/supabase/server.ts:29-36`) usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS.
- **Clerk `<UserButton/>`** — controle de sessão na sidebar (`layout.tsx:113`, `:249`).
- Para detalhes completos de auth, ver `../auth.md`.

## 7. Validações

Schemas Zod em `src/lib/validations.ts` consumidos pelas actions admin via helper `parseFormData(schema, formData)` (`validations.ts:90`):

- **`createWorkoutSchema`** (`src/lib/validations.ts:7`) — usado em `createWorkout` (`actions.ts:47`).
- **`createCouponSchema`** (`src/lib/validations.ts:25`) — usado em `createCoupon`/`updateCoupon` (`actions.ts:144`, `:176`).
- **`createAffiliateSchema`** (`src/lib/validations.ts:39`) — usado em `createAffiliateLink`/`updateAffiliateLink` (`actions.ts:243`, `:265`).
- **`createProductSchema`** (`src/lib/validations.ts:51`) — usado em `createProduct`/`updateProduct` (`actions.ts:582`, `:611`).
- **`updateConsultationSchema`** (`src/lib/validations.ts:71`) — usado em `updateConsultationPlan` (`actions.ts:479`).

Campos não-validados por schema (apenas casts inline):
- `updateWorkout` (`actions.ts:77-98`) — lê FormData sem schema.
- `updateOrderStatus`, `createConsultation`, `createTemplate`, `updateTemplate` — leitura direta de FormData sem Zod.

## 8. Fluxos principais

### Fluxo: Acesso ao painel admin
1. Usuário navega para qualquer `/admin/*`.
2. `clerkMiddleware` em `src/middleware.ts:30` é invocado.
3. `isAdminRoute(req)` matcha (`middleware.ts:20`).
4. Se `sessionClaims.metadata.role !== "admin"`, redireciona para `/dashboard` (`middleware.ts:34-37`).
5. Se admin, segue. Layout `src/app/admin/layout.tsx:70` renderiza sidebar.
6. Página requisitada (`/admin/dashboard` por padrão via redirect em `page.tsx:4`).

### Fluxo: Render do dashboard
1. `AdminDashboardPage` (`dashboard/page.tsx:39`) é Server Component, executa `await getDashboardMetrics()`.
2. `getDashboardMetrics` (`actions.ts:315`) chama `requireAdmin()` (segunda camada) e `createAdminSupabaseClient()`.
3. Dispara 27 queries em paralelo via `Promise.all` (`actions.ts:347-388`) — counts/sums em `profiles, orders, consultations, messages, workout_videos, coupons, affiliate_links, products`.
4. Calcula `revenueTotalCents`, `revenueMonthCents` (sum), `growthPct` (`actions.ts:391-398`).
5. Retorna objeto agregado renderizado em alertas, KPIs, mini-stats, rankings (`page.tsx:60-314`).

### Fluxo: Listagem de assinantes
1. `AdminAssinantesPage` (`assinantes/page.tsx:6`) — Server Component.
2. Usa `createAdminSupabaseClient()` direto (sem passar por `requireAdmin()` server action — autorização vem do middleware).
3. `select * from profiles order by created_at desc` (`page.tsx:9-12`).
4. `<AssinantesList profiles={...} />` (Client Component) — recebe array e aplica filtros locais (busca + plano) em `assinantes-list.tsx:38-45`.
5. Tabela renderiza badges, formata datas em `pt-BR`, mostra contador "X de Y" (`assinantes-list.tsx:160-164`).

### Fluxo: Geração de etiqueta (única API route admin)
1. Cliente (`src/app/admin/loja/order-list.tsx:44`) faz `POST /api/admin/loja/shipping/label`.
2. Handler verifica role inline (`route.ts:17-21`).
3. Busca pedido, valida `status === "paid"` (`route.ts:65-70`).
4. Chama `generateFullLabel()` em `@/lib/shipping/melhor-envio`.
5. Atualiza `orders` com `tracking_code, shipping_label_url, melhor_envio_order_id` (`route.ts:129-137`).

## 9. Observações (notas para Fase B — não auditar agora)

- **Inconsistência de auth check:** `auth-helpers.ts:7-21` tolera dois formatos de role (`metadata.role` ou `user_role`), mas `actions.ts:23` e `route.ts:18` checam apenas `metadata.role`. O helper centralizado **não é usado** pelo admin core.
- **`src/components/admin/`** existe como pasta mas está vazia — convenção atual é colocar componentes ao lado das páginas (`src/app/admin/<setor>/<componente>.tsx`). Decidir se centralizar.
- **Sem audit trail:** nenhuma tabela registra quem fez qual ação admin (delete de produto, alteração de plano, etc.). Considerar tabela `admin_audit_log` na Fase B.
- **`getDashboardMetrics` faz 27 queries em paralelo** — não há cache (`actions.ts:325-388`). Em produção com volume, considerar `unstable_cache` ou view materializada.
- **Página de assinantes não tem ações** — apenas leitura. Não há reset de senha, troca manual de plano, ou impersonate. Painel é read-only para admins.
- **Layout fixa "Kath Guedes" como label do UserButton** (`layout.tsx:250`) — hardcoded, não puxa do Clerk.
- **`updateWorkout` (`actions.ts:77`), `updateOrderStatus` (`actions.ts:677`), `createConsultation` (`actions.ts:532`), `createTemplate`/`updateTemplate` (`actions.ts:746`/`:764`)** não usam Zod — leem FormData com casts brutos. Risco de validation drift.
- **Type assertion `as unknown as any`** em `updateConsultationPlan` (`actions.ts:483`) e em `templates/page.tsx:14-15` — TODO de tipagem.
- **`seedDefaultTemplates` (`actions.ts:791-1108`)** contém ~300 linhas de defaults hardcoded; deveria estar em arquivo separado de seeds.

## 10. Referências

### Arquivos-chave
- `src/app/admin/layout.tsx:42-68` — config de navegação principal e grupos.
- `src/app/admin/layout.tsx:96` — `<meta robots="noindex,nofollow">` para todo painel.
- `src/app/admin/page.tsx:4` — redirect raiz.
- `src/app/admin/actions.ts:19-26` — guarda `requireAdmin()`.
- `src/app/admin/actions.ts:315-450` — `getDashboardMetrics`.
- `src/app/admin/dashboard/page.tsx:39-317` — render do dashboard.
- `src/app/admin/assinantes/page.tsx:6-25` — listagem server-side.
- `src/app/admin/assinantes/assinantes-list.tsx:34-167` — UI/filtros client-side.
- `src/middleware.ts:20-38` — guarda admin no edge.
- `src/lib/auth-helpers.ts:7-21` — helper centralizado (não usado por admin core).
- `src/lib/supabase/server.ts:29-36` — `createAdminSupabaseClient`.
- `src/app/api/admin/loja/shipping/label/route.ts:1-153` — única rota REST `/api/admin/*` (escopo loja).

### Migrations
- `supabase/migrations/20260101000000_initial_schema.sql:31-79` — tabela `profiles` + políticas RLS de admin (`profiles_select_admin`, `profiles_update_admin` em `service_role`).
- Não há migrations exclusivas para o admin core (sem audit log, sem tabela admin_users).
- Migrations legadas em `supabase/*.sql` (não aplicadas via Supabase CLI): N/A para este setor.

### Setores cruzados (cobertos por outros agentes — apenas referenciados aqui)
- **Auth & autorização (Clerk roles):** `../auth.md`.
- **Treinos admin:** `../../dominio/admin-treinos.md` (rotas `/admin/treinos`, actions de `workout_videos`).
- **Cupons admin:** `../../dominio/admin-cupons.md` (rotas `/admin/cupons`, actions de `coupons`).
- **Afiliados admin:** `../../dominio/admin-afiliados.md` (rotas `/admin/afiliados`).
- **Consultorias admin:** `../../dominio/admin-consultorias.md` (rotas `/admin/consultorias`, `getProfilesList`/`createConsultation`/`updateConsultationPlan`).
- **Templates admin:** `../../dominio/admin-templates.md` (rotas `/admin/templates`, `seedDefaultTemplates`).
- **Loja admin (produtos/pedidos/etiquetas):** `../../dominio/admin-loja.md` (rotas `/admin/loja`, `/api/admin/loja/shipping/label`).
- **Chat VIP admin:** `../../dominio/admin-chat.md` (rota `/admin/chat`).
- **Push admin:** `../../dominio/admin-push.md` (rota `/admin/push`).
- **Kath Estética admin:** `../../dominio/admin-estetica.md` (subgrupo `/admin/kath-estetica/*`).
- **Validações Zod:** `./validations.md` (schemas em `src/lib/validations.ts`).
- **Notificações (`notifyUser`/`notifyByPlan`):** `./notifications.md` (`src/lib/notifications.ts`).
