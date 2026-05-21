# Setor: Afiliados

## 1. Visão geral
- **Propósito:** Vitrine de produtos recomendados pela Kath Guedes (fitness, moto) com links externos de afiliados (Amazon BR, Mercado Livre, Shopee, parcerias diretas) e contagem de cliques para mensurar engajamento. Admin cadastra/gerencia; assinante visualiza e clica.
- **Quem usa:** Ambos — usuário final autenticado consome a página `/afiliados`; admin gerencia em `/admin/afiliados`.
- **Status percebido:** production. CRUD completo, RLS ativo, rate-limit em rota de tracking, integração com dashboard admin (top afiliados). Pequeno débito técnico documentado em `route.ts:33` (RPC atômico não está sendo usado).

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/afiliados` | `src/app/(app)/afiliados/page.tsx:12` | Server Component (App Router) | Vitrine pública (autenticada) de produtos. Lista `affiliate_links` ordenado por `sort_order` ascendente. Filtragem por plano é feita via RLS no Supabase. |
| `/admin/afiliados` | `src/app/admin/afiliados/page.tsx:7` | Server Component (admin) | Tela de gestão: lista todos os links, abre o formulário de criação. |
| `/api/affiliate/click` | `src/app/api/affiliate/click/route.ts:10` | Route Handler `POST` | Registra clique e incrementa `clicks_count`. Requer auth (Clerk) e rate-limit 60 req/min/usuário. |

## 3. Componentes
- **`AffiliateCard`** (`src/components/affiliates/affiliate-card.tsx:27`) — Card client-side exibido na vitrine `/afiliados`. Renderiza imagem, badge de categoria, plataforma traduzida (`platformLabels` em `affiliate-card.tsx:20`), título, descrição, contador de cliques e botão "Ver Produto". Ao clicar, dispara `fetch` para `/api/affiliate/click` (fire-and-forget) e abre `affiliate_url` em nova aba via `window.open` com `noopener,noreferrer` (`affiliate-card.tsx:37-45`).
- **`AffiliateForm`** (`src/app/admin/afiliados/affiliate-form.tsx:23`) — Dialog client-side para criar novo link. Submete via Server Action `createAffiliateLink`. Campos: título, image_url, affiliate_url, descrição, módulo (fitness|moto), categoria livre, plataforma (amazon|mercadolivre|shopee|direto), required_plan (free|start|pro|vip).
- **`AffiliateList`** (`src/app/admin/afiliados/affiliate-list.tsx:36`) — Tabela admin client-side. Mostra produto, módulo (badge colorido), plataforma, plano, cliques e três ações por linha: abrir URL externa (`affiliate-list.tsx:94-101`), toggle ativo (`toggleAffiliateActive`), excluir (`deleteAffiliateLink` com `confirm()` nativo).

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `getAffiliateLinks()` | Server Action | — | `affiliate_links[]` ordenado por `sort_order` | `src/app/admin/afiliados/page.tsx:8` |
| `createAffiliateLink(formData)` | Server Action | `FormData` validado por `createAffiliateSchema` | `void` (revalida `/admin/afiliados`) | `src/app/admin/afiliados/affiliate-form.tsx:30` |
| `updateAffiliateLink(id, formData)` | Server Action | `id: string`, `FormData` validado | `void` (revalida) | (definida em `src/app/admin/actions.ts:261`, sem chamadas no UI atual — ver Observações) |
| `deleteAffiliateLink(id)` | Server Action | `id: string` | `void` (revalida) | `src/app/admin/afiliados/affiliate-list.tsx:120` |
| `toggleAffiliateActive(id, active)` | Server Action | `id: string`, `active: boolean` | `void` (revalida) | `src/app/admin/afiliados/affiliate-list.tsx:106` |
| `POST /api/affiliate/click` | HTTP `POST` | `{ linkId: string }` (JSON body) | `{ tracked: true }` ou `{ error }` (401/400/429) | `src/components/affiliates/affiliate-card.tsx:38` |

Todas as Server Actions exigem `requireAdmin()` (`src/app/admin/actions.ts:19-26`) — verifica `sessionClaims.metadata.role === "admin"` via Clerk.

## 5. Modelo de dados

### Tabela `affiliate_links` (`supabase/schema.sql:212` e `supabase/migrations/20260101000000_initial_schema.sql:212`)
- `id`: `uuid` PK, default `gen_random_uuid()`
- `title`: `text not null` — nome do produto
- `description`: `text` (nullable) — texto curto sobre por que a Kath recomenda
- `image_url`: `text not null` — URL da imagem do produto
- `module`: `text not null check (module in ('fitness', 'moto'))` — categoria de negócio
- `category`: `text not null` — texto livre (ex: "capacete", "suplemento")
- `platform`: `text not null check (platform in ('amazon', 'mercadolivre', 'shopee', 'direto'))`
- `affiliate_url`: `text not null` — URL externa de afiliado
- `required_plan`: `text not null default 'free' check (required_plan in ('free', 'start', 'pro', 'vip'))`
- `clicks_count`: `int not null default 0` — contador incrementado pela rota `/api/affiliate/click`
- `is_active`: `boolean not null default true`
- `sort_order`: `int not null default 0` — ordenação na vitrine

**Índices** (`supabase/schema.sql:559`):
- `idx_affiliate_links_module on (module, is_active)`

**RLS** (`supabase/schema.sql:229-247`):
- Habilitado: `alter table public.affiliate_links enable row level security`.
- Policy `affiliates_select_by_plan` (`schema.sql:232`): `authenticated` SELECT permitido quando `is_active = true` e o plano do profile (resolvido via `auth.jwt()->>'sub'` para casar com `profiles.id` do Clerk) é maior ou igual ao `required_plan` (compara via função `public.plan_tier_level`).
- Policy `affiliates_admin` (`schema.sql:243`): `service_role` tem acesso total (CRUD).

### Função `public.increment_affiliate_clicks(link_id uuid)` (`supabase/schema.sql:512`)
- RPC `security definer` que incrementa `clicks_count` atomicamente apenas para `is_active = true`.
- **Não está sendo chamada pelo código atual** — a rota `/api/affiliate/click` faz SELECT seguido de UPDATE manual (ver "9. Observações").

## 6. Integrações externas
- **Plataformas de afiliados externas (e-commerce):** Amazon BR, Mercado Livre, Shopee, parceiros diretos. Integração se limita a armazenar a URL de afiliado e abrir em nova aba; nenhuma API/SDK consumida — KathApp não recebe webhooks nem consulta vendas/conversões dessas plataformas. Toda atribuição de comissão acontece do lado do parceiro.
- **Clerk (auth):** consumido em `route.ts:1,11` e na cadeia de Server Actions via `requireAdmin()`. Detalhes do subsistema: ver setor cruzado de Auth.
- **Supabase:** consumido via `createServerSupabaseClient` (page do usuário, com RLS) e `createAdminSupabaseClient` (Server Actions admin e route handler de click). Detalhes da camada Supabase: ver setor "Infra Compartilhada".

## 7. Validações
- **`createAffiliateSchema`** (`src/lib/validations.ts:39`) — schema Zod usado tanto em `createAffiliateLink` quanto em `updateAffiliateLink`. Setor "dono lógico": Afiliados.
  - `title`: string, 1–200 chars
  - `description`: string até 2000 chars, nullable/optional
  - `image_url`: URL válida
  - `module`: enum `["fitness", "moto"]`
  - `category`: string, 1–100 chars
  - `platform`: enum `["amazon", "mercadolivre", "shopee", "direto"]`
  - `affiliate_url`: URL válida
  - `required_plan`: `planTierSchema` (compartilhado), default `"free"`
- Parsing de `FormData` é feito por `parseFormData(createAffiliateSchema, formData)` (helper compartilhado em `src/lib/validations.ts`).
- A rota `POST /api/affiliate/click` faz validação inline mínima em `route.ts:24-29`: parse de JSON e checagem `linkId: string`. Não usa Zod.

## 8. Fluxos principais

### Fluxo: Assinante visualiza vitrine e clica num produto
1. Usuário autenticado acessa `/afiliados` (`src/app/(app)/afiliados/page.tsx:12`).
2. Server Component executa `supabase.from("affiliate_links").select("*").order("sort_order")` com cliente do usuário; RLS filtra automaticamente pelos links que (a) `is_active = true` e (b) `required_plan` compatível com o `plan_tier` do profile (`schema.sql:232-240`).
3. Página renderiza `<AffiliateCard>` para cada link no grid responsivo (`page.tsx:38-50`).
4. Usuário clica em "Ver Produto" → handler `handleClick` (`affiliate-card.tsx:37`):
   - Dispara `fetch("/api/affiliate/click", { method: "POST", body: { linkId } })` em fire-and-forget (`.catch(() => {})`).
   - Abre `affiliate_url` em nova aba (`window.open(..., "_blank", "noopener,noreferrer")`).
5. Rota `POST /api/affiliate/click` (`route.ts:10`):
   - Verifica `auth()` do Clerk → 401 se não autenticado.
   - Aplica rate-limit `aff:${userId}` com `checkRateLimitAsync` (60 req/min) → 429 se exceder.
   - Valida `linkId` no body → 400 se inválido.
   - Usa `createAdminSupabaseClient()` para SELECT do `clicks_count` e UPDATE com valor `+ 1`.
   - Retorna `{ tracked: true }`.

### Fluxo: Admin cadastra novo link de afiliado
1. Admin acessa `/admin/afiliados` (`src/app/admin/afiliados/page.tsx:7`).
2. Server Action `getAffiliateLinks()` (`actions.ts:228`) é chamada — `requireAdmin()` valida role e retorna lista ordenada por `sort_order`.
3. Lista é renderizada por `<AffiliateList>`.
4. Admin clica em "Novo Produto" → abre `<Dialog>` com `<AffiliateForm>`.
5. Submit chama Server Action `createAffiliateLink(formData)` (`actions.ts:239`):
   - `requireAdmin()` valida role.
   - `parseFormData(createAffiliateSchema, formData)` valida via Zod.
   - Insert em `affiliate_links` com `is_active: true` (default).
   - `revalidatePath("/admin/afiliados")` invalida cache.
6. Dialog fecha, lista recarrega com o novo item.

### Fluxo: Admin desativa ou exclui link
1. Em `<AffiliateList>` (`affiliate-list.tsx:60`), cada linha tem botões de toggle e exclusão.
2. Toggle (`affiliate-list.tsx:106`) chama `toggleAffiliateActive(id, !is_active)` (`actions.ts:298`) — UPDATE simples em `is_active` + revalidate.
3. Exclusão (`affiliate-list.tsx:119`) usa `confirm()` do navegador, depois `deleteAffiliateLink(id)` (`actions.ts:285`) — DELETE em `affiliate_links` + revalidate.
4. Itens desativados (`is_active=false`) deixam de aparecer na vitrine pública por causa da policy `affiliates_select_by_plan`.

### Fluxo: Dashboard admin lê top afiliados
1. `getDashboardMetrics()` (`src/app/admin/actions.ts:315`) executa, entre várias queries paralelas, `supabase.from("affiliate_links").select("id, title, clicks_count").eq("is_active", true).order("clicks_count", { ascending: false }).limit(5)` (`actions.ts:383`).
2. Resultado retornado como `topAffiliates` (`actions.ts:444`) — consumido pelo dashboard admin para ranking de produtos com mais cliques. Documentação detalhada do dashboard: ver setor cruzado "Admin/Dashboard".

## 9. Observações (notas para Fase B — não auditar agora)
- **Incremento de cliques não-atômico**: `src/app/api/affiliate/click/route.ts:33` tem comentário `"RPC function não existe em database"` e implementa SELECT + UPDATE manualmente. No entanto, a função RPC `public.increment_affiliate_clicks(link_id uuid)` **existe** em `supabase/schema.sql:512`. Há condição de corrida sob carga; basta trocar para `supabase.rpc("increment_affiliate_clicks", { link_id: linkId })`.
- **`updateAffiliateLink` órfã**: a Server Action existe (`src/app/admin/actions.ts:261`) mas nenhum componente cliente a chama. Não há fluxo de edição na UI — só criar / toggle / excluir. Possível débito de UX.
- **Coluna `sort_order` sem UI**: a tabela tem `sort_order` (`schema.sql:226`) e a query da vitrine ordena por ele, mas o admin não expõe controle para reordenar (drag-and-drop ou input numérico). Sempre fica em `0`.
- **Sem paginação ou busca**: `<AffiliateList>` (admin) renderiza todos os links em uma única tabela. Pode degradar com volume alto.
- **`confirm()` nativo na exclusão**: `affiliate-list.tsx:120` usa `confirm()` do navegador em vez de um Dialog estilizado.
- **Validação JSON manual no click route**: `route.ts:24-29` poderia usar Zod (`z.object({ linkId: z.string().uuid() })`) para padronizar com o resto do projeto e validar formato UUID.
- **Tracking sem deduplicação**: cada clique conta (mesmo o mesmo usuário clicando 60x em um minuto, dentro do limite). Não há separação de "cliques únicos" vs "cliques totais".
- **Sem logs/eventos por usuário**: cliques só agregam contador; não há tabela `affiliate_clicks` com `user_id`/`timestamp`/`ip`. Impossível segmentar quem clica em quê.

## 10. Referências

### Arquivos-chave
- `src/app/(app)/afiliados/page.tsx:12` — vitrine pública
- `src/components/affiliates/affiliate-card.tsx:27` — card do produto
- `src/app/api/affiliate/click/route.ts:10` — tracking de clique
- `src/app/admin/afiliados/page.tsx:7` — entry-point admin
- `src/app/admin/afiliados/affiliate-form.tsx:23` — dialog de criação
- `src/app/admin/afiliados/affiliate-list.tsx:36` — tabela admin
- `src/app/admin/actions.ts:228-309` — bloco de Server Actions de afiliados
- `src/app/admin/actions.ts:383` — leitura no dashboard (`topAffiliates`)
- `src/lib/validations.ts:39` — `createAffiliateSchema`

### Migrations
- `supabase/schema.sql:212-247` — tabela `affiliate_links` + RLS
- `supabase/schema.sql:512-523` — função `increment_affiliate_clicks`
- `supabase/schema.sql:559` — índice `idx_affiliate_links_module`
- `supabase/migrations/20260101000000_initial_schema.sql:212` — idem (migration inicial)

### Setores cruzados
- **Auth (Clerk):** `requireAdmin()` em `src/app/admin/actions.ts:19` e `auth()` em `route.ts:11`. Ver `../plataforma/auth.md`.
- **Infra Compartilhada (Supabase):** `createServerSupabaseClient`, `createAdminSupabaseClient` em `src/lib/supabase/server.ts`; função `plan_tier_level` usada nas RLS policies (`schema.sql:237-239`). Ver `../plataforma/supabase.md`.
- **Rate-limit:** `checkRateLimitAsync` em `src/lib/rate-limit.ts`. Ver `../plataforma/rate-limit.md`.
- **Admin/Dashboard:** consome `topAffiliates` em `src/app/admin/actions.ts:383` e `src/app/admin/dashboard/page.tsx`. Ver `./admin.md` (ou setor equivalente).
- **Validações compartilhadas:** `planTierSchema` e `parseFormData` em `src/lib/validations.ts`. Ver `../plataforma/validations.md`.
- **Layout/Navbar:** link para `/afiliados` em `src/components/layout/navbar.tsx`. Ver `./layout.md` (ou setor equivalente).
