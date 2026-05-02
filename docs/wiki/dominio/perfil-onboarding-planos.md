# Setor: Perfil, Onboarding & Planos

## 1. Visão geral
- **Propósito:** Cobrir o ciclo de vida do usuário autenticado dentro do KathApp — desde o onboarding inicial (telefone + interesses) até a visualização do perfil, dashboard pessoal e contratação/upgrade de planos pagos (Free, Start, Pro, VIP) via Asaas. Concentra a leitura/exibição do estado da assinatura e o ponto de entrada para o checkout recorrente.
- **Quem usa:** Usuário final autenticado (Clerk). Admin não tem rotas próprias neste setor — visualiza/edita perfis pelo painel admin (fora do escopo).
- **Status percebido:** **production** — todas as rotas estão implementadas, com integração Asaas funcional, redirecionamento de onboarding via middleware/layout e leitura de `profiles` no Supabase. Pequenos pontos beta listados em §9.

---

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/onboarding` | `src/app/onboarding/page.tsx:6` | Page (RSC) | Tela de boas-vindas pós-signup que renderiza `OnboardingForm` (2 passos: telefone → interesses). |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx:26` | Page (RSC, async) | Painel inicial autenticado: greeting + streak, cards de stats (streak / plano / treinos novos / último treino), atalhos rápidos, treinos recentes e CTA de upgrade para usuários `free`. |
| `/perfil` | `src/app/(app)/perfil/page.tsx:22` | Page (RSC, async) | Perfil do usuário: avatar Clerk, badges de plano e streak, contadores (streak/treinos/plano), bloco de assinatura com vencimento e atalhos (`/consultoria`, `/chat`, `/planos`, `/calculadora`). |
| `/planos` | `src/app/(app)/planos/page.tsx:82` | Page (RSC, async) | Tabela comparativa dos 4 planos (FREE/START/PRO/VIP) com botão `SubscribeButton` por plano e marcação visual do plano atual. |
| `/api/onboarding` | `src/app/api/onboarding/route.ts:10` | API Route (POST) | Persiste `phone`, `interests` e marca `onboarding_completed=true` no perfil + propaga flag para `publicMetadata` do Clerk. |

Observações:
- `loading.tsx` do dashboard (`src/app/(app)/dashboard/loading.tsx:1`) provê skeletons durante SSR.
- O grupo `(app)` impõe gate de autenticação e onboarding no layout: ver §8.

---

## 3. Componentes
- **`OnboardingForm`** (`src/app/onboarding/onboarding-form.tsx:25`) — Form client-side de 2 passos. Step 1 captura `phone` (`Input`), Step 2 mostra grid 2x2 de interesses (`treinos` / `consultoria` / `moto` / `loja`, definidos em `onboarding-form.tsx:18-23`). Faz `POST /api/onboarding` e redireciona para `/dashboard` em sucesso. Usa `sonner` para toasts.
- **`SubscribeButton`** (`src/app/(app)/planos/subscribe-button.tsx:63`) — Componente client que abre `Dialog` com 2 etapas (`select-billing` → `awaiting-payment`). Suporta PIX (com QR code base64 + copia-e-cola), Boleto e Cartão. Usa hierarquia `PLAN_HIERARCHY` (`subscribe-button.tsx:23-28`) para bloquear downgrades e marca o plano atual como "Plano Atual". Chama `POST /api/checkout/subscribe` (fora do escopo — ver §10).
- **`PerfilPage > MenuLink`** (`src/app/(app)/perfil/page.tsx:137`) — Sub-componente local para os links do menu (consultoria/chat/planos/calculadora).
- **`DashboardPage > StatCard`** (`src/app/(app)/dashboard/page.tsx:174`) — Sub-componente local para cards de stat (streak, plano, treinos novos, último treino).
- **`DashboardPage > QuickAction`** (`src/app/(app)/dashboard/page.tsx:196`) — Tile de atalho para áreas internas (`/fitness`, `/consultoria`, `/calculadora`, `/cupons`, `/loja`, `/kath-estetica`).
- **`src/components/plans/`** — Diretório existe (`src/components/plans/`) mas está **vazio** (`ls` não retorna arquivos). Toda lógica de planos está co-localizada em `src/app/(app)/planos/`.

