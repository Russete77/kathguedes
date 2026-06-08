# Modulo 5 — Infraestrutura, Deploy & Operacao

> Apostila tecnica KathApp — versao 1.0 (maio 2026)

---

## Sumario

1. [Vercel: ambientes, variaveis e logs](#1-vercel-ambientes-variaveis-e-logs)
2. [Topologia de deploy do projeto](#2-topologia-de-deploy-do-projeto)
3. [Git aplicado: branches, historicos desconexos e segredos no remote](#3-git-aplicado)
4. [Rate limiting com Redis/ioredis](#4-rate-limiting-com-redisioredis)
5. [Cron jobs: seguranca e implementacoes reais](#5-cron-jobs)
6. [CSP & cabecalhos de seguranca](#6-csp--cabecalhos-de-seguranca)
7. [Web Push / VAPID](#7-web-push--vapid)
8. [Exercicios](#8-exercicios)

---

## 1. Vercel: ambientes, variaveis e logs

### 1.1 Tres ambientes distintos

A Vercel separa cada projeto em tres contextos:

| Ambiente | Descricao | `VERCEL_ENV` |
|---|---|---|
| **Production** | Deploy a partir da branch de producao configurada no projeto | `"production"` |
| **Preview** | Deploy automatico para cada Pull Request ou push em branch nao-producao | `"preview"` |
| **Development** | `vercel dev` na maquina local | `"development"` |

Cada ambiente pode ter um conjunto independente de variaveis de ambiente definidas no painel Vercel (Settings > Environment Variables). Isso permite, por exemplo, usar a URL do Asaas sandbox em Preview e a URL de producao em Production, sem alterar codigo.

### 1.2 Validacao de variaveis: `src/lib/env.ts`

O KathApp valida variaveis de ambiente em tempo de execucao com tres helpers:

```typescript
// src/lib/env.ts (linhas 6-35)

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error("[env] Missing required environment variable: " + name);
  }
  return value;
}

function requiredInProduction(name: string): string {
  const value = process.env[name];
  const isProd =
    process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (!value && isProd) {
    throw new Error(
      "[env] Missing required environment variable in production: " + name + ...
    );
  }
  return value || "";
}
```

- `required()` — explode em qualquer ambiente. Usado para segredos criticos como `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `VAPID_PRIVATE_KEY`.
- `requiredInProduction()` — silencioso em Preview/dev, explode em Production. Usado para `REDIS_URL` e `SENTRY_DSN`.
- `optional()` — retorna fallback. Usado para `ASAAS_ENV` (default `"sandbox"`) e `VAPID_EMAIL`.

Porque essa separacao importa: um deploy Preview sem Redis nao explode — usa fallback in-memory. Em Production, o mesmo deploy explodiria imediatamente, antes de servir qualquer request.

> **Armadilha: variavel nova exige REDEPLOY**
>
> A Vercel injeta variaveis de ambiente em tempo de build/deploy, nao em tempo real. Adicionar uma variavel no painel e salvar NAO afeta o deployment em execucao. E necessario re-deployar (Deployments > Redeploy) para que o novo valor chegue ao servidor. Isso vale tambem para variaveis `NEXT_PUBLIC_*`, que sao injetadas no bundle do cliente durante o build.

### 1.3 IPs serverless dinamicos e o problema com Asaas

Funcoes serverless da Vercel nao possuem IP fixo. A cada invocacao, o IP de saida pode ser diferente, escolhido da pool da AWS/GCP subjacente.

**Consequencia pratica:** configurar allowlist de IP no painel do Asaas NAO funciona para o KathApp. Qualquer requisicao a `api.asaas.com` pode partir de qualquer IP do range Vercel. A autenticacao deve ser feita exclusivamente via `ASAAS_API_KEY` no header `access_token`, que ja e o padrao do projeto.

```typescript
// src/lib/asaas/client.ts — autenticacao por API key, nao por IP
headers: {
  "access_token": env.ASAAS_API_KEY,
  "Content-Type": "application/json",
}
```

### 1.4 Logs de funcao: onde erros 500 aparecem de verdade

O console do navegador so exibe o status HTTP (ex.: `500 Internal Server Error`). A causa real do erro fica nos logs do servidor, acessiveis em:

**Vercel Dashboard > projeto > Logs** (aba Functions ou Runtime Logs)

Filtros uteis:
- Por rota: `/api/cron/order-timeout`
- Por nivel: `error`
- Por intervalo de tempo: correlacionar com o timestamp do erro reportado pelo usuario

Toda rota do KathApp usa `handleApiError` de `src/lib/api-error.ts`, que loga o erro original antes de retornar o status HTTP. O Sentry tambem captura esses erros em producao (via `SENTRY_DSN`).

> **Armadilha: console.log nao aparece no browser**
>
> Em Server Components e Route Handlers, `console.log` vai para os logs da Vercel, nao para o DevTools do browser. Ao depurar um 500, sempre abrir o painel de logs da Vercel, nao inspecionar a aba Network do browser.

---

## 2. Topologia de deploy do projeto

### 2.1 Branch de producao

O KathApp usa uma topologia nao convencional:

- **Branch de producao:** `kathguedes-app1.0`
- **Branch main:** existe no repositorio, mas tem historico git **nao relacionado** (merge-base vazio com `kathguedes-app1.0`)

Isso significa que as duas branches nao compartilham nenhum commit ancestral comum. Tentar um `git merge` entre elas resultaria em erro ou conflitos catastróficos por toda a arvore de arquivos.

```bash
# Verificar se ha merge-base
git merge-base main kathguedes-app1.0
# Sem saida = sem ancestral comum = historicos desconexos
```

### 2.2 Como promover conteudo entre branches

Como `git merge` e `git rebase` sao inviáveis entre branches sem ancestral comum, use `git cherry-pick` para mover commits especificos:

```bash
# Estando em kathguedes-app1.0, trazer um commit especifico de main:
git cherry-pick <commit-sha>

# Para um range de commits:
git cherry-pick <sha-inicial>^..<sha-final>
```

Para mover um arquivo inteiro (nao um commit):
```bash
# Copiar o estado atual de um arquivo de main para kathguedes-app1.0
git checkout main -- caminho/para/arquivo.ts
git commit -m "chore: sync arquivo.ts from main"
```

> **Armadilha: NAO fazer git merge entre main e kathguedes-app1.0**
>
> Git trata branches sem ancestral comum como historicos "orfaos". Um `git merge main` dentro de `kathguedes-app1.0` tentaria combinar toda a arvore de arquivos de main com a arvore atual, gerando milhares de conflitos. Use sempre `cherry-pick` ou `checkout -- arquivo` para transferencias pontuais.

### 2.3 Configuracao da branch de producao na Vercel

No painel Vercel (Settings > Git), a branch de producao deve estar apontada para `kathguedes-app1.0`, nao para `main`. Pushes para `main` geram apenas deployments de Preview, sem impacto em usuarios finais.

---

## 3. Git aplicado

### 3.1 Branches e fluxo de trabalho

O fluxo recomendado e:

```
kathguedes-app1.0  (producao)
  └── feature/nome-da-feature  (desenvolvimento)
       └── PR -> kathguedes-app1.0
```

Branches de feature partem de `kathguedes-app1.0` e retornam para ela via Pull Request. A Vercel cria automaticamente um deployment de Preview para cada PR aberto.

### 3.2 Segredo no remote: PAT em texto puro na URL

O remote `origin` do repositorio esta configurado com um Personal Access Token (PAT) do GitHub em texto puro na URL:

```
https://Russete77:github_pat_11BPVS2AY0O...@github.com/Russete77/kathguedes.git
```

Isso e um risco de seguranca grave: qualquer processo que rode `git remote -v`, scripts de CI mal configurados, ou logs de terminal podem expor o token. O token tambem fica gravado no `.git/config` do repositorio local.

**Como corrigir — opcao A (SSH):**

```bash
# 1. Gerar chave SSH (se nao tiver)
ssh-keygen -t ed25519 -C "seu@email.com"

# 2. Adicionar a chave publica no GitHub (Settings > SSH Keys)

# 3. Trocar o remote
git remote set-url origin git@github.com:Russete77/kathguedes.git

# 4. Verificar
git remote -v
# origin  git@github.com:Russete77/kathguedes.git (fetch)
```

**Como corrigir — opcao B (credential helper):**

```bash
# Usar credential store do sistema operacional
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper manager      # Windows
git config --global credential.helper store        # Linux (guarda em ~/.git-credentials)

# Remover token da URL
git remote set-url origin https://github.com/Russete77/kathguedes.git

# Proxima operacao git pedira usuario/senha (ou token) e vai guardar
```

> **Armadilha: o token ja pode ter sido logado**
>
> Se o repositorio foi clonado em alguma maquina CI ou ambiente compartilhado, o token pode ter aparecido em logs. Apos trocar o remote, revogar o PAT antigo no GitHub (Settings > Developer settings > Personal access tokens) e gerar um novo.

---

## 4. Rate limiting com Redis/ioredis

### 4.1 Por que rate limiting e obrigatorio em rotas de cobranca

Rotas que criam cobranças no Asaas (assinaturas, pagamentos de loja, pagamentos de estetica) sao alvos naturais de ataques de automacao: um ator malicioso pode disparar centenas de requisicoes em segundos, criando cobranças invalidas, esgotando creditos ou gerando disputas no cartao.

O rate limiting protege essas rotas limitando quantas requisicoes um usuario autenticado pode fazer em uma janela de tempo.

### 4.2 Arquitetura: Redis primeiro, in-memory como fallback

O modulo `src/lib/rate-limit.ts` implementa dois algoritmos:

**Redis (sliding window):** usa um Sorted Set no Redis. Cada requisicao adiciona uma entrada com score = timestamp. Entradas expiradas sao removidas antes da contagem. A operacao e atomica via pipeline.

```typescript
// src/lib/rate-limit.ts (linhas 95-123)
async function checkRedisRateLimit(client, key, config) {
  const redisKey = `rl:${key}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const pipeline = client.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart); // remove expirados
  pipeline.zcard(redisKey);                             // conta atuais
  pipeline.zadd(redisKey, now.toString(), `${now}:${Math.random()}`); // adiciona
  pipeline.pexpire(redisKey, config.windowMs);          // TTL

  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) || 0;

  return count >= config.maxRequests
    ? { allowed: false, remaining: 0 }
    : { allowed: true, remaining: config.maxRequests - count - 1 };
}
```

**In-memory (token bucket):** usa um `Map` local. Funciona em instancia unica (dev local), mas e ineficaz em producao serverless onde cada invocacao pode ser uma instancia diferente.

### 4.3 Por que o fallback in-memory e perigoso em producao

Em producao serverless (Vercel), multiplas instancias da funcao rodam em paralelo. Cada instancia tem seu proprio `Map` em memoria. Um usuario pode fazer 30 requisicoes por instancia — se houver 10 instancias ativas, o limite efetivo vira 300 requisicoes, nao 30.

Por isso `REDIS_URL` e marcada como `requiredInProduction` em `src/lib/env.ts`:

```typescript
// src/lib/env.ts (linhas 56-63)
get REDIS_URL() {
  return requiredInProduction("REDIS_URL");
},
```

> **Armadilha: REDIS_URL ausente em producao = limite ineficaz**
>
> Se `REDIS_URL` nao for configurada em producao, a aplicacao NAO explode imediatamente (o `required` nao e chamado no modulo de rate limit, apenas no `env.ts`). O log vai mostrar `[rate-limit] Redis connection failed — using in-memory fallback`, e o limite passa a multiplicar pelo numero de instancias. Monitorar esse log no painel da Vercel.

### 4.4 Rotas com rate limiting obrigatorio

Toda rota que cria uma cobranca no Asaas usa `checkRateLimitAsync` com a mesma configuracao base: **5 requisicoes por minuto por usuario**.

| Rota | Chave de rate limit |
|---|---|
| `POST /api/checkout/subscribe` | `subscribe:{userId}` |
| `POST /api/loja/payment` | `loja-payment:{userId}` |
| `POST /api/loja/checkout` | `checkout:{userId}` |
| `POST /api/estetica/bookings` | `estetica-booking:{userId}` |
| `POST /api/estetica/bookings/[id]/payment` | `estetica-payment:{userId}` |

Padrao de uso em todas essas rotas:

```typescript
import { checkRateLimitAsync } from "@/lib/rate-limit";

// Dentro do handler, logo apos autenticar o usuario:
const { allowed } = await checkRateLimitAsync(`subscribe:${userId}`, {
  maxRequests: 5,
  windowMs: 60_000,  // 1 minuto
});

if (!allowed) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429 }
  );
}
```

A chave inclui o `userId` para que o limite seja por usuario, nao global. Um usuario que tenta 6 vezes e bloqueado; outros usuarios nao sao afetados.

### 4.5 Conexao com Redis: singleton com lazy connect

O cliente Redis e um singleton com `lazyConnect: true`:

```typescript
// src/lib/rate-limit.ts (linhas 27-30)
redis = new Redis(url, {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  lazyConnect: true,
});
```

`lazyConnect` significa que a conexao TCP so e estabelecida na primeira operacao, nao na importacao do modulo. Isso reduz o overhead de cold start das funcoes serverless.

---

## 5. Cron jobs

### 5.1 Configuracao em `vercel.json`

A Vercel executa crons definidos em `vercel.json` na raiz do projeto:

```json
{
  "crons": [
    { "path": "/api/cron/wallet-expire",    "schedule": "0 6 * * *"  },
    { "path": "/api/cron/order-timeout",    "schedule": "0 * * * *"  },
    { "path": "/api/cron/booking-reminder", "schedule": "0 12 * * *" },
    { "path": "/api/cron/wellness-reminder","schedule": "0 * * * *"  }
  ]
}
```

Todos os horarios sao **UTC**. Para referencia:
- `0 6 * * *` = 06h UTC = 03h Brasilia (horario de verao) ou 03h (horario padrao)
- `0 12 * * *` = 12h UTC = 09h Brasilia

### 5.2 Seguranca: CRON_SECRET

A Vercel envia automaticamente o header `Authorization: Bearer <CRON_SECRET>` ao invocar crons definidos em `vercel.json`. Cada rota valida esse header antes de executar qualquer logica:

```typescript
// src/app/api/cron/wallet-expire/route.ts (linhas 9-12)
function authorize(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}
```

Sem esse check, qualquer pessoa que descobrisse a URL do cron poderia invoca-lo manualmente — expirando creditos de wallet ou cancelando pedidos fora de hora.

> **Armadilha: CRON_SECRET nao configurada = cron acessivel publicamente**
>
> Se `CRON_SECRET` estiver vazia, a comparacao `"" === "Bearer undefined"` retorna false — o cron retorna 401. Mas se por erro o check for removido ou alterado para `!CRON_SECRET || ...`, a rota fica publica. Manter sempre o padrao de validacao mostrado acima.

### 5.3 Os quatro crons do projeto

**`/api/cron/wallet-expire` — diario as 06h UTC**

Responsabilidades:
1. Chama RPC `expire_wallet_credits` no Supabase para marcar creditos vencidos como usados.
2. Consulta creditos com expiracao nos proximos 7-8 dias e envia push notification de aviso.

```typescript
// src/app/api/cron/wallet-expire/route.ts (linhas 29-57)
const expired = await expireWalletCredits();

const { data: expiringSoon } = await supabase
  .from("wallet_credits")
  .select("user_id, amount_cents, expires_at")
  .is("used_at", null)
  .gt("expires_at", sevenDaysFromNow)
  .lt("expires_at", eightDaysFromNow);
```

**`/api/cron/order-timeout` — a cada hora**

Cancela orders e bookings com status `pending` ha mais de 24 horas. Para cada cancelamento:
- Restaura estoque via RPC `increment_stock_batch` (atomico).
- Reverte cashback consumido criando um credit positivo com validade de 30 dias (evitar ressuscitar saldo expirado com validade longa).

```typescript
// src/app/api/cron/order-timeout/route.ts (linha 13)
const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 horas
```

**`/api/cron/booking-reminder` — diario as 12h UTC (09h Brasilia)**

Busca bookings de estetica com status `pending` ou `confirmed` agendados para o dia seguinte (janela de 24h a 48h a partir do momento de execucao) e envia push notification de lembrete para cada usuario.

**`/api/cron/wellness-reminder` — a cada hora**

O mais complexo dos quatro. Para cada usuario com preferencias ativas em `wellness_reminders`:
- **Hidratacao** (planos pagos): se algum slot `HH:MM` do usuario cai na janela de 1 hora da execucao atual, envia push. Cooldown de 50 minutos para evitar duplicatas em reentregas.
- **Video motivacional** (todos os planos): seleciona um video da tabela `motivational_videos` de forma deterministica pelo dia do ano (`dayOfYear % videos.length`) — todos os usuarios veem o mesmo video no mesmo dia. Cooldown de 20 horas.

```typescript
// src/app/api/cron/wellness-reminder/route.ts (linhas 65-72)
function pickVideoForDay(videos: MotivationalVideo[]): MotivationalVideo | null {
  if (videos.length === 0) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return videos[dayOfYear % videos.length];
}
```

> **Armadilha: crons usam UTC, usuarios pensam em Brasilia**
>
> O `booking-reminder` usa `0 12 * * *` (12h UTC = 09h Brasilia) e calcula o "amanhã" em UTC. Se o cron rodar as 12h UTC de uma quinta-feira, "amanhã" e sexta-feira UTC. Para usuarios em Brasilia (UTC-3), isso e tecnicamente correto — mas cuidado ao interpretar os logs: o campo `scheduled_at` dos bookings deve estar em UTC no banco para que a janela de comparacao funcione.

---

## 6. CSP & cabecalhos de seguranca

### 6.1 Headers configurados em `next.config.ts`

O KathApp define todos os cabecalhos de seguranca em `next.config.ts`, aplicados a todas as rotas via `source: "/(.*)"`:

```typescript
// next.config.ts (linhas 23-31)
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",  value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options",         value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
];
```

O que cada header faz:
- **HSTS** (`Strict-Transport-Security`): forca HTTPS por 2 anos, incluindo subdomains. O flag `preload` permite submissao para a lista de preload dos browsers.
- **X-Frame-Options SAMEORIGIN**: impede o app de ser embutido em `<iframe>` de outros dominios (protege contra clickjacking).
- **X-Content-Type-Options nosniff**: impede browsers de "cheirar" o tipo MIME — um arquivo `.txt` nao sera executado como JavaScript.
- **Permissions-Policy**: desativa camera, microfone e geolocalizacao. O app nao precisa de nenhum desses recursos.

### 6.2 CSP em Report-Only: o que significa e por que importa

A diretiva atual e `Content-Security-Policy-Report-Only`, nao `Content-Security-Policy`. A diferenca e fundamental:

| Header | Comportamento |
|---|---|
| `Content-Security-Policy` | **Bloqueia** recursos que violam a policy |
| `Content-Security-Policy-Report-Only` | **Apenas reporta** violacoes (no console e/ou via `report-uri`), sem bloquear nada |

Isso significa que **erros CSP que aparecem no console do browser sao atualmente ruido** — eles indicam que a policy BLOQUEARIA aquele recurso se fosse enforce, mas nao estao bloqueando nada agora.

O comentario no codigo e claro:
```typescript
// next.config.ts (linhas 4-6)
// CSP directives — começa em Report-Only para coletar violations.
// Após validar logs do Sentry/console por alguns dias, mudar para
// "Content-Security-Policy" para enforce.
```

### 6.3 Diretivas CSP atuais

```typescript
// next.config.ts (linhas 7-21)
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.vercel-scripts.com https://www.youtube.com https://*.asaas.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://*.asaas.com https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://www.youtube.com https://*.asaas.com",
  "media-src 'self' https: data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");
```

### 6.4 Ajustes necessarios antes de promover para enforce

Ao trocar de `Content-Security-Policy-Report-Only` para `Content-Security-Policy`, dois ajustes sao tipicamente necessarios em projetos que usam Clerk e service workers:

**1. `worker-src` para o service worker**

O `public/sw.js` e um service worker que roda em contexto isolado. Sem `worker-src`, muitos browsers bloqueiam o registro. Adicionar:

```
worker-src 'self' blob:;
```

O `blob:` e necessario quando o SW e registrado via `URL.createObjectURL` (padrao em alguns frameworks). No KathApp o registro e direto (`/sw.js`), mas incluir `blob:` e uma precaucao valida.

**2. `script-src-elem` para scripts do Clerk**

A diretiva `script-src` cobre `<script>` tags e `eval`. Para scripts carregados via `<script src="...">`, alguns browsers exigem `script-src-elem` separado quando `script-src` usa `'strict-dynamic'`. No KathApp o Clerk e listado explicitamente, entao isso nao e critico — mas ao investigar violacoes CSP no console, prestar atencao em qual diretiva falhou (`script-src` vs `script-src-elem`).

> **Armadilha: promover CSP para enforce sem validar o Clerk**
>
> O Clerk carrega scripts dinamicamente de `https://*.clerk.accounts.dev` e usa workers internos. Se `worker-src` nao incluir `'self'`, o Clerk pode falhar silenciosamente no login — a pagina carrega, mas o modal de auth nao funciona. Testar o fluxo completo de login antes de promover.

**Como promover:**

```typescript
// next.config.ts — trocar a linha:
{ key: "Content-Security-Policy-Report-Only", value: cspDirectives },
// por:
{ key: "Content-Security-Policy", value: cspDirectives },
```

### 6.5 `next/image` e allowlist de dominios

O `next.config.ts` define `remotePatterns` explicitamente — sem wildcard `https://**`:

```typescript
// next.config.ts (linhas 40-52) — comentario original do codigo:
// SEM wildcard "https://**" — proxy aberto via /_next/image é vetor SSRF.
remotePatterns: [
  { protocol: "https", hostname: "**.supabase.co" },
  { protocol: "https", hostname: "img.clerk.com" },
  // ... outros dominios especificos
],
```

Um wildcard aberto permitiria que qualquer URL fosse passada para `/_next/image?url=`, fazendo o servidor do Next.js buscar qualquer recurso na internet — um vetor classico de Server-Side Request Forgery (SSRF).

---

## 7. Web Push / VAPID

### 7.1 Arquitetura geral

Web Push funciona com tres participantes:

```
App Server (KathApp)  -->  Push Service (Google/Apple/Mozilla)  -->  Browser/SW
```

1. O browser gera um par de chaves de criptografia e se registra no Push Service, recebendo um `endpoint` unico.
2. O endpoint + chaves publicas (`p256dh` e `auth`) sao salvos no banco (`push_subscriptions`).
3. Quando o servidor quer notificar um usuario, encripta o payload com as chaves do usuario e POST para o endpoint do Push Service.
4. O Push Service entrega para o browser, que acorda o service worker.
5. O service worker exibe a notificacao.

O protocolo de autenticacao entre o servidor e o Push Service e o **VAPID** (Voluntary Application Server Identification): o servidor assina cada requisicao com sua chave privada VAPID, e o Push Service verifica com a chave publica correspondente.

### 7.2 Chaves VAPID: geracao e configuracao

```bash
# Gerar par de chaves VAPID (uma vez, salvar em seguro)
npx web-push generate-vapid-keys

# Saida:
# Public Key: BFuQ...
# Private Key: m4v...
```

Configurar nas variaveis de ambiente:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BFuQ...   # publica — vai para o bundle do cliente
VAPID_PRIVATE_KEY=m4v...               # privada — apenas no servidor
VAPID_EMAIL=mailto:contato@kathapp.com # contato para o Push Service
```

### 7.3 Implementacao servidor: `src/lib/push/webpush.ts`

O modulo tem tres funcoes publicas:

**`sendPushNotification`** — envia para um subscription especifico:

```typescript
// src/lib/push/webpush.ts (linhas 27-44)
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<boolean> {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:contato@kathapp.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
  await webPush.sendNotification(subscription, JSON.stringify(payload));
  return true;
}
```

**`sendPushToUser`** — envia para todos os dispositivos de um usuario:

```typescript
// src/lib/push/webpush.ts (linhas 49-67)
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createAdminSupabaseClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId);

  await Promise.allSettled(
    subs.map((s) => sendPushNotification(s.subscription, payload))
  );
}
```

**`sendPushBroadcast`** — envia para todos os subscriptions em batches de 50:

```typescript
// src/lib/push/webpush.ts (linhas 72-94)
const batchSize = 50;
for (let i = 0; i < subs.length; i += batchSize) {
  const batch = subs.slice(i, i + batchSize);
  await Promise.allSettled(batch.map((s) => sendPushNotification(s.subscription, payload)));
}
```

### 7.4 Service worker: `public/sw.js`

O service worker e o unico arquivo que pode receber eventos `push` do browser:

```javascript
// public/sw.js (linhas 6-22)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const { title, body, icon, url, tag } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: tag || "kathapp",
      data: { url: url || "/dashboard" },
      vibrate: [200, 100, 200],
    })
  );
});
```

O `tag` evita que multiplas notificacoes do mesmo tipo se acumulem — uma nova notificacao com o mesmo `tag` substitui a anterior.

O handler de click navega o usuario para a URL embarcada no payload:

```javascript
// public/sw.js (linhas 25-38)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

### 7.5 Poda de subscriptions mortas: 410 e 404

Subscriptions se tornam invalidas quando:
- O usuario revoga a permissao de notificacoes no browser.
- O browser deleta o registro do service worker.
- O Push Service expira o endpoint por inatividade.

Quando o servidor tenta enviar para um endpoint morto, o Push Service retorna **HTTP 410 Gone** (permanentemente removido) ou **HTTP 404 Not Found**. Manter essas subscriptions no banco desperdiça recursos e pode fazer o broadcast ser bloqueado por throttling do Push Service.

A implementacao atual em `sendPushNotification` captura o erro mas nao faz poda automatica:

```typescript
// src/lib/push/webpush.ts (linhas 39-43)
} catch (err) {
  console.error("[push] Failed to send:", err);
  return false;
}
```

**Como implementar poda automatica:**

```typescript
// Versao com poda — substituir o catch atual
} catch (err: unknown) {
  const statusCode = (err as { statusCode?: number }).statusCode;
  if (statusCode === 410 || statusCode === 404) {
    // Subscription morta — remover do banco
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    console.warn("[push] Removed dead subscription:", subscription.endpoint);
  } else {
    console.error("[push] Failed to send:", err);
  }
  return false;
}
```

> **Armadilha: nao podar subscriptions mortas degrada o broadcast com o tempo**
>
> Em um app com crescimento organico, subscriptions mortas acumulam. Um broadcast para 10.000 subscriptions pode ter 40% delas mortas apos 6 meses. Alem do desperdicio de tempo de execucao da funcao serverless, alguns Push Services aplicam rate limiting por volume de erros — muitos 410 seguidos podem fazer o servidor ser temporariamente bloqueado pelo Push Service do Google ou Apple.

---

## 8. Exercicios

### Exercicio 1 — Variavel de ambiente e redeploy

Sua tarefa e adicionar suporte a um novo servico de analytics. A variavel `ANALYTICS_API_KEY` foi adicionada ao painel da Vercel em Production.

a) Por que simplesmente adicionar a variavel no painel nao e suficiente para que a aplicacao em producao a enxergue imediatamente?

b) O que exatamente deve ser feito para que o valor chegue ao servidor?

