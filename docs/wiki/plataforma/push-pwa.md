# Setor: Push & PWA

## 1. Visão geral
- **Propósito:** Implementa o canal de notificações Web Push (VAPID) e a configuração de PWA (manifest + Service Worker) do KathApp. Centraliza o envio de notificações (push + in-app) para uso transversal por todos os domínios (Fitness, Loja, Consultoria, Estética, Pagamentos).
- **Quem usa:** Ambos. Usuário final recebe (browser/PWA instalado) e o admin dispara manualmente em `/admin/push` (`src/app/admin/push/push-form.tsx:13`). Disparos automáticos partem de webhooks/server-actions de outros setores via `notifyUser`/`notifyByPlan` (`src/lib/notifications.ts:20`, `:68`).
- **Status percebido:** production. Há, no entanto, um hook `usePushSubscribe` (`src/hooks/use-push-subscribe.ts:9`) **não consumido** por nenhum componente do app (Grep: zero importações fora do próprio arquivo) — ver Observações.

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/admin/push` | `src/app/admin/push/page.tsx:5` | Page (admin) | UI de envio manual de notificações (broadcast ou usuário). |
| `/api/push/subscribe` | `src/app/api/push/subscribe/route.ts:10` / `:50` | API Route (POST/DELETE) | Salva/remove a subscription do browser do usuário autenticado. |
| `/api/push/send` | `src/app/api/push/send/route.ts:13` | API Route (POST, admin) | Dispara push + cria notificação in-app. Broadcast (todos) ou `userId` específico. |
| `/sw.js` | `public/sw.js:1` | Static (Service Worker) | Listeners `push`, `notificationclick`, `install`, `activate`. |
| `/manifest.json` | `public/manifest.json:1` | Static (PWA manifest) | Define `name`, `start_url=/dashboard`, `display=standalone`, ícones e cores. |

## 3. Componentes
- **`PushForm`** (`src/app/admin/push/push-form.tsx:13`) — formulário client-side com seletor `broadcast | user`, campos `title`, `body`, `url` (deep link opcional) e `userId` (Clerk). Faz `fetch("/api/push/send", { method: "POST" })` (`push-form.tsx:26`) e exibe preview ao vivo (`:133-147`). Inclui rodapé com lista informativa de gatilhos automáticos já implementados em outros setores (`:169-176`).
- **`AdminPushPage`** (`src/app/admin/push/page.tsx:5`) — wrapper server-component (apenas título + `<PushForm />`).
- **`usePushSubscribe`** (`src/hooks/use-push-subscribe.ts:9`) — client hook (não é componente, mas vive no escopo deste setor). Encapsula:
  1. Permissão de Notification (`:26`).
  2. Registro do SW `/sw.js` (`:31`).
  3. `pushManager.subscribe` com `applicationServerKey` derivada de `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (`:35-44`).
  4. POST/DELETE para `/api/push/subscribe` (`:47`, `:67`).
  Helper `urlBase64ToUint8Array` (`:77`) converte a chave VAPID para o formato esperado pelo browser. **Atualmente não consumido por nenhum componente** — ver Observações.

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `/api/push/subscribe` (`src/app/api/push/subscribe/route.ts:10`) | POST | `{ subscription: PushSubscriptionJSON }` | `{ subscribed: true }` | `usePushSubscribe.subscribe` (`src/hooks/use-push-subscribe.ts:47`). Idempotente: faz upsert evitando duplicar mesmo `endpoint` para o mesmo `user_id` (`route.ts:29-41`). |
| `/api/push/subscribe` (`src/app/api/push/subscribe/route.ts:50`) | DELETE | (vazio) | `{ unsubscribed: true }` | `usePushSubscribe.unsubscribe` (`src/hooks/use-push-subscribe.ts:67`). Apaga **todas** as subscriptions do `user_id` autenticado (`route.ts:57-60`). |
| `/api/push/send` (`src/app/api/push/send/route.ts:13`) | POST | `{ title, body, url?, userId? }` | `{ sent: true }` ou erro (`401`/`403`/`429`/`400`) | `PushForm.handleSend` (`src/app/admin/push/push-form.tsx:26`). Restrito a admin (`route.ts:26`) com rate-limit 10/min/admin (`:20`). |
| `sendPushNotification` (`src/lib/push/webpush.ts:27`) | função | `subscription`, `payload` | `Promise<boolean>` | Uso interno por `sendPushToUser` e `sendPushBroadcast`. Chama `webPush.sendNotification` (`:38`). Captura erro e retorna `false`. |
| `sendPushToUser` (`src/lib/push/webpush.ts:49`) | função | `userId`, `payload` | `Promise<void>` | `notifyUser` (`src/lib/notifications.ts:33`), `notifyByPlan` (`src/lib/notifications.ts:99`), `/api/push/send` (`route.ts:42`). Lê todas subscriptions do user e despacha em paralelo via `Promise.allSettled`. |
| `sendPushBroadcast` (`src/lib/push/webpush.ts:72`) | função | `payload` | `Promise<void>` | `notifyAll` (`src/lib/notifications.ts:62`), `/api/push/send` (`route.ts:57`). Envia em batches de 50 (`webpush.ts:82-93`). |
| `notifyUser` (`src/lib/notifications.ts:20`) | função | `userId`, `{ title, body, icon?, url? }` | `Promise<void>` | API canónica para notificar 1 user. Insere linha em `notifications` (in-app) **e** dispara push fire-and-forget (`:33`). |
| `notifyAll` (`src/lib/notifications.ts:39`) | função | `{ title, body, icon?, url? }` | `Promise<void>` | Insere notificação in-app para todos os `profiles` em batches de 100 (`:55-58`) + push broadcast. |
| `notifyByPlan` (`src/lib/notifications.ts:68`) | função | `minPlan: "free"\|"start"\|"pro"\|"vip"`, `params` | `Promise<void>` | Filtra `profiles` por `plan_tier` em (`free`, `start`, `pro`, `vip`) ≥ `minPlan` (`:73-80`) e despacha in-app + push individuais. |

