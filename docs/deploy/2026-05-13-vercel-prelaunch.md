# Deploy Checklist — KathApp Vercel (Pré-Launch)

**Data:** 2026-05-13 · **Deployer:** Erick Russo · **Domínio alvo:** kathguedes.com.br
**Repo:** github.com/Russete77/kathguedes · **Projeto Vercel:** kathapp (`prj_yupyenmKGxLuBVc4OEZ1k6tnIHR7`)

---

## Veredicto: 🟡 NÃO suba ainda — 3 bloqueadores P0

Tem trabalho de código que **existe local mas não está no GitHub**. Se você importar na Vercel agora, ela vai buildar um snapshot velho que não tem `webhook/clerk`, `cron/booking-reminder` (referenciado no `vercel.json`!) e duas migrations de banco. Resolvendo isso, sobe limpo.

---

## P0 — Bloqueadores (resolver ANTES do deploy)

### 1. Working tree com 100+ arquivos não commitados
`main` está em sincronia com `origin/main` (0 ahead / 0 behind), mas há **101 arquivos modificados** + **6 caminhos novos não rastreados** localmente. Entre os untracked está o **`src/app/api/cron/booking-reminder/route.ts`** — e esse cron já está declarado no `vercel.json`. Se subir agora, **o cron das 12h vai dar 404 todo dia em produção**.

**Ação:**
```bash
cd C:\Users\erick\KATH-GUEDES\kathapp
git status                        # confere
git add -A
git commit -m "feat: P0 pré-deploy (clerk webhook, booking-reminder cron, loyalty/cpf migrations)"
git push origin main
```

### 2. Migrations de Supabase não aplicadas em produção
Existem dois SQLs novos local (não rodados):
- `supabase/migration_loyalty_3_to_4.sql`
- `supabase/migration_profile_cpf.sql`

E os já existentes `migration_modelo_financeiro.sql` e `migration_security_hardening.sql` aparecem como `M` (modificados desde o último commit).

**Ação:** rodar **na ordem** no Supabase de produção via SQL Editor (ou `supabase db push` se tiver CLI conectada ao projeto de prod):
1. `migration_modelo_financeiro.sql`
2. `migration_security_hardening.sql`
3. `migration_profile_cpf.sql`
4. `migration_loyalty_3_to_4.sql`

Tira backup do schema antes (`pg_dump --schema-only`). RLS está OK: 31 tabelas no schema, 31 com `enable row level security`.

### 3. Webhook do Clerk sem `CLERK_WEBHOOK_SECRET` cadastrado
`src/app/api/webhook/clerk/route.ts` valida a assinatura Svix usando `process.env.CLERK_WEBHOOK_SECRET`, mas essa variável **não está no `.env.local` nem no `.env.example`**. Sem ela, em produção o handler vai cair no fallback que **só aceita em dev** — ou seja, todo webhook vai voltar 401 e o sync de signup Clerk → profile não acontece.

**Ação:** Clerk Dashboard → Webhooks → criar endpoint `https://kathguedes.com.br/api/webhook/clerk` (eventos: `user.created`, `user.deleted`) → copiar o **Signing Secret** → cadastrar como `CLERK_WEBHOOK_SECRET` na Vercel (Production).

---

## P1 — Configurar variáveis na Vercel antes do primeiro deploy

Cadastre tudo abaixo em **Project → Settings → Environment Variables → Production**. As marcadas com 🆕 estão sendo usadas no código mas faltam no `.env.example` — atualize o arquivo também antes de commitar.

