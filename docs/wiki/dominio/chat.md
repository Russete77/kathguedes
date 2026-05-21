# Setor: Chat

> **2026-05-02 — Refactor do modelo de mensagens.** Coluna `messages.is_from_kath` (boolean) substituída por `messages.sender_role` enum `('user'|'kath'|'sidney'|'admin')` — admin escolhe se responde como Kath ou Sidney via dropdown em `/admin/chat`. Política de envio mudou de `plan_tier = 'vip'` para `plan_tier IN ('plano3','atleta')` — Plano 3 (R$ 99,90, SLA 48h) e Atleta (R$ 309,90, SLA 12h prioritário + vídeo 1-1 mensal). Detalhes em [`docs/wiki/plataforma/financeiro.md`](../plataforma/financeiro.md).

## 1. Visão geral
- **Propósito:** Canal de mensagens diretas entre assinantes Plano 3+ e a equipe (Kath ou Sidney), com persistência em Supabase e atualizações em tempo real via Supabase Realtime. Acesso de envio restrito a `plan_tier IN ('plano3','atleta')` via RLS.
- **Quem usa:** Usuário final VIP (em `/chat`) e admin/Kath (em `/admin/chat`, com inbox agrupada por assinante).
- **Status percebido:** production — fluxos de leitura/escrita, realtime e push notification de resposta da admin estão implementados; flag `is_read` existe na tabela mas nenhuma rotina de marcação como lida foi encontrada nos arquivos do setor (ver "Observações").

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/chat` | `src/app/(app)/chat/page.tsx:14` | Server Component (App Router) | Tela do assinante. Faz `auth()` (Clerk), checa `profiles.plan_tier === 'vip'`, e renderiza `<ChatRoom>` ou um upsell para `/planos` (`page.tsx:25-41`). Inclui `metadata` SEO (`page.tsx:9-12`). |
| `/chat` (loading) | `src/app/(app)/chat/loading.tsx:1` | Server Component (Suspense fallback) | Skeleton com bolhas alternadas em `bg-bg-2` enquanto a página carrega. |
| `/admin/chat` | `src/app/admin/chat/page.tsx:6` | Server Component | Inbox VIP. Usa `createAdminSupabaseClient()` para listar `messages` ordenadas desc, agrupa por `user_id` em `Map`, junta `profiles(full_name, avatar_url)` e calcula contagem de não-lidas (`is_from_kath = false AND is_read = false`) (`page.tsx:11-50`). Renderiza `<AdminChatInbox>`. |

Proteção de rota: `/chat(.*)` está em `isProtectedRoute` no Clerk middleware (`src/middleware.ts:15`). `/admin/chat` herda a proteção de `/admin(.*)` (`src/middleware.ts:20`), com gating adicional de admin em `src/app/admin/layout.tsx`.

## 3. Componentes
- **`ChatRoom`** (`src/app/(app)/chat/chat-room.tsx:13`) — Client Component. Consome o hook `useRealtimeMessages(userId)` para histórico + stream em tempo real, mantém estado local de input e flag `sending`, faz auto-scroll para o final em todo update (`chat-room.tsx:20-22`) e restaura o texto no input em caso de erro de envio (`chat-room.tsx:33-34`). Bolhas estilizadas conforme `is_from_kath` (rosa à direita = usuário, escura à esquerda = Kath, `chat-room.tsx:60-88`).
- **`AdminChatInbox`** (`src/app/admin/chat/admin-chat-inbox.tsx:21`) — Client Component. Layout duas colunas (sidebar 300px + thread). Estado `selected: user_id | null`. Esconde sidebar em mobile quando há thread selecionada (`admin-chat-inbox.tsx:42-44`).
- **`AdminChatThread`** (`src/app/admin/chat/admin-chat-inbox.tsx:101`) — Sub-component privado. Carrega histórico filtrado por `user_id`, monta canal Realtime `admin-chat-${userId}` (`admin-chat-inbox.tsx:132-156`), envia mensagens com `is_from_kath: true` e dispara push notification para o assinante via `POST /api/push/send` em fire-and-forget com `.catch(() => {})` (`admin-chat-inbox.tsx:178-187`).

Componentes UI compartilhados consumidos: `Button` (`@/components/ui/button`) e `Badge` (`@/components/ui/badge`) — documentados pelo agente "Componentes UI".

## 4. Server Actions / API Routes
Não existem Server Actions nem API Routes próprias do setor Chat. Todas as gravações usam o cliente Supabase no browser (com RLS aplicada) e o setor consome um endpoint externo:

| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `supabase.from('messages').insert(...)` (usuário) | INSERT direto | `{ user_id, body, is_from_kath: false }` (`src/hooks/use-realtime-messages.ts:69-73`) | `{ error }` propagado como `throw` | `ChatRoom` via `sendMessage` (`chat-room.tsx:32`) |
| `supabase.from('messages').insert(...)` (admin) | INSERT direto | `{ user_id, body, is_from_kath: true }` (`admin-chat-inbox.tsx:171-175`) | Sem retorno consumido | `AdminChatThread.handleSend` (`admin-chat-inbox.tsx:163`) |
| `supabase.from('messages').select(...)` | SELECT | filtros `user_id`, ordering `created_at` | `Message[]` | Hook + `AdminChatThread` (`use-realtime-messages.ts:27-34`, `admin-chat-inbox.tsx:120-128`) |
| Canal Realtime `chat-${userId}` / `admin-chat-${userId}` | WS (postgres_changes) | filter `user_id=eq.${userId}`, event `INSERT` | Stream de `Message` | Hook + thread admin (`use-realtime-messages.ts:41-60`, `admin-chat-inbox.tsx:133-151`) |
| `POST /api/push/send` | HTTP POST | `{ userId, title: "Nova mensagem da Kath", body: <truncado 60 chars>, url: "/chat" }` (`admin-chat-inbox.tsx:181-186`) | `{ sent: true }` ignorado | `AdminChatThread.handleSend` ao responder |

A rota `/api/push/send` (`src/app/api/push/send/route.ts:13`) é responsabilidade do setor "Push Notifications" — aqui apenas consumimos.

## 5. Modelo de dados
### Tabela `messages` (`supabase/migrations/20260101000000_initial_schema.sql:295`)
- `id`: `uuid` (pk, default `gen_random_uuid()`)
- `user_id`: `text not null` — default `auth.jwt()->>'sub'`, FK para `public.profiles(id)` (Clerk user id) (`initial_schema.sql:297`)
- `body`: `text not null` — corpo da mensagem
- `is_from_kath`: `boolean not null default false` — true = mensagem da admin
- `is_read`: `boolean not null default false` — flag de leitura (consumida pela inbox para badge de não-lidas)
- `created_at`: `timestamptz not null default now()`

Índices:
- `idx_messages_user` em `(user_id, created_at desc)` (`initial_schema.sql:490`)
- `idx_messages_user_is_read` em `(user_id, is_read)` (`supabase/migration_fixes.sql:52`)

**RLS:** habilitada em `messages` (`initial_schema.sql:304`). Três policies:
- `messages_select_own` (`initial_schema.sql:307-310`) — `select` para `authenticated` onde `auth.jwt()->>'sub' = user_id` (cada VIP só vê suas próprias).
- `messages_insert_vip` (`initial_schema.sql:313-319`) — `insert` para `authenticated` exigindo (a) `user_id` igual ao `sub` do JWT e (b) o profile correspondente ter `plan_tier = 'vip'`. Admin não consegue inserir por essa policy (não bate plan_tier vip).
- `messages_admin` (`initial_schema.sql:322-326`) — `for all` para `service_role` com `using/with check (true)`. É por essa policy que `AdminChatThread` consegue inserir respostas com `is_from_kath: true` — porém o componente atual usa `useSupabase()` (cliente browser autenticado), não `service_role`. Ver "Observações".

Padrões globais de schema/RLS (extensões, helpers `auth.jwt()`, role `service_role`) são documentados pelo agente "Infra Compartilhada".

## 6. Integrações externas
- **Supabase Realtime** — canais `chat-${userId}` (browser do assinante) e `admin-chat-${userId}` (browser da admin), filtro `postgres_changes` em `INSERT` na tabela `messages` por `user_id` (`use-realtime-messages.ts:41-60`, `admin-chat-inbox.tsx:133-151`). Cleanup com `supabase.removeChannel(channel)` no unmount.
- **Web Push (VAPID)** via `POST /api/push/send` para notificar o assinante quando a Kath responde (`admin-chat-inbox.tsx:178-187`). O setor "Push Notifications" detém a implementação (`src/lib/push/webpush.ts`, schemas e VAPID keys).
- **Clerk** — `auth()` em `src/app/(app)/chat/page.tsx:15` para obter `userId`. Detalhes do subsistema de autenticação ficam com o setor "Auth/Plataforma".

Nenhuma integração com Asaas, YouTube ou serviços de envio é usada pelo setor Chat.

## 7. Validações
- **N/A — não há schemas Zod específicos para o setor.** A única validação client-side é `body.trim()` (`chat-room.tsx:26`, `admin-chat-inbox.tsx:165`). Não há verificação de tamanho máximo, sanitização de HTML, nem rate-limit no envio de mensagens. Validação de plano (`plan_tier === 'vip'`) é feita server-side em `page.tsx:25` e enforced novamente pela RLS `messages_insert_vip`.

## 8. Fluxos principais

### Fluxo: Assinante VIP envia mensagem
1. Usuário acessa `/chat`. Middleware Clerk garante autenticação (`src/middleware.ts:15`).
2. `ChatPage` (server) busca `profiles.plan_tier`. Se diferente de `'vip'`, renderiza CTA para `/planos` (`page.tsx:19-41`).
3. `<ChatRoom>` monta. Hook `useRealtimeMessages` faz SELECT inicial filtrado por `user_id` e abre canal realtime `chat-${userId}` (`use-realtime-messages.ts:25-65`).
4. Usuário digita e submete. `handleSend` limpa input otimisticamente, chama `sendMessage(body)` que faz `supabase.from('messages').insert({ user_id, body, is_from_kath: false })` (`use-realtime-messages.ts:68-75`).
5. RLS `messages_insert_vip` valida `auth.jwt()->>'sub' = user_id` e `plan_tier = 'vip'` (`initial_schema.sql:313-319`).
6. INSERT dispara o `postgres_changes` no canal — a própria UI recebe via realtime e adiciona à lista (com guard de duplicata em `use-realtime-messages.ts:54`). Auto-scroll para o final.
7. Em caso de erro, o texto é restaurado no input (`chat-room.tsx:34`).

### Fluxo: Kath responde via inbox admin
1. Admin acessa `/admin/chat`. Server component faz query `service_role` em `messages` e agrupa por `user_id` (`page.tsx:11-50`).
2. `<AdminChatInbox>` lista conversas (sidebar) com badge de não-lidas (`unread = count(is_from_kath=false AND is_read=false)`).
3. Admin clica em uma conversa → `setSelected(user_id)` → renderiza `<AdminChatThread>` que carrega mensagens daquele `user_id` e abre canal `admin-chat-${userId}` (`admin-chat-inbox.tsx:118-156`).
4. Admin digita e envia. `handleSend` faz `supabase.from('messages').insert({ user_id, body, is_from_kath: true })` (`admin-chat-inbox.tsx:171-175`).
5. Em paralelo (fire-and-forget), `fetch('/api/push/send', { userId, title: "Nova mensagem da Kath", body, url: "/chat" })` envia push para o assinante (`admin-chat-inbox.tsx:178-187`).
6. Realtime propaga o INSERT para a aba do assinante (canal `chat-${userId}`) e para a própria thread admin.

## 9. Observações (notas para Fase B — não auditar agora)
- **`is_read` nunca é setado para `true`.** Não foi encontrada nenhuma rotina (Server Action, trigger, useEffect) que marque mensagens como lidas após o admin abrir a thread ou após o usuário visualizar. Consequência: o badge de não-lidas em `admin-chat-inbox.tsx:60-63` continua incrementando indefinidamente.
- **Admin escreve `is_from_kath: true` usando o cliente browser autenticado** (`useSupabase()` em `admin-chat-inbox.tsx:110`), não `service_role`. As policies definidas (`messages_select_own`, `messages_insert_vip`) não permitiriam isso, exceto se o usuário admin tiver `plan_tier = 'vip'` em `profiles`, ou se houver outra policy/sobrescrita não localizada nos arquivos auditados. Investigar consistência da RLS para o papel admin.
- **Falta validação de tamanho/conteúdo** de `body` (sem `maxLength`, sem sanitização). Mensagens podem ser arbitrariamente longas.
- **Sem rate-limit de envio** no setor Chat (existe rate-limit em `/api/push/send`, mas não no INSERT de mensagens). Apenas a flag `sending` previne duplo-clique local.
- **Push fire-and-forget silencioso**: `.catch(() => {})` em `admin-chat-inbox.tsx:187` engole erros — admin não recebe feedback se o push falha.
- **Sem upload de mídia/anexos**: o schema só tem `body: text`. Chat é text-only.
- **Sem indicador de "digitando"**, sem confirmação de leitura, sem paginação no histórico (carrega tudo de uma vez ordenado asc).
- **`page.tsx:14`** usa `userId!` (non-null assertion) sem checar `userId` — depende do middleware Clerk para garantir autenticação.

## 10. Referências
- **Arquivos-chave:**
  - `src/app/(app)/chat/page.tsx:14` — server page do assinante.
  - `src/app/(app)/chat/chat-room.tsx:13` — UI client de chat do usuário.
  - `src/app/(app)/chat/loading.tsx:1` — skeleton.
  - `src/app/admin/chat/page.tsx:6` — inbox server (agrupamento por user_id).
  - `src/app/admin/chat/admin-chat-inbox.tsx:21` — UI inbox + thread admin.
  - `src/hooks/use-realtime-messages.ts:19` — hook compartilhado de realtime + send (reutilizado pelo lado VIP).
- **Migrations:**
  - `supabase/migrations/20260101000000_initial_schema.sql` — bloco `7. MESSAGES` (linhas 293-326), índice `idx_messages_user` (linha 490).
  - `supabase/migration_fixes.sql:52` — índice `idx_messages_user_is_read`.
  - `supabase/schema.sql:293-326` (espelho do schema).
- **Setores cruzados:**
  - Auth/Clerk → setor "Auth/Plataforma" (consumo de `auth()` em `page.tsx:15` e middleware em `src/middleware.ts:15`).
  - Push Notifications → setor "Push" (`src/app/api/push/send/route.ts`, `src/lib/push/webpush.ts`).
  - Profiles & `plan_tier` (gating VIP) → setor "Perfil/Planos" (tabela `profiles`, link de menu em `src/app/(app)/perfil/page.tsx:129`).
  - Supabase clients (`createServerSupabaseClient`, `createAdminSupabaseClient`, `useSupabase`) → setor "Infra Compartilhada" (`src/lib/supabase/`).
  - Componentes UI (`Button`, `Badge`) → setor "Componentes UI" (`src/components/ui/`).
  - Dashboard admin (link de entrada para `/admin/chat`) → setor "Admin" (`src/app/admin/dashboard/page.tsx:72`, `src/app/admin/layout.tsx:51`).