## 5. Modelo de dados

### Tabela `push_subscriptions` (`supabase/migration_notifications.sql:6-11`)
- `id uuid pk default gen_random_uuid()` — identificador da subscription.
- `user_id text not null` — FK para `public.profiles(id)` com `on delete cascade` (Clerk user id, daí `text`).
- `subscription jsonb not null` — objeto bruto `{ endpoint, keys: { p256dh, auth } }` retornado por `pushManager.subscribe`.
- `created_at timestamptz not null default now()`.
- **Índice:** `idx_push_user on push_subscriptions(user_id)` (`migration_notifications.sql:68`).
- **RLS:** habilitado (`:13`). Policies:
  - `push_select_own` — usuário autenticado lê apenas as suas (`:15-18`).
  - `push_insert_own` — usuário autenticado insere apenas para si (`:20-23`).
  - `push_delete_own` — usuário autenticado deleta apenas as suas (`:25-28`).
  - `push_admin` — `service_role` tem acesso total (`:30-34`). É por aí que `createAdminSupabaseClient` despacha broadcasts.
- **Detalhe de upsert:** o endpoint UNIQUE não está declarado em SQL; a deduplicação é feita em código via `eq("subscription->>endpoint", sub.endpoint)` (`src/app/api/push/subscribe/route.ts:33`). Isso assume entrega serial — em corrida pode permitir duplicata.