### Obrigatórias
| Var | Origem | Observação |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | usar **chave `pk_live_…`** (produção, não test) |
| `CLERK_SECRET_KEY` | Clerk Dashboard | `sk_live_…` |
| `CLERK_WEBHOOK_SECRET` 🆕 | Svix endpoint do Clerk | **bloqueador P0 #3** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | fixo | `/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | fixo | `/registro` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | fixo | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | fixo | `/dashboard` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings | usar projeto de **produção**, não dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | anon do projeto de prod |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **só** server-side; jamais expor |
| `ASAAS_ENV` | fixo | `production` (você está com `sandbox` no `.env.local`) |
| `ASAAS_API_KEY` | Asaas | chave de **produção** |
| `ASAAS_WEBHOOK_TOKEN` | Asaas Webhooks | header `asaas-access-token` que o painel manda |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | mesmo do local | push notifications |
| `VAPID_PRIVATE_KEY` | mesmo do local | |
| `VAPID_EMAIL` | `mailto:contato@kathguedes.com.br` | |
| `MELHOR_ENVIO_TOKEN` | Melhor Envio | trocar `MELHOR_ENVIO_ENV` pra `production` |
| `MELHOR_ENVIO_ENV` | fixo | `production` |
| `SHIPPING_ORIGIN_ZIP` / `CITY` / `STATE` / `ADDRESS` | já no local | |
| `REDIS_URL` | Railway/Upstash | obrigatório (rate-limit) |
| `CRON_SECRET` | gerar novo: `openssl rand -hex 32` | **não reaproveite o de dev** |

### Opcionais (mas tem código que usa)
| Var | Por que | 
|---|---|
| `LALAMOVE_API_KEY` / `LALAMOVE_API_SECRET` / `LALAMOVE_ENV` 🆕 | Entregas locais via Lalamove |
| `ENTREGA99_API_KEY` 🆕 | Entregas locais via 99 |
| `SHIPPING_CONTACT_PHONE` 🆕 | Etiquetas/contato shipping |
| `PIX_KEY` / `PIX_NAME` | Fallback Pix se Asaas indisponível |
| `SENTRY_DSN` 🆕 | Habilita Sentry (CSP já libera `*.sentry.io`) |

### Já preenchidas pela Vercel (não cadastre)
`VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV`.

---

## P2 — Configurações Vercel & Domínio

### Build settings
- **Framework Preset:** Next.js (auto)
- **Build Command:** `next build` (default)
- **Install Command:** `npm install` (default)
- **Node Version:** 20.x (compatível com `@types/node ^20`)
- **Root Directory:** `kathapp` ⚠️ (o repo tem o `KATH/` ao lado; aponte certo)

### Crons (já no `vercel.json`)
Vão ser provisionados automaticamente — confira em **Project → Crons** depois do deploy:
- `/api/cron/wallet-expire` · `0 6 * * *` (06h diário)
- `/api/cron/order-timeout` · `0 * * * *` (hora cheia)
- `/api/cron/booking-reminder` · `0 12 * * *` (12h diário)

Todos validam `Authorization: Bearer ${CRON_SECRET}` — confirmado nas três rotas. A Vercel manda esse header sozinha quando você cadastra o cron e o `CRON_SECRET`.