Componentes externos consumidos (referência cruzada — ver §10):
- `StreakBadge` (`src/components/fitness/streak-badge.tsx`) — usado em `/perfil` e `/dashboard`.
- `Badge`, `Button`, `Progress`, `Input`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` (`src/components/ui/*`).
- `NotificationBell` e `BottomTabBar` injetados pelo layout `(app)` (não específicos deste setor).

---

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `/api/onboarding` (`src/app/api/onboarding/route.ts:10`) | POST | JSON `{ phone: string; interests: string[] }` | `{ ok: true }` (200) ou `{ error }` (400/401/500) | `OnboardingForm.handleSubmit` (`src/app/onboarding/onboarding-form.tsx:43`). |

Detalhes do handler `/api/onboarding`:
1. `auth()` valida sessão Clerk; sem `userId` → 401 (`route.ts:11-14`).
2. Parse do body; falha → 400 (`route.ts:16-21`).
3. `createAdminSupabaseClient()` faz `update` em `profiles` setando `phone`, `interests`, `onboarding_completed=true` (`route.ts:23-34`).
4. Atualiza `publicMetadata.onboarding_completed=true` no Clerk via `clerkClient().users.updateUserMetadata` (`route.ts:42-50`). Erro do Clerk não bloqueia — apenas loga.

**Importante:** este setor *consome* mas **não define** os endpoints de checkout/cancelamento de plano. `SubscribeButton` chama `POST /api/checkout/subscribe` (`subscribe-button.tsx:98`); o cancelamento é feito por `POST /api/checkout/cancel` (não usado dentro deste setor). Ambos pertencem ao setor de Pagamentos/Asaas — ver §10.

Não há Server Actions formais (`"use server"`) neste setor; toda mutação passa pela API Route acima ou pela criação implícita no layout (`src/app/(app)/layout.tsx:29`).

---

## 5. Modelo de dados

### Tabela `profiles` (`supabase/migrations/20260101000000_initial_schema.sql:31` + extensões em `supabase/migration_phone.sql` e `supabase/migration_audit_fixes.sql`)
Schema canônico (declarado no setor de Infra Compartilhada — só listo aqui as colunas efetivamente lidas/escritas por este setor):

- `id` text PK — Clerk `user_id` (`user_xxx`) (`initial_schema.sql:32`).
- `full_name` text not null — preenchido na criação implícita pelo layout `(app)` (`src/app/(app)/layout.tsx:31`).
- `avatar_url` text — não escrito por este setor; avatar vem direto de `currentUser().imageUrl` (`perfil/page.tsx:58`).
- `plan_tier` text default `'free'` check `(free|start|pro|vip)` (`initial_schema.sql:35-36`) — lido em `/perfil`, `/dashboard` e `/planos` para destacar plano atual e bloquear botão de assinatura. Tipado em `src/lib/supabase/types.ts:10` como `PlanTier`.
- `subscription_status` text default `'active'` check `(active|past_due|canceled)` (`initial_schema.sql:39-40`) — gravado como `'active'` no insert de auto-criação (`layout.tsx:33`).
- `subscription_ends_at` timestamptz (`initial_schema.sql:41`) — exibido em `/perfil` formatado em `pt-BR` (`perfil/page.tsx:40-42`).
- `workout_streak` int default 0 (`initial_schema.sql:42`) — lido em `/perfil` e `/dashboard` (`perfil/page.tsx:38`, `dashboard/page.tsx:44`).
- `last_workout_at` timestamptz (`initial_schema.sql:43`) — usado para o card "Último treino" (`dashboard/page.tsx:83`).
- `interests` text[] default `'{}'` (`initial_schema.sql:44`) — gravado pelo `/api/onboarding` (`route.ts:30`).
- `phone` text — adicionado por `supabase/migration_phone.sql:2` (`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text`). Gate de onboarding incompleto no layout (`layout.tsx:39`).
- `onboarding_completed` boolean default false — adicionado por `supabase/migration_audit_fixes.sql:38`. Backfill: registros com `phone IS NOT NULL` ficam true (`migration_audit_fixes.sql:43`). Index parcial `idx_profiles_onboarding` em registros incompletos (`migration_audit_fixes.sql:48`).

**RLS (resumo, definido em `initial_schema.sql:48-80`):**
- `profiles_select_own` / `profiles_update_own` — usuário só lê/edita o próprio registro (compara `auth.jwt()->>'sub'` com `id`).
- `profiles_insert_service` — apenas `service_role` insere (usado em `createAdminSupabaseClient` no layout `(app)`).
- `profiles_select_admin` / `profiles_update_admin` — `service_role` tem acesso total.

**Observação importante:** o setor lê `profiles` via `createServerSupabaseClient` (cliente autenticado, `/perfil`, `/dashboard`, `/planos`) e *escreve* via `createAdminSupabaseClient` (`/api/onboarding`, `/(app)/layout`) porque insert/update do onboarding precisa contornar a RLS de "apenas próprio perfil".

Patterns de schema/RLS globais e a função `plan_tier_level()` (`initial_schema.sql:13-25`) são responsabilidade do agente de **Infra Compartilhada** — não documentados aqui.

---

## 6. Integrações externas
- **Clerk** (`@clerk/nextjs/server`):
  - `auth()` em todas as rotas do setor (`/perfil`, `/dashboard`, `/planos`, `/api/onboarding`).
  - `currentUser()` para nome, e-mail e avatar (`/perfil`, `/dashboard`, `/(app)/layout`).
  - `clerkClient().users.updateUserMetadata` em `/api/onboarding` (`route.ts:45-50`) para gravar `publicMetadata.onboarding_completed`. Esta flag é lida pelo middleware (`src/middleware.ts:48-54`) para decidir o redirecionamento — ver §8 e §10.
- **Supabase**:
  - Cliente autenticado (RLS aplicada) — leituras em `/perfil`, `/dashboard`, `/planos`.
  - Cliente admin (service role) — escrita em `/api/onboarding` e auto-criação de profile no layout `(app)`.
- **Asaas** (consumido indiretamente):
  - `SubscribeButton` chama `/api/checkout/subscribe` que cria assinatura no Asaas e devolve `invoiceUrl`/`pixQrCode`/`pixPayload` (`subscribe-button.tsx:97-117`). Este setor **não toca** a SDK do Asaas — apenas renderiza a resposta.
- **Toast UI**: `sonner` (toasts em `OnboardingForm` e `SubscribeButton`).

---

## 7. Validações
- **Validação inline (frontend) — `OnboardingForm`** (`src/app/onboarding/onboarding-form.tsx:80-81`): botão "Continuar" exige `phone.trim()`; botão "Começar" exige `selected.length > 0`. **Não há schema Zod**.
- **Validação inline (backend) — `/api/onboarding`** (`src/app/api/onboarding/route.ts:16-21`): apenas `try/catch` em `req.json()` e checagem de `userId`. **Não há validação de formato do telefone nem whitelist dos valores de `interests`**. O domínio textual de `interests` está implícito no front (`treinos|consultoria|moto|loja`).
- **Tipagem TS** — `PlanTier` (`src/lib/supabase/types.ts:10`) é o tipo canônico do tier; `SubscribeButton` usa `Exclude<PlanTier, "free">` no prop `plan` (`subscribe-button.tsx:18`).
- **Schema Zod compartilhado:** N/A — `src/lib/validations.ts` não contém schemas para `phone`, `interests` ou `onboarding_completed` (busca em `validations.ts` retornou 0 matches). O setor é "dono lógico" do payload de `/api/onboarding`, mas hoje não declara um schema formal — ver §9.

---

## 8. Fluxos principais

### Fluxo: Onboarding pós-signup
1. Usuário completa signup no Clerk e é redirecionado para uma rota `(app)`.
2. `middleware.ts` (`src/middleware.ts:46-58`) lê `sessionClaims.metadata`. Se `role !== 'admin'` e `onboarding_completed` for falso/ausente, redireciona para `/onboarding`. Rotas excluídas do gate: `/onboarding(.*)`, `/api(.*)`, etc. (`middleware.ts:22-27`).
3. Caso o usuário acesse uma rota `(app)` direta, `src/app/(app)/layout.tsx:20-41` faz uma segunda checagem no Supabase:
   - Sem `profile` → cria com `plan_tier='free'`, `subscription_status='active'` e redireciona para `/onboarding` (`layout.tsx:27-36`).
   - `profile` sem `phone` → redireciona para `/onboarding` (`layout.tsx:39-41`).
4. Em `/onboarding`, `OnboardingForm` colhe telefone (Step 1) e interesses (Step 2).
5. Submit faz `POST /api/onboarding` → grava no Supabase (`phone`, `interests`, `onboarding_completed=true`) e atualiza `publicMetadata.onboarding_completed=true` no Clerk.
6. `router.push('/dashboard')` — middleware já não bloqueia mais.

### Fluxo: Visualização do perfil
1. Usuário navega para `/perfil`.
2. RSC obtém `currentUser()` (Clerk) e `profile` via `createServerSupabaseClient` filtrando por `id=userId` (`perfil/page.tsx:23-31`).
3. Conta agregada de treinos: `count` em `workout_logs` (`perfil/page.tsx:33-36`) — tabela referenciada (não documentada aqui — ver §10).
4. Renderiza header com avatar/nome/badge de plano + streak, grid 3x (streak/treinos/plano), bloco de assinatura com `subscription_ends_at` formatado e CTA "Fazer Upgrade" se `plan_tier !== 'vip'`.
5. Menu de navegação para subáreas (`/consultoria`, `/chat`, `/planos`, `/calculadora`).

### Fluxo: Dashboard
1. RSC `/dashboard` carrega `profile` e até 4 `workout_videos` publicados ordenados por `published_at` desc (`dashboard/page.tsx:30-42`).
2. Saudação personalizada (`firstName` do Clerk) + `StreakBadge`.
3. Stats row (4 cards) com streak, plano, número de novos treinos e estado "Ativo / —" baseado em `last_workout_at`.
4. Quick actions (6 atalhos) para subáreas do app.
5. Grid de treinos recentes com thumbnail YouTube (`https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg`).
6. Bloco "DESBLOQUEIE TUDO" exibido apenas se `plan_tier === 'free'`.

### Fluxo: Upgrade de plano
1. Usuário entra em `/planos`. RSC carrega `profile.plan_tier` (`planos/page.tsx:86-90`).
2. Para cada plano (Free/Start/Pro/VIP), renderiza card com lista de features hardcoded (`planos/page.tsx:22-80`). O plano atual recebe badge "ATUAL" (verde); o `Pro` é destacado como `featured` ("POPULAR").
3. Plano gratuito mostra botão estático "Plano Gratuito" disabled. Demais planos renderizam `<SubscribeButton plan currentPlan featured/>`.
4. Em `SubscribeButton`:
   - Se `currentPlan === plan` → "Plano Atual" disabled.
   - Se `PLAN_HIERARCHY[currentPlan] > PLAN_HIERARCHY[plan]` → "Downgrade (em breve)" disabled (`subscribe-button.tsx:78-80`, `154-160`).
5. Clique abre `Dialog` em step `select-billing` com 3 opções (PIX/Boleto/Cartão) (`subscribe-button.tsx:30-52`).
6. Seleção dispara `POST /api/checkout/subscribe` com `{ plan, billingType }` (`subscribe-button.tsx:97-102`).
7. Resposta avança para step `awaiting-payment` mostrando QR Code PIX (base64), botão de copiar `pixPayload` ou link `invoiceUrl` para Boleto/Cartão (`subscribe-button.tsx:240-364`).
8. Botão "Já paguei — atualizar página" faz `router.refresh()` (`subscribe-button.tsx:353-361`). A ativação efetiva do plano (atualização de `plan_tier`/`subscription_ends_at`) acontece via webhook Asaas — fora do escopo deste setor.

---

## 9. Observações (notas para Fase B — não auditar agora)
- **Sem validação Zod no `/api/onboarding`**: aceita qualquer string em `phone` e qualquer lista em `interests`. Recomendado introduzir `onboardingSchema` em `src/lib/validations.ts` (formato de telefone BR + enum de interesses).
- **Telefone não é normalizado**: `OnboardingForm` envia o valor literal digitado (com máscara visual `(11) 99999-9999` mas sem máscara aplicada — só `placeholder`). `migration_phone.sql` declara `text` puro.
- **Diretório `src/components/plans/` está vazio** mas existe — provável placeholder para refator futuro extraindo cards de planos.
- **`/perfil` não permite editar nada**: o menu lista links para outras áreas, mas não há form de edição de nome/telefone/avatar. Editar telefone só via re-onboarding manual (não há rota para isso).
- **Downgrade não implementado** (`subscribe-button.tsx:154-160`) — UI mostra "Downgrade (em breve)" disabled.
- **Plano "Free" sempre exibe botão estático** (`planos/page.tsx:156-159`); não há fluxo automático de cancelamento via UI deste setor (ver `/api/checkout/cancel` — fora do escopo).
- **`subscription_status` não é exibido** em `/perfil` (mostra apenas `plan_tier` e `subscription_ends_at`). Um usuário `past_due` veria a mesma UI de um `active`.
- **Layout `(app)` faz duplo gate** (middleware + layout) — redundância intencional para garantir profile existente, mas implica latência adicional (uma query a `profiles` em todo render `(app)`).
- **Erro no Clerk metadata é silenciado** (`route.ts:51-54`) — perfil fica com `onboarding_completed=true` no Supabase mas o middleware continuará redirecionando até o próximo refresh de `sessionClaims`.
- **Sem testes** — `src/app/(app)/perfil`, `src/app/onboarding`, `src/app/(app)/planos`, `src/app/api/onboarding` não possuem `*.test.ts(x)`.
- **`workout_logs` consultado em `/perfil`** (`perfil/page.tsx:33-36`) mas tabela pertence ao setor Fitness (referência cruzada).

---

## 10. Referências

### Arquivos-chave (escopo deste setor)
- `src/app/onboarding/page.tsx:1-34` — Page wrapper do onboarding.
- `src/app/onboarding/onboarding-form.tsx:1-148` — Form de 2 passos.
- `src/app/api/onboarding/route.ts:1-57` — Handler POST do onboarding.
- `src/app/(app)/perfil/page.tsx:1-147` — Tela de perfil + sub-componente `MenuLink`.
- `src/app/(app)/dashboard/page.tsx:1-218` — Dashboard + `StatCard` + `QuickAction`.
- `src/app/(app)/dashboard/loading.tsx:1-19` — Skeleton.
- `src/app/(app)/planos/page.tsx:1-173` — Tabela de planos.
- `src/app/(app)/planos/subscribe-button.tsx:1-368` — Dialog de checkout.
- `src/components/plans/` — diretório vazio.

### Migrations
- `supabase/migration_phone.sql:2` — adiciona `profiles.phone`.
- `supabase/migration_audit_fixes.sql:38-48` — adiciona `profiles.onboarding_completed`, faz backfill e cria index parcial. *(Esta migration não está no escopo formal mas é citada porque introduz coluna lida pelo handler `/api/onboarding`.)*
- `supabase/migrations/20260101000000_initial_schema.sql:31-80` — schema canônico de `profiles` + RLS (responsabilidade do setor Infra Compartilhada).

### Setores cruzados (NÃO documentados aqui — link para outros agentes)
- **Auth/Clerk + middleware**: `src/middleware.ts` (gate de onboarding/role), `clerkClient`. Setor: Auth/Plataforma.
- **Pagamentos/Asaas**: `src/app/api/checkout/subscribe/route.ts`, `src/app/api/checkout/cancel/route.ts`, `src/lib/asaas/*`, webhook que muda `plan_tier`/`subscription_ends_at`. Setor: Pagamentos.
- **Infra Supabase compartilhada**: `src/lib/supabase/server.ts` (`createServerSupabaseClient`, `createAdminSupabaseClient`), `src/lib/supabase/types.ts` (`PlanTier`), `src/lib/supabase/database.types.ts`, função `plan_tier_level()`, RLS patterns. Setor: Infra Compartilhada.
- **Fitness**: `workout_videos`, `workout_logs`, `StreakBadge` (`src/components/fitness/streak-badge.tsx`). Lidos por `/perfil` e `/dashboard` mas pertencem ao setor Fitness.
- **Layout/Navegação `(app)`**: `src/app/(app)/layout.tsx` (auto-criação de profile + gate de telefone), `BottomTabBar`, `NotificationBell`. Setor: Layout/Plataforma.
- **Notificações Push**: `NotificationBell` no header. Setor: Push/Notifications.
- **Validações compartilhadas**: `src/lib/validations.ts` — atualmente sem schema para onboarding. Setor: Infra Compartilhada.