### Tabela `notifications` (`supabase/migration_notifications.sql:37-46`)
- `id uuid pk default gen_random_uuid()`.
- `user_id text not null` — FK `profiles(id) on delete cascade`.
- `title text not null`.
- `body text not null`.
- `icon text` — nome de ícone Lucide (string). Comentário no SQL: `lucide icon name` (`:42`).
- `url text` — deep link interno do app.
- `is_read boolean not null default false`.
- `created_at timestamptz not null default now()`.
- **Índice:** `idx_notif_user on notifications(user_id, is_read, created_at desc)` (`migration_notifications.sql:69`) — otimizado para "minhas não-lidas mais recentes".
- **RLS:** habilitado (`:48`). Policies:
  - `notif_select_own` — leitura apenas das suas (`:50-53`).
  - `notif_update_own` — update apenas das suas (usado para marcar como lido) (`:55-59`).
  - `notif_admin` — `service_role` total (`:61-65`).
  - **Não há policy de INSERT para `authenticated`** — inserções partem sempre do server via `createAdminSupabaseClient` (vide `notifyUser` `src/lib/notifications.ts:24` e `/api/push/send` `route.ts:49`).

## 6. Integrações externas
- **Web Push API / VAPID**
  - **Lib server:** `web-push` (npm), instanciada em `src/lib/push/webpush.ts:12`.
  - **Chaves (env):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (browser, exposta via `process.env`) e `VAPID_PRIVATE_KEY` (server). Ambas validadas em `src/lib/env.ts:40` e `:51`. Email de contato em `VAPID_EMAIL` (default `mailto:contato@kathapp.com` — `src/lib/env.ts:73`, `webpush.ts:33`).
  - **Geração:** `npx web-push generate-vapid-keys` (instrução em comentário, `src/lib/push/webpush.ts:5`).
  - **Setup chamado por envio:** `webPush.setVapidDetails(email, public, private)` em **toda** chamada de `sendPushNotification` (`webpush.ts:32-36`) — ineficiente porém correto.
  - **Formato do payload (server → browser):** JSON serializado contendo `{ title, body, icon?, url?, tag? }` (`webpush.ts:15-21`, `:38`). É decodificado no SW via `event.data.json()` (`public/sw.js:9`).
  - **Endpoints push:** definidos pelo browser do usuário (FCM para Chrome, Mozilla autopush para Firefox, Apple Push para Safari) — armazenados em `push_subscriptions.subscription.endpoint`.
  - **Frequência:** sob demanda. Disparos vêm de:
    1. Admin manual via `/admin/push` → `/api/push/send`.
    2. Eventos de domínio (referenciados no §10 — fora do escopo deste setor).
  - **Rate limit no envio admin:** 10 requests/min por admin (`/api/push/send` `:20`) usando `checkRateLimitAsync`.
  - **Resiliência de envio:** `Promise.allSettled` para não falhar tudo ao 1º erro (`webpush.ts:62-66`, `:85-92`); erros caem para `console.error` em `sendPushNotification` (`:41`). Subscriptions inválidas (410 Gone) **não** são removidas automaticamente — ver Observações.

- **Service Worker (`public/sw.js`)**
  - **Versão:** `SW_VERSION = "1.0.0"` (`sw.js:3`) — apenas string informativa, não há lógica de versionamento de cache.
  - **Listeners:**
    - `push` (`sw.js:6-22`): chama `showNotification(title, { body, icon, badge, tag, data: { url }, vibrate })`. Defaults: `icon = /icons/icon-192.png`, `badge = /icons/icon-192.png`, `tag = "kathapp"` (sobrescrito → uma notificação por vez salvo se `tag` vier no payload), `data.url = /dashboard`, `vibrate = [200, 100, 200]`.
    - `notificationclick` (`sw.js:25-40`): fecha a notificação, foca uma janela KathApp aberta e navega via `client.navigate(url)` ou abre nova com `clients.openWindow(url)`.
    - `install` (`sw.js:43-45`): `skipWaiting()`.
    - `activate` (`sw.js:48-50`): `clients.claim()`.
  - **Sem cache offline** — o SW atual cobre apenas push. Não há `fetch` handler.