### Domínio kathguedes.com.br
1. Project → **Settings → Domains** → adicionar `kathguedes.com.br` e `www.kathguedes.com.br`
2. No Registro.br: criar `A` para `@` → `76.76.21.21` e `CNAME` para `www` → `cname.vercel-dns.com`
3. Forçar redirect `www → apex` (ou inverso — escolha **um** canonical)
4. SSL é automático (Let's Encrypt via Vercel) — aguarde 5-15 min

### Asaas / Clerk: atualizar callback URLs
- **Clerk Dashboard → Domains:** adicionar `https://kathguedes.com.br`
- **Clerk Webhooks:** endpoint pra `https://kathguedes.com.br/api/webhook/clerk`
- **Asaas Webhooks:** endpoint pra `https://kathguedes.com.br/api/webhook/asaas` com mesmo `ASAAS_WEBHOOK_TOKEN`

---

## P3 — Higiene de código (não bloqueia, mas vale resolver)

- **Console.logs em rotas API** (10+ ocorrências): produção vai logar no Vercel mas só importa se virar custo. Em `/api/admin/loja/shipping/label`, `/api/checkout/cancel`, `/api/cron/*` etc.
- **CSP em modo Report-Only:** `next.config.ts` está com `Content-Security-Policy-Report-Only`. **Mantenha assim no primeiro deploy** — após 2-3 dias colhendo violations, troca pra `Content-Security-Policy` (enforce).
- **`.env.example` desatualizado:** falta `CLERK_WEBHOOK_SECRET`, `LALAMOVE_ENV`, `ENTREGA99_API_KEY`, `SHIPPING_CONTACT_PHONE`, `SENTRY_DSN`. Atualizar antes de commitar o P0 #1.
- **Build/test não foram validados local na sessão** (sandbox tem binding nativo de outro SO). **Rode na sua máquina antes do push:**
  ```bash
  npm run lint   # ✅ já passou aqui, vazio
  npm test
  npm run build  # crucial
  ```

---

## Roteiro de deploy (na ordem)

```text
1. [LOCAL]
   - Resolver P0 #1, #2, #3
   - Atualizar .env.example (P3)
   - npm run lint && npm test && npm run build
   - git add -A && git commit -m "..." && git push origin main

2. [SUPABASE PROD]
   - pg_dump --schema-only > backup_pre_deploy.sql
   - Rodar 4 migrations em ordem (P0 #2)
   - Conferir: select count(*) from pg_policies; (deve ser 130+)

3. [VERCEL]
   - Project Settings → Environment Variables → cadastrar tudo de P1
   - Confirme Root Directory = kathapp
   - Trigger redeploy (Git push já dispara)
   - Acompanhar build log até "Compiled successfully"

4. [SMOKE TEST em <projeto>.vercel.app]
   - / (home pública carrega)
   - /login → fluxo Clerk completo
   - /registro → cria conta → /onboarding aparece
   - /dashboard (autenticado)
   - /loja → adicionar produto → checkout → simular pagamento Asaas sandbox
   - Painel Vercel → Crons → testar manualmente "Run now" em cada um
   - Confirmar que Clerk webhook recebeu `user.created` (Clerk dashboard → Logs)

5. [DOMÍNIO]
   - Vercel → Domains → adicionar kathguedes.com.br
   - Registro.br: A + CNAME
   - Aguardar SSL
   - Atualizar Clerk Domains + Asaas/Clerk webhook URLs pro domínio final

6. [PÓS-DEPLOY — primeira hora]
   - Vercel → Logs: rate de erros 5xx < 1%
   - Sentry (se ligar): 0 issues new
   - CSP Report-Only: coletar violations no console (Brave/Chrome devtools)
```

---

## Gatilhos de rollback

Vercel → Deployments → clicar no deploy anterior → **Promote to Production**. Pinda em <30s.

Faça rollback imediato se:
- Taxa de erro 5xx > **5%** sustentada por 5 min em qualquer rota crítica (`/api/checkout/*`, `/api/webhook/asaas`, `/dashboard`)
- Webhook Asaas retornando 401/500 em **>10 eventos seguidos** (perda silenciosa de pagamento)
- Clerk middleware loop infinito (sintoma: usuários redirecionados eternamente entre `/onboarding` e `/dashboard`)
- Cron travado >1h sem responder (vai aparecer como timeout no painel de Crons)

Se rollback for por causa de migration Supabase: rode o `backup_pre_deploy.sql` no SQL editor. Tenha o script de rollback pronto **antes** de aplicar.

---

## Quick reference — onde olhar pós-deploy

| O quê | Onde |
|---|---|
| Build/runtime errors | Vercel Dashboard → kathapp → Logs |
| Cron execuções | Vercel Dashboard → kathapp → Crons |
| Webhook Asaas inbound | Vercel Logs filtrando `[webhook] Already processed` ou `[webhook]` |
| Webhook Clerk inbound | Clerk Dashboard → Webhooks → Recent attempts |
| Métricas de uso | Vercel Dashboard → kathapp → Analytics |
| Erros runtime cliente | (instalar Sentry — `SENTRY_DSN`) |
| CSP violations | Brave/Chrome DevTools console enquanto CSP em Report-Only |

---

**Bottom line:** três coisas no P0 são suficientes pra liberar o deploy. Resolve, faz `npm run build` local pra confirmar verde, e a hora seguinte é só clicar.