c) Onde no codigo voce adicionaria a validacao dessa variavel para garantir que ela e obrigatoria em producao? Escreva o trecho de codigo seguindo o padrao de `src/lib/env.ts`.

---

### Exercicio 2 — Rate limiting e producao serverless

Considere o seguinte cenario: o `REDIS_URL` foi removido acidentalmente das variaveis de ambiente de producao apos uma migracao de infraestrutura.

a) A aplicacao vai explodir imediatamente? Por que?

b) Qual mensagem de log vai aparecer no painel da Vercel?

c) Se houver 8 instancias serverless ativas e o limite configurado e de 5 requisicoes por minuto por usuario, qual e o limite efetivo por usuario nesse estado degradado?

d) Como detectar esse estado sem esperar um relatorio de abuso?

---

### Exercicio 3 — Topologia de branches

Voce tem um hotfix critico na branch `main` (commit `abc1234`) que corrige um bug de seguranca no modulo de pagamento. O projeto usa `kathguedes-app1.0` como branch de producao, e as duas branches nao tem ancestral comum.

a) Por que `git merge main` na branch `kathguedes-app1.0` nao e uma opcao segura?

b) Escreva o comando exato para trazer apenas o commit `abc1234` para `kathguedes-app1.0`.

c) Se o hotfix envolve dois arquivos (`src/lib/asaas/checkout.ts` e `src/lib/asaas/webhook.ts`) e nao um commit limpo, como trazer apenas esses dois arquivos?