- **PWA (`public/manifest.json`)**
  - `name: "KathApp — Treinos e Consultoria Fitness"`, `short_name: "KathApp"` (`manifest.json:2-3`).
  - `start_url: "/dashboard"` (`:5`), `display: "standalone"` (`:6`), `orientation: "portrait"` (`:9`).
  - `background_color: "#080808"`, `theme_color: "#FF0080"` (`:7-8`). O `themeColor` do viewport em `src/app/layout.tsx:120` é `#080808` — divergência intencional (manifest usa rosa, viewport browser-chrome usa preto).
  - `categories: ["fitness", "health", "lifestyle"]`, `lang: "pt-BR"` (`:10-11`).
  - **Ícones (`:12-95`):** 16 entradas cobrindo 16x16 → 512x512, com 2 maskables (192 e 512).
  - **Apple-specific:** `apple-touch-icon.png` em `/` (declarado em `src/app/layout.tsx:58-60`); `appleWebApp.statusBarStyle = "black-translucent"` (`layout.tsx:65-72`).
  - **Link com layout:** `metadata.manifest = "/manifest.json"` em `src/app/layout.tsx:48`.

## 7. Validações
- **`/api/push/send`** (`src/app/api/push/send/route.ts:31-36`) — validação inline ad-hoc: `payload.title` e `payload.body` obrigatórios; sem schema Zod. Erros retornam `{ error: "title e body obrigatórios" }` 400.
- **`/api/push/subscribe`** (`src/app/api/push/subscribe/route.ts:17-23`) — validação inline: presença de `body.subscription`. **Não valida** estrutura interna `{ endpoint, keys: { p256dh, auth } }`; confia no shape entregue pelo browser. Cast como `unknown` → `Json` (`:39`).
- **Auth:** `await auth()` do Clerk em ambas as rotas (`subscribe/route.ts:11`, `send/route.ts:14`). `/api/push/send` adicionalmente exige `await checkAdmin()` (`send/route.ts:26`, helper em `src/lib/auth-helpers.ts:7`).
- **Rate limit:** `checkRateLimitAsync(`push:${userId}`, { maxRequests: 10, windowMs: 60_000 })` em `/api/push/send` (`:20`). N/A em `/api/push/subscribe`.
- Não há schema dedicado em `src/lib/validations.ts` para este setor — N/A para validações Zod centralizadas (justificativa: payload trivial e validação manual já presente).

## 8. Fluxos principais

