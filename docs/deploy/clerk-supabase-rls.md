# Integração Clerk ↔ Supabase (RLS em produção)

> Por que `/fitness`, `/perfil`, serviços, chat etc. aparecem **vazios em produção** mesmo com dados no banco — e como resolver. Diagnosticado em 2026-05-22 (ver `docs/audit/2026-05-22-cto-audit.md`).

## Sintoma
- `/admin/treinos/diagnostico` mostra "RLS está bloqueando", **"Workouts visíveis = 0 de N"** com vídeos publicados e `required_plan=free`, usuário com `plan_tier=free` (nível 0).
- Checkout dava "perfil não encontrado".
- Todas as leituras via RLS voltam vazias; writes via admin client (webhook, criação de profile no layout, CRUD admin) funcionam normalmente.

## Causa
A app lê dados do usuário com o **anon key + JWT do Clerk** (`createServerSupabaseClient`, `src/lib/supabase/server.ts`). Para a RLS funcionar:
1. O Supabase precisa **confiar no Clerk** como provedor (Third-Party Auth) — validar o JWT via JWKS do issuer do Clerk.
2. O JWT do Clerk precisa carregar o claim **`role: "authenticated"`** — senão o PostgREST trata a requisição como `anon`, e **nenhuma policy `to authenticated` se aplica** → 0 linhas.

Se qualquer um dos dois faltar (ou o issuer cadastrado for o do Clerk de **dev** enquanto o site usa o de **prod**), toda leitura RLS volta vazia.

## Lado do código — JÁ correto (não mexer)
`src/lib/supabase/server.ts` usa a abordagem nativa:
```ts
createClient(url, anonKey, { async accessToken() { return (await auth()).getToken(); } })
```
Isso está certo para a integração nativa. **Nenhuma mudança de código resolve** — é configuração de dashboard.

## Correção (dashboards de produção)

### 1. Clerk (instância de PRODUÇÃO)
- Clerk Dashboard → **Configure → Sessions → Customize session token (Edit)** → garantir o claim:
  ```json
  { "role": "authenticated" }
  ```
- Se houver atalho **Integrations → Supabase / "Connect with Supabase"**, use — ele adiciona o claim automaticamente.

### 2. Supabase (projeto de PRODUÇÃO `auplhaxwaecsppqizxej`)
- Dashboard → **Authentication → Sign In / Up → Third-Party Auth → Add provider → Clerk**.
- Informar o **issuer/domínio do Clerk de PRODUÇÃO** (ex.: `https://clerk.kathguedes.com.br`).
  - ⚠️ Conferir que NÃO é o issuer de dev (`https://<slug>.clerk.accounts.dev`). O site `www.kathguedes.com.br` usa a instância prod do Clerk; o issuer cadastrado tem que bater com ela.

### 3. Vercel (env de produção)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → todos do **mesmo** projeto de prod.

## Validação (sem deploy)
Recarregar **`/admin/treinos/diagnostico`** em produção. Esperado:
- Veredito **"Tudo correto"**.
- Seção 4: **"Workouts visíveis = N de N"**.

A partir daí, vídeos/perfil/serviços/chat passam a aparecer para os usuários.

## Nota de CSP (futuro, não bloqueia hoje)
O CSP está em **Report-Only**. Antes de promover para enforce, o Clerk cria um Web Worker via `blob:` — adicionar ao `next.config.ts`:
```
worker-src 'self' blob:;
```
e revisar `connect-src`/`style-src` (Google Fonts) conforme os reports do console. Enquanto Report-Only, nada quebra.
