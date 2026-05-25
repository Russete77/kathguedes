# Modulo 1 — Autenticacao & Identidade (Clerk + integracao com Supabase RLS)

> Apostila tecnica do KathApp — Modulo 1 de N  
> Autor: gerado com base nos arquivos reais do repositorio em 2026-05-22  
> Nivel: intermediario-avancado (conhecimento basico de Next.js App Router presumido)

---

## Sumario

1. [O que e um IdP — e por que o Clerk](#1-o-que-e-um-idp--e-por-que-o-clerk)
2. [Instancias dev vs producao: pk_test_ vs pk_live_](#2-instancias-dev-vs-producao)
3. [APIs do Clerk no Next.js App Router](#3-apis-do-clerk-no-nextjs-app-router)
4. [O token JWT de sessao e os session claims](#4-o-token-jwt-de-sessao-e-os-session-claims)
5. [Estudo de caso: o bug do onboarding (skipCache)](#5-estudo-de-caso-o-bug-do-onboarding)
6. [Integracao nativa Clerk-Supabase via Third-Party Auth](#6-integracao-nativa-clerksupabase-via-third-party-auth)
7. [Estudo de caso: "videos nao aparecem" (RLS + role anon)](#7-estudo-de-caso-videos-nao-aparecem)
8. [O middleware de auth/admin/onboarding](#8-o-middleware-de-authadminonboarding)
9. [Mapa mental da identidade no KathApp](#9-mapa-mental-da-identidade-no-kathapp)
10. [Exercicios praticos](#10-exercicios-praticos)

---

## 1. O que e um IdP — e por que o Clerk

### Conceito

**IdP (Identity Provider)** e o servico responsavel por emitir, validar e gerenciar identidades de usuarios. Ele responde a uma pergunta simples: *"Quem e esse usuario, e eu posso confiar nessa afirmacao?"*

Antes do Clerk, o padrao para apps web era implementar autenticacao proprio: tabela `users`, hash de senha (bcrypt), sessao em cookie, refresh token, fluxo de email de confirmacao, recuperacao de senha, OAuth com provedores externos (Google, Apple)... A lista e longa. Cada peca e um vetor de bug de seguranca.

O Clerk abstrai tudo isso. Ele fornece:

- **UI pre-construida** (modais de login, cadastro, OAuth) com experiencia consistente
- **Gestao de sessao** com tokens JWT curtos (60 segundos a alguns minutos) e refresh transparente
- **OAuth social** (Google, Apple, GitHub, etc.) configurado no dashboard
- **MFA, OTP, email magico** — sem linha de codigo no seu backend
- **Webhooks** para sincronizar eventos (usuario criado, deletado) com seu banco
- **Metadados de usuario** (`publicMetadata`, `privateMetadata`, `unsafeMetadata`) — extensoes estruturadas ao perfil do usuario
- **JWKS endpoint** — para que outros servicos (como o Supabase) possam validar tokens emitidos pelo Clerk sem chamar a API do Clerk em cada request

### Por que o KathApp usa Clerk

O KathApp precisa de:
1. Login social (Google/Apple) para usuarios mobile
2. Roles (admin / usuario comum)
3. Flag de onboarding completado acessivel no middleware (sem roundtrip ao DB)
4. Integracao direta com Supabase RLS para que policies SQL funcionem sem service_role

O Clerk cobre todos os quatro pontos via session tokens customizaveis + integracao Third-Party Auth com o Supabase.

---

## 2. Instancias dev vs producao

### Como funciona

O Clerk opera com **duas instancias completamente separadas** para cada app: `Development` e `Production`. Elas nao compartilham usuarios, chaves, webhooks, nem configuracoes de session token.

| Aspecto | Development | Production |
|---|---|---|
| Publishable key | `pk_test_...` | `pk_live_...` |
| Secret key | `sk_test_...` | `sk_live_...` |
| Dominio/Issuer | `https://<slug>.clerk.accounts.dev` | `https://clerk.kathguedes.com.br` (dominio customizado) |
| Usuarios | Banco separado | Banco separado |
| Webhooks | Endpoints proprios (ex.: ngrok) | Endpoints de prod |
| JWKS URL | `<issuer>/.well-known/jwks.json` (dev) | `<issuer>/.well-known/jwks.json` (prod) |

### Publishable key vs Secret key

**Publishable key** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`):
- Pode ficar exposta no browser (comeca com `pk_`)
- Identifica o app no SDK client-side
- Usada pelo `<ClerkProvider>` para carregar o SDK no browser

**Secret key** (`CLERK_SECRET_KEY`):
- Nunca vai pro browser (variavel server-only, sem prefixo `NEXT_PUBLIC_`)
- Usada para chamadas autenticadas a API do Clerk: `clerkClient().users.updateUserMetadata()`, `clerkClient().users.getUser()`, etc.
- Equivalente a uma API key administrativa — com ela voce pode ler e mudar qualquer usuario

### No KathApp

As chaves ficam validadas em `src/lib/env.ts`. A secret key nao tem validacao explicita la (ela e consumida internamente pelo SDK `@clerk/nextjs/server` via variavel de ambiente `CLERK_SECRET_KEY`), mas a publishable key deve estar em `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

O dominio da instancia de producao e configurado em:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...` (ja encode o dominio da instancia)
- Clerk Dashboard → Production → **Configure → Domains** (dominio customizado `clerk.kathguedes.com.br`)

> **Por que dominio customizado importa?**  
> O issuer do JWT e derivado do dominio do Clerk. Quando o Supabase valida o JWT, ele chama o JWKS URL do issuer. Se voce cadastrar o issuer de dev no Supabase de producao, a validacao falha silenciosamente — todas as leituras voltam vazias. Esse foi exatamente o bug diagnosticado em 2026-05-22 (ver secao 7).

---

## 3. APIs do Clerk no Next.js App Router

O Clerk v7 distingue claramente entre contexto **server** e **client**. O import errado e silencioso: nao da erro de compilacao, mas o dado retornado e `null` ou undefined.

### 3.1 `auth()` — Server (Server Components, Route Handlers, Server Actions)

```ts
import { auth } from "@clerk/nextjs/server";

// Em um Server Component ou Route Handler:
const { userId, sessionClaims, getToken } = await auth();
```

`auth()` retorna o objeto `AuthObject`, que contem:

| Campo | Tipo | Descricao |
|---|---|---|
| `userId` | `string \| null` | ID do usuario no Clerk (ex.: `user_2abc...`) |
| `sessionId` | `string \| null` | ID da sessao atual |
| `sessionClaims` | `JwtPayload \| null` | Todo o payload do JWT decodificado |
| `getToken()` | `async fn` | Retorna o JWT string atual (ou novo se skipCache) |
| `protect()` | `fn` | Lanca redirect para login se nao autenticado |

**Onde aparece no KathApp:**

```ts
// src/lib/auth-helpers.ts (linha 1-13)
import { auth } from "@clerk/nextjs/server";

export async function isAdmin(): Promise<boolean> {
  const { sessionClaims } = await auth();
  const role =
    (sessionClaims?.metadata as { role?: string })?.role ||
    (sessionClaims as Record<string, unknown>)?.["user_role"];
  return role === "admin";
}
```

```ts
// src/middleware.ts (linha 33-37)
if (isAdminRoute(req)) {
  const session = await auth();
  if (session.sessionClaims?.metadata?.role !== "admin") {
    const url = new URL("/dashboard", req.url);
    return NextResponse.redirect(url);
  }
}
```

```ts
// src/app/api/onboarding/route.ts (linha 19-21)
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
}
```

### 3.2 `currentUser()` — Server (retorna objeto rico de usuario)

```ts
import { currentUser } from "@clerk/nextjs/server";

const user = await currentUser();
// user.firstName, user.lastName, user.emailAddresses, user.publicMetadata, etc.
```

`currentUser()` faz um roundtrip para a API do Clerk (usando a secret key) para buscar o perfil completo do usuario, incluindo dados que nao estao no JWT (como `privateMetadata`). E mais "caro" que `auth()` — use apenas quando precisar de dados do perfil que nao estao nos claims.

**Onde aparece no KathApp:**

```ts
// src/app/(app)/layout.tsx (linha 32-36)
// Quando o profile nao existe no Supabase (primeiro login), busca nome do Clerk:
const user = await currentUser();
await supabase.from("profiles").insert({
  id: userId,
  full_name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Usuario",
  plan_tier: "free",
  subscription_status: "active",
});
```

```ts
// src/app/(app)/perfil/page.tsx (linha 27-28)
const user = await currentUser();
const { userId } = await auth();
```

### 3.3 `getToken()` — Obtendo o JWT string

`getToken()` e um metodo do objeto retornado por `auth()` (server) ou do hook `useAuth()` (client). Ele retorna o JWT atual como string.

```ts
// Server — via auth():
const { getToken } = await auth();
const token = await getToken();         // usa cache interno
const freshToken = await getToken({ skipCache: true }); // forca novo token
```

```ts
// Client — via useAuth():
import { useAuth } from "@clerk/nextjs";
const { getToken } = useAuth();
const token = await getToken({ skipCache: true });
```

O `skipCache: true` e critico em cenarios pos-atualizacao de metadata (ver secao 5).

### 3.4 `sessionClaims` — O payload do JWT

`sessionClaims` e o payload JWT decodificado. O que ele contem depende do template de token configurado no Clerk Dashboard. Por padrao inclui:

```json
{
  "sub": "user_2abc...",
  "iss": "https://clerk.kathguedes.com.br",
  "iat": 1716400000,
  "exp": 1716400060,
  "azp": "https://kathguedes.com.br"
}
```

Com o template customizado do KathApp (necessario para o Supabase funcionar), adiciona-se:

```json
{
  "sub": "user_2abc...",
  "role": "authenticated",
  "metadata": {
    "role": "admin",
    "onboarding_completed": true
  }
}
```

O campo `role: "authenticated"` e o que o Supabase usa para distinguir usuarios logados de anonimos nas RLS policies (ver secao 6).

### 3.5 `publicMetadata` e `clerkClient().updateUserMetadata()`

**`publicMetadata`** e um objeto JSON livre associado ao usuario no Clerk. Ele:
- Fica armazenado no Clerk (nao no seu banco)
- So pode ser escrito pelo backend (via secret key / `clerkClient()`)
- E lido pelo client (aparece no token JWT se configurado no template)
- E a fonte de verdade para `role` e `onboarding_completed` no KathApp

Para atualizar:

```ts
import { clerkClient } from "@clerk/nextjs/server";

const clerk = await clerkClient();

// Sempre faca merge — updateUserMetadata substitui apenas as chaves passadas,
// mas e boa pratica buscar o estado atual antes:
const user = await clerk.users.getUser(userId);
const currentMetadata = (user.publicMetadata || {}) as Record<string, unknown>;

await clerk.users.updateUserMetadata(userId, {
  publicMetadata: {
    ...currentMetadata,        // preserva campos existentes
    onboarding_completed: true,
  },
});
```

**Onde aparece no KathApp:**

```ts
// src/app/api/onboarding/route.ts (linha 49-58)
const clerk = await clerkClient();
const user = await clerk.users.getUser(userId);
const currentMetadata = (user.publicMetadata || {}) as Record<string, unknown>;
await clerk.users.updateUserMetadata(userId, {
  publicMetadata: {
    ...currentMetadata,
    onboarding_completed: true,
  },
});
```

> **Nota sobre `privateMetadata` e `unsafeMetadata`:**  
> O KathApp usa apenas `publicMetadata`. `privateMetadata` nunca aparece no JWT (so via API server). `unsafeMetadata` pode ser escrita pelo client-side (inseguro para dados de controle como `role`).

---

## 4. O token JWT de sessao e os session claims

### Como funciona um JWT

Um JWT (JSON Web Token) e uma string em tres partes separadas por ponto: `header.payload.signature`. O payload e um JSON codificado em Base64url — ele nao e criptografado, apenas assinado. Qualquer um pode decodifica-lo (ex.: em jwt.io), mas so o emissor (Clerk) pode assinar um valido.

```
eyJhbGciOiJSUzI1NiJ9                          ← header (algoritmo RS256)
.eyJzdWIiOiJ1c2VyXzJhYmMiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9  ← payload
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c ← assinatura (RSA, chave privada Clerk)
```

O Supabase valida a assinatura usando a **chave publica** do Clerk (obtida via JWKS URL). Se a assinatura bater, o Supabase aceita os claims como verdade — sem chamar o Clerk.

### O template de session token (Customize session token)

Por padrao o Clerk emite um JWT minimo. Para que o Supabase e o middleware funcionem, o KathApp precisa que o token carregue claims adicionais.

**Onde configurar:** Clerk Dashboard → **Configure → Sessions → Customize session token (Edit)**

O template configurado no KathApp:

```json
{
  "role": "authenticated",
  "metadata": "{{user.public_metadata}}"
}
```

Isso resulta no JWT:
```json
{
  "sub": "user_2abc...",
  "iss": "https://clerk.kathguedes.com.br",
  "role": "authenticated",
  "metadata": {
    "role": "admin",
    "onboarding_completed": true
  }
}
```

**O claim `role: "authenticated"` e o mais critico.** Sem ele, o PostgREST (camada HTTP do Supabase) interpreta a request como feita por um usuario anonimo (`anon`), e todas as policies com `to authenticated` sao ignoradas.

### Duracao e cache do token

O Clerk emite tokens de sessao com duracao curta (tipicamente 60 segundos). O SDK do Clerk no browser faz refresh automatico antes do token expirar, atualizando o cookie de sessao.

**O ponto critico:** quando voce atualiza `publicMetadata` via API (ex.: marca `onboarding_completed: true`), o token em cache no browser **nao e invalidado imediatamente**. O browser continua usando o token antigo ate expirar naturalmente.

Isso cria uma janela de **defasagem** onde o metadata esta correto no Clerk, mas o token JWT carregado pelo middleware ainda mostra o estado antigo.

---

## 5. Estudo de caso: o bug do onboarding

### O problema

Fluxo esperado:
1. Usuario completa o formulario de onboarding
2. `POST /api/onboarding` salva no Supabase e chama `updateUserMetadata` no Clerk
3. Usuario e redirecionado para `/dashboard`
4. Middleware le `sessionClaims.metadata.onboarding_completed` = `true` → deixa passar

O que acontecia antes do fix:
1. Steps 1 e 2 funcionavam corretamente
2. Usuario era redirecionado para `/dashboard`
3. Middleware lia o token em cache — `onboarding_completed` ainda era `false` (token antigo)
4. Middleware redirecionava de volta para `/onboarding`
5. Loop infinito — so resolvia com logout/login (que forcava novo token)

### A causa tecnica

O middleware do Next.js roda no Edge Runtime e le o JWT do cookie de sessao do Clerk. Esse cookie contem o token emitido antes do `updateUserMetadata`. Mesmo que o Clerk Dashboard ja mostre `onboarding_completed: true` no perfil do usuario, o token no cookie e o que foi emitido antes — e ele e valido por mais alguns segundos/minutos.

### A solucao: `getToken({ skipCache: true })`

```ts
// src/app/onboarding/onboarding-form.tsx (linha 56-68)
// O middleware decide o gate de onboarding lendo `onboarding_completed` do
// TOKEN de sessao do Clerk. A API acabou de atualizar o publicMetadata, mas
// o token atual do browser ainda esta defasado — navegar para /dashboard
// agora seria devolvido para /onboarding (loop que so o re-login resolvia).
// skipCache forca a emissao de um token novo (com o claim atualizado) e
// atualiza o cookie que o middleware le.
await getToken({ skipCache: true });

toast.success("Perfil configurado!", {
  style: { borderLeft: "3px solid #00FF88" },
});

// Navegacao "hard": garante que a request a /dashboard ja carregue o cookie
// novo. Nao resetamos `loading` no sucesso — a pagina e trocada em seguida.
window.location.href = "/dashboard";
```

O `getToken({ skipCache: true })` instrui o SDK do Clerk a ignorar o token em cache e emitir um novo via roundtrip ao servidor do Clerk. Esse novo token ja inclui `onboarding_completed: true`. O SDK tambem atualiza automaticamente o cookie de sessao no browser.

O `window.location.href` (hard navigation, nao `router.push()`) garante que o Next.js faca uma nova request HTTP completa, carregando o cookie atualizado que o middleware vai ler.

### Diagrama do fluxo corrigido

```
[OnboardingForm]
      |
      | POST /api/onboarding
      v
[Route Handler]
  1. Salva no Supabase (admin client)
  2. updateUserMetadata Clerk (com retry)
  3. Retorna { ok: true }
      |
      | res.ok === true
      v
[OnboardingForm client]
  4. getToken({ skipCache: true })  ← CRITICO: forca novo JWT
     |  (roundtrip ao Clerk, novo cookie gravado)
  5. window.location.href = "/dashboard"
      |
      | nova request HTTP com cookie novo
      v
[Middleware]
  6. sessionClaims.metadata.onboarding_completed === true
  7. Deixa passar para /dashboard
```

> **Armadilha: nunca use `router.push()` apos `getToken({ skipCache: true })`**  
> O `router.push()` do Next.js faz uma navegacao client-side (SPA), que nao faz nova request HTTP e portanto nao atualiza o cookie lido pelo Edge Middleware. Use `window.location.href` ou `window.location.replace()` para garantir que o middleware leia o token fresco.

### A camada de retry em `POST /api/onboarding`

O Route Handler tem logica de retry para a chamada ao Clerk (exponential backoff, 3 tentativas, base 250ms):

```ts
// src/app/api/onboarding/route.ts (linha 47-65)
const CLERK_RETRY_ATTEMPTS = 3;
const CLERK_RETRY_BASE_MS = 250;

let lastClerkError: unknown = null;
for (let attempt = 1; attempt <= CLERK_RETRY_ATTEMPTS; attempt++) {
  try {
    const clerk = await clerkClient();
    // ...
    await clerk.users.updateUserMetadata(userId, { ... });
    return NextResponse.json({ ok: true });
  } catch (clerkErr) {
    lastClerkError = clerkErr;
    if (attempt < CLERK_RETRY_ATTEMPTS) {
      await new Promise((r) =>
        setTimeout(r, CLERK_RETRY_BASE_MS * 2 ** (attempt - 1))
      );
    }
  }
}
// Se falhar apos todos os retries: retorna 502
return NextResponse.json(
  { error: "Onboarding parcialmente salvo. Tente novamente." },
  { status: 502 },
);
```

Por que 502 e nao 500? Porque e uma falha de integracao com servico externo (Clerk), nao um erro interno. O cliente (OnboardingForm) checa `res.ok` e exibe o erro para o usuario repetir — que e seguro porque o update no Supabase e idempotente.

> **Armadilha: Supabase primeiro, Clerk depois**  
> A ordem importa. O update no Supabase acontece antes da chamada ao Clerk. Se o Supabase falhar, retorna 500 antes de tentar o Clerk. Se o Clerk falhar apos o Supabase, o usuario pode repetir (idempotente). Inverter a ordem seria mais fragil: o Clerk poderia ser atualizado mas o Supabase nao — e a RLS nao teria o dado correto.

---

## 6. Integracao nativa Clerk-Supabase via Third-Party Auth

### O problema que a integracao resolve

O Supabase usa RLS (Row Level Security) para controlar acesso aos dados. As policies SQL verificam quem e o usuario fazendo a request. Mas como o Supabase sabe quem e o usuario?

Antes do Third-Party Auth existir, o padrao era gerar um JWT personalizado com a secret key do Supabase (usando `jsonwebtoken` ou similar). Isso criava dependencia: o backend precisava de uma chave adicional e do codigo de assinar tokens.

O **Third-Party Auth** (lancado pelo Supabase em 2024) elimina isso: o Supabase aceita JWTs emitidos diretamente pelo Clerk, desde que:
1. O issuer do Clerk esteja registrado no Supabase como provedor confiavel
2. O JWT carregue o claim `role: "authenticated"`

O Supabase valida a assinatura do JWT usando o JWKS endpoint publico do Clerk — sem secret compartilhado, sem codigo extra.

### Como funciona o fluxo

```
[Browser/Server]
      |
      | 1. auth().getToken() → string JWT do Clerk
      v
[createClient(url, anonKey, { accessToken: () => getToken() })]
      |
      | 2. Toda request HTTP ao Supabase inclui:
      |    Authorization: Bearer <JWT do Clerk>
      v
[PostgREST / Supabase]
      |
      | 3. Supabase valida JWT:
      |    a. Busca JWKS de https://clerk.kathguedes.com.br/.well-known/jwks.json
      |    b. Verifica assinatura RSA
      |    c. Le claim "role" → se "authenticated", executa como role 'authenticated'
      |    d. Re claim "sub" → disponivel como auth.jwt()->>'sub' nas policies
      v
[RLS Policies]
  using ((select auth.jwt()->>'sub') = id)
  ← compara com o userId do Clerk direto na SQL
```

### O `createServerSupabaseClient()` do KathApp

```ts
// src/lib/supabase/server.ts (completo)
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken();  // ← JWT do Clerk, sem skipCache
      },
    }
  );
}
```

Pontos-chave:
- Usa o **anon key** (publica) — a autorizacao real vem do JWT, nao da chave
- A funcao `accessToken()` e chamada pelo SDK do Supabase em cada request
- `auth().getToken()` retorna `null` se o usuario nao esta logado — o Supabase entao usa o role `anon`, e as policies `to authenticated` nao se aplicam

### O `useSupabase()` para Client Components

```ts
// src/lib/supabase/client.ts (completo)
"use client";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

export function useSupabase() {
  const { session } = useSession();

  const client = useMemo(() => {
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        async accessToken() {
          return session?.getToken() ?? null;
        },
      }
    );
  }, [session]);

  return client;
}
```

No cliente, o token vem do `useSession()` (hook reativo) em vez de `auth()`. O `useMemo` recria o cliente apenas quando a sessao muda — evita re-renders desnecessarios.

### As RLS policies que dependem da integracao

Toda tabela do KathApp tem policies que referenciam `auth.jwt()->>'sub'`:

```sql
-- supabase/schema.sql — policy de profiles (linha 72-74)
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.jwt()->>'sub') = id);
```

```sql
-- supabase/schema.sql — policy de workout_videos (linha 187-194)
create policy workouts_select_by_plan on public.workout_videos
  for select to authenticated
  using (
    is_published = true
    and public.plan_tier_level(
      (select plan_tier from public.profiles where id = (select auth.jwt()->>'sub'))
    ) >= public.plan_tier_level(required_plan)
  );
```

`auth.jwt()` e uma funcao do Supabase que retorna o payload do JWT atual como JSON. `->>'sub'` extrai a string do campo `sub` — que e exatamente o `userId` do Clerk (ex.: `user_2abc...`). A PK da tabela `profiles` tambem e esse mesmo ID:

```sql
-- supabase/schema.sql — tabela profiles (linha 51)
create table if not exists public.profiles (
  id text primary key,  -- Clerk user_id (user_xxx)
  ...
);
```

Isso fecha o circulo: o `sub` do JWT iguala o `id` do profile, sem mapeamento extra.

### Dois clientes, dois propositos

| Cliente | Arquivo | Autentica via | RLS aplica? | Usar quando |
|---|---|---|---|---|
| `createServerSupabaseClient()` | `src/lib/supabase/server.ts` | JWT do Clerk (anon key) | **Sim** | User le/escreve o proprio dado |
| `createAdminSupabaseClient()` | `src/lib/supabase/server.ts` | `SUPABASE_SERVICE_ROLE_KEY` | **Nao** (bypass) | Webhook, cron, admin actions, operacoes que RLS nao pode cobrir |
| `useSupabase()` | `src/lib/supabase/client.ts` | JWT do Clerk via `useSession()` | **Sim** | Client Components que precisam de Supabase |

> **Armadilha: usar `createAdminSupabaseClient()` para "evitar problema de RLS"**  
> Se a RLS esta bloqueando uma operacao legitima, a solucao e corrigir a policy — nao usar o cliente admin em rota normal de usuario. O cliente admin bypassa toda segurança. Uma policy mal escrita que voce "resolve" com service_role vira um buraco de segurança esperando acontecer.

---

## 7. Estudo de caso: "videos nao aparecem"

### Sintoma (diagnosticado em 2026-05-22)

- Rota `/admin/treinos/diagnostico` reportava: `"Workouts visiveis = 0 de N"` com N videos publicados no banco, todos com `required_plan=free`, e usuario com `plan_tier=free` (nivel 0 — deveria ver tudo)
- Checkout retornava "perfil nao encontrado"
- Operacoes via admin client (webhook, CRUD admin) funcionavam normalmente
- Writes do usuario funcionavam

### A causa

A integracao Clerk-Supabase Third-Party Auth nao estava configurada corretamente. Dois problemas independentes mas com o mesmo sintoma:

**Problema 1: Supabase nao confiava no Clerk como provedor**

O Supabase precisava que o issuer do Clerk de **producao** estivesse registrado em:
`Supabase Dashboard → Authentication → Sign In / Up → Third-Party Auth → Add provider → Clerk`

Se nao configurado, o Supabase nao reconhecia o JWT como valido e tratava a request como anonima (`anon` role). Toda policy com `to authenticated` ficava inativa — 0 linhas retornadas.

**Problema 2: JWT sem o claim `role: "authenticated"`**

Mesmo com o issuer configurado, se o template de session token no Clerk nao incluia `"role": "authenticated"`, o PostgREST ainda tratava o usuario como `anon`.

**Por que writes via admin funcionavam?** O `createAdminSupabaseClient()` usa a `SUPABASE_SERVICE_ROLE_KEY` — ele nao depende do JWT do Clerk nem da integracao Third-Party Auth. As operacoes admin sempre funcionam independente dessa configuracao.

**Por que reads via admin tambem funcionavam?** Pelo mesmo motivo — service_role bypassa RLS.

### Raio-X da requisicao com e sem integracao

```
SEM integracao configurada:
  Browser → POST Supabase (Authorization: Bearer <JWT Clerk>)
  Supabase: "Nao reconheco esse issuer" → trata como anon
  PostgREST: aplica apenas policies `to anon` → quase nenhuma → 0 linhas

COM integracao correta:
  Browser → POST Supabase (Authorization: Bearer <JWT Clerk>)
  Supabase: "Issuer clerk.kathguedes.com.br ✓, assinatura ✓, role=authenticated ✓"
  PostgREST: aplica policies `to authenticated` → retorna dados do usuario
```

### Correcao (so configuracao de dashboard, zero codigo)

O codigo em `src/lib/supabase/server.ts` ja estava correto desde o inicio. A solucao era puramente configuracao:

**1. Clerk Dashboard (instancia de PRODUCAO):**
```
Configure → Sessions → Customize session token (Edit)
Adicionar o claim:  { "role": "authenticated" }
```

**2. Supabase Dashboard (projeto de producao `auplhaxwaecsppqizxej`):**
```
Authentication → Sign In / Up → Third-Party Auth → Add provider → Clerk
Informar o issuer de PRODUCAO: https://clerk.kathguedes.com.br
```

> **Armadilha: issuer de dev cadastrado em prod**  
> E um erro classico: voce configura o Third-Party Auth no Supabase, mas informa o issuer da instancia Development (`https://<slug>.clerk.accounts.dev`). Em dev funciona. Em prod o issuer do JWT e `https://clerk.kathguedes.com.br` — que nao bate com o cadastrado, e a validacao falha silenciosamente. Sempre confirme que o issuer cadastrado no Supabase corresponde a instancia Clerk que o site esta usando.

### Como diagnosticar no futuro

O KathApp tem uma rota de diagnostico em `/admin/treinos/diagnostico`. Para diagnosticar manualmente via SQL no Supabase:

```sql
-- Simular uma query autenticada:
-- (substituir pelo JWT real de um usuario logado)
SELECT auth.jwt()->>'sub' as clerk_user_id,
       auth.jwt()->>'role' as role_no_token;
-- Se "role" for NULL ou "anon": integracao nao configurada
-- Se "role" for "authenticated": integracao ok
```

---

## 8. O middleware de auth/admin/onboarding

### Como funciona o `clerkMiddleware`

O Clerk v7 exige que o middleware seja configurado com `clerkMiddleware` (importado de `@clerk/nextjs/server`). Ele:
1. Intercepta todas as requests antes dos Route Handlers/Server Components
2. Valida e decodifica o cookie de sessao do Clerk
3. Disponibiliza `auth()` (e o contexto de autenticacao) para o restante da request

### O middleware do KathApp

```ts
// src/middleware.ts (completo)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)", "/fitness(.*)", "/kath-estetica(.*)",
  "/afiliados(.*)", "/cupons(.*)", "/consultoria(.*)",
  "/calculadora(.*)", "/desafio(.*)", "/loja(.*)",
  "/perfil(.*)", "/chat(.*)", "/planos(.*)", "/onboarding(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Rotas que NAO devem redirecionar para onboarding (evita loop)
const isOnboardingExempt = createRouteMatcher([
  "/onboarding(.*)", "/api(.*)", "/login(.*)", "/registro(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // [1] Admin gate: verificar role
  if (isAdminRoute(req)) {
    const session = await auth();
    if (session.sessionClaims?.metadata?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // [2] Auth gate: exigir autenticacao
  if (isProtectedRoute(req)) {
    await auth.protect();

    // [3] Onboarding gate: forcar onboarding se nao completado
    if (!isOnboardingExempt(req) && !isAdminRoute(req)) {
      const session = await auth();
      const metadata = session.sessionClaims?.metadata as
        | { role?: string; onboarding_completed?: boolean }
        | undefined;

      if (metadata?.role !== "admin" && !metadata?.onboarding_completed) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### Os tres gates em ordem

**Gate 1 — Admin:** Se a rota comeca com `/admin`, verifica `sessionClaims.metadata.role === "admin"`. Se nao, redireciona para `/dashboard`. Note que esse gate nao chama `auth.protect()` — ele mesmo decide. Um usuario nao logado seria redirecionado para `/dashboard` (porque o claim `metadata.role` sera undefined/null). Isso poderia ser melhorado forcando login antes, mas na pratica `/admin` tambem esta em `isProtectedRoute` implicito — na segunda passagem (Gate 2), `auth.protect()` capturaria usuarios nao logados.

**Gate 2 — Auth:** `auth.protect()` verifica se ha sessao valida. Se nao houver, redireciona automaticamente para a URL de login configurada (`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`). Depois disso, o restante do middleware pode assumir que `userId` existe.

**Gate 3 — Onboarding:** Verifica `metadata.onboarding_completed`. Isencoes:
- `/onboarding(.*)`: nao pode redirecionar para si mesmo
- `/api(.*)`: APIs nao devem ser redirecionadas (quebraria webhooks e route handlers)
- `/login(.*)` e `/registro(.*)`: fluxo de auth nao pode exigir onboarding
- Admins: isentos (o admin pode nao ter passado pelo onboarding)

### Protecao contra loops

A armadilha classica de middleware de onboarding e o loop redirect:
- `/dashboard` → onboarding gate → redirect para `/onboarding`
- `/onboarding` → onboarding gate → redirect para `/onboarding` (novamente)
- Loop infinito

A solucao do KathApp e o `isOnboardingExempt`, que inclui `/onboarding(.*)` como rota que nunca aciona o Gate 3. O Gate 2 ainda exige autenticacao em `/onboarding` (esta em `isProtectedRoute`) — usuario anonimo e redirecionado para login. Mas um usuario autenticado sem onboarding pode acessar `/onboarding` sem ser chutado de volta.

### O `matcher` — quais requests o middleware intercepta

```ts
export const config = {
  matcher: [
    // Tudo exceto arquivos estaticos do Next.js (_next/) e extensoes de arquivo
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Sempre interceptar /api e /trpc
    "/(api|trpc)(.*)",
  ],
};
```

O segundo padrao `/(api|trpc)(.*)` e necessario porque o primeiro exclui extensoes `.json` — e sem ele, routes como `/api/data.json` (pouco comuns, mas possiveis) passariam sem autenticacao. Na pratica, garante que **todo** o `/api` passe pelo middleware.

> **Armadilha: verificar autenticacao manualmente em Route Handlers**  
> O middleware garante que rotas protegidas so sao acessadas por usuarios autenticados. Mas Route Handlers devem **sempre** checar `userId` explicitamente via `auth()` — porque um bug no matcher ou uma rota nova pode nao estar coberta, e porque o middleware nao sabe se voce quer o userId para logica de negocio.

---

## 9. Mapa mental da identidade no KathApp

```
                   ┌─────────────────────────────────────┐
                   │           CLERK (IdP)               │
                   │                                     │
                   │  user.id = "user_2abc..."           │
                   │  publicMetadata = {                 │
                   │    role: "admin",                   │
                   │    onboarding_completed: true       │
                   │  }                                  │
                   └──────────────┬──────────────────────┘
                                  │
                    emite JWT assinado (RS256)
                                  │
              ┌───────────────────▼───────────────────────┐
              │              JWT payload                  │
              │  sub: "user_2abc..."                      │
              │  iss: "https://clerk.kathguedes.com.br"  │
              │  role: "authenticated"                    │
              │  metadata: { role: "admin", ... }         │
              └──────┬───────────────────────┬────────────┘
                     │                       │
         le via auth()               enviado ao Supabase
         sessionClaims               Authorization: Bearer
                     │                       │
         ┌───────────▼───────┐   ┌───────────▼──────────────┐
         │    MIDDLEWARE      │   │        SUPABASE          │
         │                   │   │                          │
         │  Gate Admin:      │   │  Valida via JWKS:        │
         │  metadata.role    │   │  iss ✓, sig ✓            │
         │  === "admin"      │   │                          │
         │                   │   │  role="authenticated"    │
         │  Gate Onboarding: │   │  → aplica policies       │
         │  metadata.onb     │   │    `to authenticated`    │
         │  _completed       │   │                          │
         └───────────────────┘   │  auth.jwt()->>'sub'      │
                                  │  = "user_2abc..."        │
         ┌────────────────────┐  │  = profiles.id           │
         │    SUPABASE DB     │  └──────────────────────────┘
         │                    │
         │  profiles.id =     │
         │  "user_2abc..."    │ ← FK de todas as tabelas
         │  profiles.plan_tier│
         │  = "free"/"plano1" │
         └────────────────────┘
```

### Onde cada claim e usado

| Claim | Usado por | Para que |
|---|---|---|
| `sub` | RLS policies, Route Handlers | Identificar o usuario nas queries SQL |
| `role: "authenticated"` | PostgREST | Ativar policies `to authenticated` |
| `metadata.role` | Middleware, `isAdmin()`, UI admin | Gate de acesso admin |
| `metadata.onboarding_completed` | Middleware | Gate de onboarding |

---

## 10. Exercicios praticos

### Exercicio 1 — Tracing de uma request autenticada

**Objetivo:** entender o caminho completo de uma request a `/perfil`.

Abra os arquivos a seguir e trace o fluxo de uma request GET a `/perfil` feita por um usuario logado com plano `plano1`:

1. `src/middleware.ts`: quais gates sao ativados? O que acontece em cada um?
2. `src/app/(app)/perfil/page.tsx`: qual cliente Supabase e usado? Por que nao usa `createAdminSupabaseClient()` aqui?
3. `supabase/schema.sql` (policy `profiles_select_own`): o que `auth.jwt()->>'sub'` retorna nesse contexto? Com qual valor da tabela e comparado?

**Entrega esperada:** descricao textual do fluxo, identificando os arquivos e linhas relevantes.

---

### Exercicio 2 — Simular o bug do onboarding

**Objetivo:** entender por que `getToken({ skipCache: true })` e necessario.

1. Leia `src/app/onboarding/onboarding-form.tsx` e comente a linha `await getToken({ skipCache: true })`.
2. Complete o onboarding em um ambiente de dev.
3. Observe o comportamento: o middleware redireciona de volta para `/onboarding`?
4. Restaure a linha e repita. Compare o comportamento.

**Pergunta bonus:** quanto tempo levaria para o loop se resolver sozinho, sem o `skipCache`? (Dica: qual e a duracao padrao do token Clerk?)

---

### Exercicio 3 — Adicionar um campo ao session token

**Objetivo:** expor um dado novo via JWT sem mudar o banco.

Voce precisa que o plano do usuario (`plan_tier`) esteja disponivel nos `sessionClaims` para ser lido no middleware, sem roundtrip ao Supabase.

1. Qual seria o risco de fazer isso? (Dica: pense no lag entre mudanca de plano no Supabase e atualizacao do token)
2. Como voce adicionaria `plan_tier` ao template de session token no Clerk Dashboard? (O Clerk nao tem acesso direto ao Supabase — onde o dado precisaria estar?)
3. Qual seria a alternativa mais segura para gate de plano: no middleware (via claim) ou no Server Component (via query ao Supabase)? Por que o KathApp optou pela segunda abordagem?

---

### Exercicio 4 — Escrever uma nova policy RLS

**Objetivo:** aplicar o padrao de autenticacao do KathApp a uma nova tabela.

Imagine que voce precisa criar a tabela `user_bookmarks` (favoritos do usuario). Escreva:

1. O `CREATE TABLE` com `id`, `user_id` (FK para `profiles`), `content_id` e `created_at`
2. O `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. A policy `select_own`: usuario ve apenas seus proprios favoritos
4. A policy `insert_own`: usuario so insere com `user_id = auth.jwt()->>'sub'`
5. A policy `delete_own`: usuario so deleta o proprio
6. A policy `admin`: service_role tem acesso total

Verifique sua resposta comparando com as policies de `profiles` e `estetica_loyalty_photos` em `supabase/schema.sql` e `supabase/migration_security_hardening.sql`.

---

### Exercicio 5 — Debug de RLS: "por que esta voltando vazio?"

**Objetivo:** diagnosticar o problema de RLS da secao 7 em um ambiente novo.

Voce e contratado em um projeto que usa Clerk + Supabase com integracao Third-Party Auth. O cliente reclama que "todos os dados sumiram". Descreva:

1. As tres perguntas que voce faz primeiro (sem ver codigo)
2. Como voce valida cada hipotese usando apenas o Supabase Dashboard e o Clerk Dashboard
3. O SQL que voce rodaria no Supabase para confirmar se o JWT esta chegando corretamente e com qual role
4. Como voce distingue "integracao nao configurada" de "template de token sem claim `role`" — esses dois problemas tem o mesmo sintoma?

**Bonus:** por que operacoes de write (INSERT via `createAdminSupabaseClient()`) funcionam mesmo quando a integracao esta quebrada, mas reads via `createServerSupabaseClient()` falham?

---

## Referencias cruzadas

| Arquivo | Relevancia para este modulo |
|---|---|
| `src/middleware.ts` | Gate de auth/admin/onboarding completo |
| `src/lib/auth-helpers.ts` | `isAdmin()` e `requireAdmin()` centralizados |
| `src/lib/supabase/server.ts` | `createServerSupabaseClient()` e `createAdminSupabaseClient()` |
| `src/lib/supabase/client.ts` | `useSupabase()` para Client Components |
| `src/app/api/onboarding/route.ts` | Pattern de update Supabase + Clerk com retry |
| `src/app/onboarding/onboarding-form.tsx` | `getToken({ skipCache: true })` e hard navigation |
| `src/app/(app)/layout.tsx` | Criacao de profile on-demand + `currentUser()` |
| `src/app/(app)/perfil/page.tsx` | Uso de `auth()` + `currentUser()` + `createServerSupabaseClient()` |
| `supabase/schema.sql` | Todas as RLS policies com `auth.jwt()->>'sub'` |
| `supabase/migration_security_hardening.sql` | Pattern de policy delete_own |
| `docs/deploy/clerk-supabase-rls.md` | Diagnostico e correcao do bug de integracao |
| `docs/deploy/clerk-webhook-setup.md` | Setup de webhook Clerk → Supabase profiles |

---

*Modulo 1 concluido. Proximo: Modulo 2 — Banco de Dados & RLS (schema, migrations, policies avancadas, indexes).*