---

### Exercicio 4 — CSP e promocao para enforce

O time decidiu que e hora de promover a CSP de `Report-Only` para `enforce`.

a) Qual e a mudanca exata em `next.config.ts`?

b) O Clerk exibe um modal de autenticacao que usa um iframe de `https://challenges.cloudflare.com`. Isso esta coberto pela CSP atual? Qual diretiva cobre?

c) Apos a promocao, usuarios comecam a reportar que o push notification do service worker parou de funcionar. Qual diretiva CSP provavelmente esta faltando e o que adicionar?

d) Qual header voce adicionaria ao `next.config.ts` para que o browser reporte violacoes CSP para o Sentry mesmo apos o enforce?

---

### Exercicio 5 — Poda de subscriptions mortas no broadcast

A funcao `sendPushBroadcast` atualmente usa `Promise.allSettled` — o que garante que uma falha em um subscription nao cancela os outros. Mas ela nao poda subscriptions mortas.

a) Modifique `sendPushBroadcast` para que, ao detectar um erro 410 ou 404 em `sendPushNotification`, o endpoint correspondente seja removido do banco. Voce precisara refatorar `sendPushNotification` para retornar informacao sobre o tipo de falha, ou lidar com a poda dentro do proprio `sendPushBroadcast`.

b) Por que usar `createAdminSupabaseClient()` para fazer o `delete` da subscription morta, e nao `createServerSupabaseClient()`?

c) O broadcast roda em batches de 50. Se a remocao de subscriptions mortas adicionar latencia (uma query DELETE por subscription morta), como voce otimizaria para fazer um unico DELETE com multiplos endpoints ao final de cada batch?

---

*Fim do Modulo 5.*
