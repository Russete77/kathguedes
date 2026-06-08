# Setor: Auth & Middleware

## 1. Visão geral
- **Propósito:** Gerenciar autenticação de usuários (login, registro, sessão), autorização (roles `admin` e usuário comum), guarda de rotas protegidas e fluxo forçado de onboarding via Next.js Middleware. A autenticação é delegada ao **Clerk**, que emite o JWT consumido pelo Supabase para autorizar leitura/escrita do banco.
- **Quem usa:** Tanto usuário final (login/registro/dashboard) quanto admin (área `/admin` gated por `publicMetadata.role`).
- **Status percebido:** production. Implementação enxuta e direta — Clerk como provedor único, integração JWT nativa Clerk↔Supabase, helper `isAdmin()` consolidado e middleware único cobrindo proteção, role-check de admin e enforcement de onboarding.

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/login` (catch-all `[[...rest]]`) | `src/app/(auth)/login/[[...rest]]/page.tsx:9` | Page (RSC) | Renderiza `<SignIn>` do Clerk com `routing="path"`, `signUpUrl="/registro"` e `fallbackRedirectUrl="/dashboard"`. `metadata.robots = { index: false }` para não indexar (`page.tsx:6`). |
| `/registro` (catch-all `[[...rest]]`) | `src/app/(auth)/registro/[[...rest]]/page.tsx:14` | Page (RSC) | Renderiza `<SignUp>` do Clerk com `signInUrl="/login"` e `fallbackRedirectUrl="/dashboard"`. Tem `metadata` SEO completo (canonical + OG) — esta sim indexável (`page.tsx:3-12`). |
| `/admin/**` | guard em `src/middleware.ts:32` | Middleware guard | Exige `sessionClaims.metadata.role === "admin"`; caso contrário redireciona para `/dashboard`. |
| Rotas protegidas (`/dashboard`, `/fitness`, `/kath-estetica`, `/afiliados`, `/cupons`, `/consultoria`, `/calculadora`, `/desafio`, `/loja`, `/perfil`, `/chat`, `/planos`, `/onboarding`) | `src/middleware.ts:4-18` + `src/middleware.ts:41` | Middleware guard | Exigem usuário autenticado via `auth.protect()`. |

> Observação: o catch-all `[[...rest]]` é exigido pelo Clerk quando se usa `routing="path"` para que sub-rotas internas do Clerk (verificação de e-mail, factor 2FA, recuperação de senha, etc.) funcionem dentro do mesmo path raiz.

## 3. Componentes
- **`<SignIn>`** (`src/app/(auth)/login/[[...rest]]/page.tsx:12`) — Componente do `@clerk/nextjs` que renderiza UI completa de login. Configurado com `path="/login"` e `routing="path"`.
- **`<SignUp>`** (`src/app/(auth)/registro/[[...rest]]/page.tsx:17`) — Componente do `@clerk/nextjs` que renderiza UI completa de registro com mesmo padrão de roteamento.
- **`<ClerkProvider>`** (`src/app/layout.tsx:133`) — Wrapper raiz da aplicação que injeta contexto do Clerk. Configurado com `localization={ptBR}` e `appearance.baseTheme = dark`. (Documentado aqui pois é parte do bootstrap de auth — o restante do `layout.tsx` pertence a outro setor).

> Não há componentes locais customizados em `src/app/(auth)/` — toda a UI é dos componentes "drop-in" do Clerk.

## 4. Server Actions / API Routes
N/A — o setor `Auth & Middleware` (escopo: `(auth)/login`, `(auth)/registro`, `middleware.ts`, `auth-helpers.ts`) não expõe Server Actions nem API Routes próprias. As rotas de login/registro são páginas estáticas que delegam ao Clerk; o middleware é interceptor global, não endpoint. Endpoints que **consomem** os helpers de auth (ex.: `src/app/api/onboarding/route.ts`, `src/app/api/push/send/route.ts`, `src/app/admin/actions.ts`) pertencem aos respectivos setores de domínio.

## 5. Modelo de dados
N/A — o setor não possui tabelas próprias no Supabase. O estado de autenticação vive **fora do banco**, no Clerk:
- **Identidade & sessão:** Clerk (externo).
- **Claims customizados** (lidos pelo middleware):
  - `sessionClaims.metadata.role: "admin" | undefined` — usado em `src/middleware.ts:34` e `src/lib/auth-helpers.ts:11`.
  - `sessionClaims.metadata.onboarding_completed: boolean` — usado em `src/middleware.ts:53`.
  - `sessionClaims["user_role"]` — formato legado, mantido por compatibilidade em `src/lib/auth-helpers.ts:12`.

Esses campos são populados via **Clerk `publicMetadata`** (atualizada por outro setor — ver Onboarding em "10. Referências"). O JWT emitido pelo Clerk carrega esses claims, e o Supabase os valida via JWKS para aplicar RLS — porém **as policies RLS em si pertencem ao setor Infra Compartilhada** (não documentadas aqui).

## 6. Integrações externas
### Clerk (provedor único de auth)
- **SDK:** `@clerk/nextjs` (cliente: `useSession`; servidor: `auth()` de `@clerk/nextjs/server`).
- **Provider raiz:** `<ClerkProvider>` em `src/app/layout.tsx:133` — localização `ptBR`, tema `dark`.
- **Middleware:** `clerkMiddleware()` em `src/middleware.ts:30`, registrado via `export config.matcher` (`src/middleware.ts:61-66`) que captura tudo exceto assets estáticos e adiciona `(api|trpc)(.*)` explicitamente.
- **Variáveis de ambiente** (referência indireta — não estão em `src/lib/env.ts`, são lidas pelo SDK do Clerk diretamente do processo):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — chave pública (visto em `.github/workflows/ci.yml:56` como `pk_test_placeholder`).
  - `CLERK_SECRET_KEY` — chave secreta (`.github/workflows/ci.yml:57` como `sk_test_placeholder`).
- **Redirect URLs configurados nas páginas:**
  - Login → `fallbackRedirectUrl="/dashboard"` (`login/[[...rest]]/page.tsx:16`).
  - Registro → `fallbackRedirectUrl="/dashboard"` (`registro/[[...rest]]/page.tsx:21`).
  - Cross-link: `signUpUrl="/registro"` e `signInUrl="/login"`.
- **Roteamento interno:** `routing="path"` exige catch-all `[[...rest]]` no diretório da rota — confirmado no filesystem (`src/app/(auth)/login/[[...rest]]/`, `src/app/(auth)/registro/[[...rest]]/`).
- **Providers de identidade configurados:** N/A — não estão definidos em código; são configurados no dashboard do Clerk (fora deste repo). O código apenas consome o resultado.

### Integração Clerk ↔ Supabase via JWT (third-party auth nativo)
- **Padrão usado:** Clerk emite o JWT da sessão; Supabase valida via JWKS do Clerk (integração "third-party auth" nativa, sem Edge Function intermediária).
- **Cliente browser:** `useSupabase()` em `src/lib/supabase/client.ts:14` lê `session.getToken()` do `useSession()` (linha 23) e passa via `accessToken` callback para `createClient` do `@supabase/supabase-js`.
- **Cliente servidor:** `src/lib/supabase/server.ts:17` chama `(await auth()).getToken()` para popular o mesmo callback.
- **Comentários doc-in-code (fonte da verdade):** `src/lib/supabase/client.ts:10-11` e `src/lib/supabase/server.ts:7-8` afirmam: _"O Supabase valida o JWT via JWKS do Clerk (integração nativa)"_ — ou seja, **não há `JWT template` customizado** no Clerk; usa-se o token de sessão padrão e o Supabase está configurado para confiar no issuer do Clerk.

> A documentação detalhada dos clientes Supabase (factory, RLS, types) é responsabilidade do setor Infra Compartilhada — aqui apenas se descreve a ponte de auth.

## 7. Validações
N/A — este setor não declara schemas Zod. As páginas `/login` e `/registro` são compostas exclusivamente por componentes do Clerk, que aplicam suas próprias validações (e-mail, força de senha, captcha) internamente. O `middleware.ts` faz checagens de tipo em runtime via type-cast (`src/middleware.ts:47-49`) sem usar Zod. Não há entradas em `src/lib/validations.ts` referentes a auth.

## 8. Fluxos principais

### Fluxo: Login
1. Usuário visita `/login` → `src/app/(auth)/login/[[...rest]]/page.tsx` renderiza `<SignIn>` do Clerk.
2. Clerk processa credenciais (e-mail/senha ou OAuth — providers definidos no dashboard).
3. Em sucesso, Clerk redireciona para `fallbackRedirectUrl="/dashboard"` (`page.tsx:16`).
4. Requisição a `/dashboard` passa pelo `clerkMiddleware` (`src/middleware.ts:30`) → `isProtectedRoute(req)` é true → `auth.protect()` valida sessão (já autenticada) → segue para o handler.
5. Middleware checa `sessionClaims.metadata.onboarding_completed`. Se falso e `role !== "admin"`, redireciona para `/onboarding` (`src/middleware.ts:53-56`).

### Fluxo: Registro
1. Usuário visita `/registro` → `<SignUp>` do Clerk.
2. Em sucesso, novo usuário criado no Clerk (sem `publicMetadata.onboarding_completed`).
3. Clerk redireciona para `/dashboard` (`fallbackRedirectUrl`).
4. Middleware detecta usuário sem `onboarding_completed` → redireciona para `/onboarding` (loop prevention via `isOnboardingExempt`, `src/middleware.ts:23-28`).
5. Após o usuário completar o onboarding (fluxo de outro setor), a flag é setada em `publicMetadata` e o middleware passa a permitir o acesso.

### Fluxo: Acesso a rota administrativa (`/admin/**`)
1. Requisição entra no middleware (`src/middleware.ts:30`).
2. `isAdminRoute(req)` é true (`src/middleware.ts:32`).
3. Middleware lê `session.sessionClaims.metadata.role` (`src/middleware.ts:34`).
4. Se `role !== "admin"` → redireciona para `/dashboard` (`src/middleware.ts:35-36`).
5. Caso contrário, segue. Routes/Server Actions admin podem revalidar via `requireAdmin()` (`src/lib/auth-helpers.ts:16-21`) que lança `Error("Acesso negado: apenas admin")`.

### Fluxo: Verificação de admin em API/Server Action
1. Endpoint chama `isAdmin()` (`src/lib/auth-helpers.ts:7`).
2. Helper invoca `auth()` do Clerk e lê `sessionClaims.metadata.role` **OU** `sessionClaims["user_role"]` (compat — `src/lib/auth-helpers.ts:10-13`).
3. Retorna `boolean`. `requireAdmin()` é a versão throw-on-fail.
4. Consumido por: `src/app/api/push/send/route.ts:5`, `src/app/admin/actions.ts`, `src/app/admin/kath-estetica/actions.ts` (esses endpoints pertencem a outros setores).

### Fluxo: Autenticação de chamada Supabase (browser)
1. Componente client chama `useSupabase()` (`src/lib/supabase/client.ts:14`).
2. Hook obtém `session` via `useSession()` do Clerk.
3. `createClient` do Supabase recebe `accessToken: () => session?.getToken() ?? null` (`src/lib/supabase/client.ts:22-24`).
4. Cada requisição Supabase carrega o JWT do Clerk no header `Authorization`.
5. Supabase valida via JWKS público do Clerk e aplica RLS conforme claims.

## 9. Observações (notas para Fase B — não auditar agora)
- **Compat de claims duplicado** (`src/lib/auth-helpers.ts:10-13`): o helper aceita tanto `sessionClaims.metadata.role` quanto `sessionClaims.user_role`. Já há um comentário em código indicando que o objetivo era padronizar — vale auditar se ainda existe algum lugar emitindo `user_role` no JWT template do Clerk e remover o fallback.
- **Type-cast manual no middleware** (`src/middleware.ts:47-49`): `metadata as { role?: string; onboarding_completed?: boolean } | undefined` — sem validação Zod. Um JWT mal-formado/manipulado seria silenciosamente tratado como "sem onboarding". Aceitável dado que Clerk assina o JWT, mas vale considerar runtime check.
- **Dupla checagem de onboarding** (`src/middleware.ts:45`): a condição `!isOnboardingExempt(req) && !isAdminRoute(req)` é redundante porque já está dentro do branch `isProtectedRoute(req)` e `isAdminRoute` é tratado antes — `isAdminRoute(req)` aqui nunca é true neste ponto. Cosmético, sem impacto funcional.
- **Sem tratamento explícito de logout/sign-out**: nenhuma rota em `(auth)` cobre logout — Clerk gerencia via `<UserButton>` ou `signOut()` em outros pontos da app (fora deste setor).
- **Sem testes** específicos para `auth-helpers.ts` ou `middleware.ts` no escopo (nenhum `*.test.ts` em `src/lib/auth-helpers*` ou `src/middleware*`).
- **`appearance.baseTheme: dark`** (`src/app/layout.tsx:136`) está hard-coded — se o app no futuro tiver light mode, o Clerk vai destoar.

## 10. Referências
### Arquivos-chave (escopo deste setor)
- `src/middleware.ts:1-66` — middleware Clerk com matcher de rotas protegidas, admin-gate e onboarding-gate.
- `src/lib/auth-helpers.ts:7-21` — `isAdmin()` e `requireAdmin()`.
- `src/app/(auth)/login/[[...rest]]/page.tsx:1-20` — página de login (`<SignIn>`).
- `src/app/(auth)/registro/[[...rest]]/page.tsx:1-25` — página de registro (`<SignUp>`).

### Arquivos correlatos (fora do escopo — citados em runtime)
- `src/app/layout.tsx:3,133-155` — `<ClerkProvider>` raiz com localização ptBR e tema dark.
- `src/lib/supabase/client.ts:1-30` — ponte Clerk→Supabase (browser) via `accessToken` callback.
- `src/lib/supabase/server.ts:1,17` — ponte Clerk→Supabase (server).
- `.github/workflows/ci.yml:56-57` — placeholders das chaves Clerk em CI.

### Migrations
N/A — não há migration deste setor (auth não persiste no Supabase).

### Setores cruzados
- **Onboarding & Perfil** (`docs/wiki/dominio/onboarding.md` ou similar): consome `publicMetadata.onboarding_completed` e é o setor que **escreve** essa flag (ver `src/app/api/onboarding/route.ts:39-49`, fora deste escopo).
- **Infra Compartilhada / Supabase** (`docs/wiki/plataforma/supabase.md` ou similar): documenta `src/lib/supabase/{client,server,types,database.types}.ts`, schema das tabelas e policies RLS que dependem dos claims emitidos pelo Clerk.
- **Admin** (`docs/wiki/dominio/admin.md` ou similar): consumidor primário de `isAdmin()`/`requireAdmin()` em `src/app/admin/actions.ts` e `src/app/admin/kath-estetica/actions.ts`.
- **Push Notifications** (`docs/wiki/plataforma/push.md` ou similar): consumidor de `isAdmin()` em `src/app/api/push/send/route.ts:5`.
- **Layout / SEO** (`docs/wiki/plataforma/layout.md` ou similar): dono do `<ClerkProvider>` em `src/app/layout.tsx`; aqui apenas mencionamos por ser o bootstrap de auth.