### Fluxo: Inscrição do usuário (subscribe)
1. Componente chama `usePushSubscribe().subscribe()` (`src/hooks/use-push-subscribe.ts:18`).
2. Pede `Notification.requestPermission()` (`:26`); aborta se `!= "granted"`.
3. `navigator.serviceWorker.register("/sw.js")` (`:31`) e `await navigator.serviceWorker.ready`.
4. Lê `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e converte para `Uint8Array` via `urlBase64ToUint8Array` (`:35-43`, `:77-82`).
5. `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` (`:41`).
6. POST `/api/push/subscribe` com `sub.toJSON()` (`:47-51`).
7. Server: Clerk `auth()` → `createAdminSupabaseClient()` → upsert por `(user_id, endpoint)` em `push_subscriptions` (`src/app/api/push/subscribe/route.ts:11-41`).
8. Hook seta `subscribed = true`.

### Fluxo: Envio admin manual (broadcast ou usuário)
1. Admin abre `/admin/push` (`src/app/admin/push/page.tsx:5`).
2. Preenche `title`, `body`, `url?` e seleciona `target = "broadcast" | "user"` (com `userId` Clerk se individual) — `push-form.tsx:13-55`.
3. Submit → `POST /api/push/send` com payload (`push-form.tsx:26-34`).
4. Server: Clerk `auth` (`route.ts:14`) → rate-limit 10/min (`:20`) → `checkAdmin()` (`:26`) → parse mínimo (`:32-36`).
5. Branch:
   - **`userId` setado:** `sendPushToUser(userId, …)` (`webpush.ts:49`) busca subscriptions do user e dispara push em paralelo + insere `notifications` row (`route.ts:42-54`).
   - **Broadcast:** `sendPushBroadcast(...)` (`webpush.ts:72`) lê todas as subscriptions e despacha em batches de 50 + insere `notifications` rows em batches de 100 para todos os `profiles` (`route.ts:57-83`).
6. Browser do destinatário recebe via SW `push` event → `showNotification` (`sw.js:6-22`).
7. Click → SW navega para `data.url` (default `/dashboard`) — `sw.js:25-40`.

### Fluxo: Notificação programática a partir de outros domínios
1. Server action / webhook (ex: `webhook/asaas`, `admin/actions.ts`) importa `notifyUser` ou `notifyByPlan` de `@/lib/notifications`.
2. `notifyUser(userId, params)` (`src/lib/notifications.ts:20-34`):
   - Insere row em `notifications` (canal in-app).
   - Dispara `sendPushToUser(userId, params)` em background (`.catch(() => {})` — não bloqueia o caller).
3. `notifyByPlan(minPlan, params)` (`:68-101`):
   - Filtra `profiles.plan_tier` em (`free`,`start`,`pro`,`vip`) ≥ `minPlan` (`:73-80`).
   - Insere `notifications` em batches de 100 (`:84-96`).
   - Dispara push para cada user em paralelo via `Promise.allSettled` (`:99-100`).
4. `notifyAll(params)` (`:39-63`): in-app para todos + `sendPushBroadcast`.

### Fluxo: Cancelamento (unsubscribe)
1. `usePushSubscribe().unsubscribe()` (`src/hooks/use-push-subscribe.ts:61`).
2. `getRegistration` → `getSubscription()` → `sub.unsubscribe()` no browser.
3. DELETE `/api/push/subscribe` → server apaga **todas** as subscriptions do `userId` autenticado (`src/app/api/push/subscribe/route.ts:57-60`).

## 9. Observações (notas para Fase B — não auditar agora)
- **`usePushSubscribe` órfão:** o hook (`src/hooks/use-push-subscribe.ts:9`) está implementado, mas Grep por `usePushSubscribe` retorna apenas o próprio arquivo — **nenhum componente o consome**. Não há UI/CTA convidando o usuário final a se inscrever para push. Sem isso, `push_subscriptions` permanece vazia salvo testes manuais.
- **Subscriptions stale não são purgadas:** `sendPushNotification` retorna `false` em erro (`src/lib/push/webpush.ts:39-43`) mas não distingue 410 Gone / 404 NotRegistered. Endpoints expirados continuam na tabela, sendo retentados a cada broadcast. Padrão recomendado: `delete from push_subscriptions where ... endpoint = ?` quando o status do `web-push` for 410/404.
- **`setVapidDetails` redundante:** chamado dentro de `sendPushNotification` (`webpush.ts:32-36`), portanto a cada envio. Ideal subir uma única vez no boot do módulo.
- **Sem cache offline / app-shell no SW:** `public/sw.js` é exclusivamente push. Para PWA "verdadeiro" (instalável com fallback offline) faltam `fetch` handler, `caches.addAll(...)` no `install`, e estratégia (network-first / stale-while-revalidate). O `manifest.json` já habilita instalação.
- **`tag` default colide entre notificações simultâneas:** se o payload omite `tag`, o SW usa `"kathapp"` (`sw.js:17`), o que **substitui** notificações anteriores (comportamento padrão do tag). Para múltiplas notificações empilhadas, sempre passar `tag` único no payload.
- **Sem unique constraint de `(user_id, endpoint)`** em `push_subscriptions` (`supabase/migration_notifications.sql:6-11`) — a dedup é feita em código (`subscribe/route.ts:29-34`), suscetível a corrida.
- **`notifications.icon` usa "lucide icon name"** (comentário em `migration_notifications.sql:42`), mas o SW espera **URL** absoluta para `icon` na chamada `showNotification` (`sw.js:14`). Atualmente nenhum caller envia `icon` na rota `/api/push/send` (sempre `undefined`), então o SW cai no default `/icons/icon-192.png`. A coluna existe para uso futuro pelo canal in-app (UI consome ícone Lucide pelo nome).
- **`/api/push/send` admin rate-limit é fraco** (10/min, in-memory se sem Redis — `src/lib/env.ts:55-62`). Em multi-instância serverless o limite efetivo se multiplica.
- **Path em escopo fora do domínio:** `src/app/admin/templates/` foi listado no escopo, porém esses arquivos (`page.tsx`, `template-editor.tsx`, `template-list.tsx`, `seed-button.tsx`, `seed-templates-button.tsx`) gerenciam **templates de treino e dieta** (vide `getTemplates("workout")` / `getTemplates("diet")` em `src/app/admin/templates/page.tsx:9-12`), **não templates de push**. Conteúdo pertence a outros setores (Fitness/Consultoria) — N/A aqui.

## 10. Referências
- **Arquivos-chave:**
  - `src/lib/push/webpush.ts:1-95` — envio low-level (sendPushNotification/User/Broadcast).
  - `src/lib/notifications.ts:1-101` — orquestração push + in-app.
  - `src/app/api/push/subscribe/route.ts:1-63` — POST/DELETE subscription.
  - `src/app/api/push/send/route.ts:1-87` — POST disparo admin.
  - `src/app/admin/push/page.tsx:5-19` e `src/app/admin/push/push-form.tsx:1-186` — UI de envio admin.
  - `src/hooks/use-push-subscribe.ts:1-82` — client hook (não-consumido).
  - `public/sw.js:1-50` — Service Worker.
  - `public/manifest.json:1-96` — PWA manifest.
  - `src/app/layout.tsx:48` (`manifest`), `:58-60` (apple icon), `:65-72` (`appleWebApp`), `:120` (`themeColor`) — wiring PWA.
  - `src/lib/env.ts:40` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), `:51` (`VAPID_PRIVATE_KEY`), `:73` (`VAPID_EMAIL`).

- **Migrations:**
  - `supabase/migration_notifications.sql` — cria `push_subscriptions` e `notifications` com RLS e índices.

- **Setores cruzados (não documentar aqui — apenas referência):**
  - **Fitness** dispara `notifyByPlan` ao publicar treino/cupom: `src/app/admin/actions.ts:66`, `:162` → ver setor Fitness/Cupons.
  - **Consultoria** dispara `notifyUser` em entrega/anamnese: `src/app/admin/actions.ts:497`, `src/app/admin/actions.ts:553`, `src/app/api/consultoria/anamnese/route.ts:4` → ver setor Consultoria.
  - **Loja** dispara `notifyUser` em pedido enviado: `src/app/admin/actions.ts:717` → ver setor Loja/Pedidos.
  - **Pagamentos (Asaas)** dispara `notifyUser` em confirmação/atraso: `src/app/api/webhook/asaas/route.ts:82`, `:145`, `:154`, `:177` → ver setor Pagamentos/Asaas.
  - **Kath Estética** dispara `notifyUser` em booking/foto: `src/app/admin/kath-estetica/actions.ts:157`, `:227` → ver setor Estética.
  - **Auth/Admin helpers:** `src/lib/auth-helpers.ts:7` (`isAdmin`) usado por `/api/push/send` → ver setor Auth.
  - **Rate-limit:** `src/lib/rate-limit.ts` (`checkRateLimitAsync`) usado por `/api/push/send` → ver setor Infra/Rate-limit.
  - **Tabela `profiles`** (FK origem de `user_id` em ambas as tabelas, e fonte de `plan_tier` para `notifyByPlan`) → ver setor Auth/Profiles.
  - **UI in-app de leitura de `notifications`** (lista de notificações no app, marcar-como-lido) — pertence ao setor de Layout/Shell (sino de notificações), referenciar lá.
