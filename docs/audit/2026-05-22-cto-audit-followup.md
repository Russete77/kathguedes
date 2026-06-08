# KathApp — Auditoria CTO · Follow-up de Sessão (2026-05-22, fim do dia)

> Sucede `2026-05-22-cto-audit.md` (snapshot das 09:42). Este documento registra a **remediação executada nesta sessão de trabalho**, o estado **real e verificado** dos P0, os **novos bloqueadores de infra/configuração** descobertos ao testar em produção, e o **plano de ação para a próxima sessão**. Branch: `kathguedes-app1.0` (= branch de produção; ver §6). Todos os fixes de código já foram empurrados e deployados.

---

## 0. TL;DR — onde paramos

A app está **deployada e no ar** (`kathguedes.com.br`), mas **ainda não funcional para o usuário final** por **dois bloqueadores de configuração externa** (não são bugs de código):

1. **Clerk↔Supabase RLS**: falta o claim `role: "authenticated"` no token de sessão do Clerk de **produção**. Sem ele, toda leitura RLS volta vazia → treinos/estética/loja/chat/perfil aparecem em branco para usuários logados.
2. **Asaas — allowlist de IP**: a chave da API recusa requisições de IP não autorizado (`not_allowed_ip`). Como a Vercel usa IPs dinâmicos, **toda cobrança falha** até a allowlist ser desativada.

O código de pagamento e de RLS está **correto e aderente à doc oficial**. Os dois itens acima são ajustes de **dashboard** (Clerk + Asaas), pendentes de acesso do dono da conta.

---

## 1. Ações pendentes para a PRÓXIMA sessão (checklist)

| # | Ação | Onde | Status |
|---|------|------|--------|
| A1 | Adicionar claim `{"role":"authenticated"}` no token de sessão do **Clerk de produção** (Configure → Sessions → Customize session token), mantendo o `metadata` existente | Dashboard Clerk (instância prod `clerk.kathguedes.com.br`) | ⏳ pendente |
| A2 | **Desativar a liberação/allowlist de IP** da chave Asaas (sandbox e, futuramente, produção) | Dashboard Asaas | ⏳ pendente |
| A3 | Aplicar `supabase/migrations/28_drop_redundant_c1_trigger.sql` no banco de prod (re-afirma o guard da #25 e remove o trigger C1 redundante) | Painel Supabase SQL | ⏳ pendente |
| A4 | Validar end-to-end após A1+A2: onboarding → dashboard, /fitness com vídeos, checkout PIX gerando cobrança | App em prod | ⏳ pendente |
| A5 | (Quando for cobrar de verdade) trocar para chave Asaas **de produção** + `ASAAS_ENV=production` na Vercel (redeploy) + desativar allowlist na chave prod | Vercel + Asaas | futuro |

> Para validar A1: abrir `/admin/treinos/diagnostico` → Seção 4 deve virar "7 de 7" e veredito "Tudo correto".
> Para validar A2: pedir ao Claude para re-rodar o teste de curl da chave (deve virar `200`).

---

## 2. Remediação executada nesta sessão (commits)

Branch `kathguedes-app1.0`, commits desta sessão (mais recente primeiro):

- `12d3a88` — **pagamento F1+F2+F3**: CPF no PIX avulso (loja/estética), rate limit nessas rotas, `createPayment()` unificado no client.
- `8c8cb81` — **checkout**: expõe a causa real do erro do Asaas (`AsaasApiError` tipado) em vez de 500 opaco.
- `81a7356` — **onboarding**: cai no `/dashboard` ao concluir, sem exigir re-login (refresh de token + navegação hard + check de `res.ok`).
- `f39cb8e` — chore: remove swap file commitado por engano + ignora `*.swp`.
- `2248608` — **reconcilia C1** com a `migrations/25` + move double-booking para `migrations/27` (convenção numerada correta) + `migrations/28` de cleanup.
- `1557dc6` — **Sprint 0**: C3 (cashback só após pagamento, loja+estética, idempotente), C4 (RLS no treino premium), cashback estética sinal+restante, double-booking (EXCLUDE constraint) + tratamento 23P01, e WIP admin (calendário/kanban/delete + /admin/users).

Todos validados com `npm run lint && npm run build && npm run test` (113 testes verdes).

---

## 3. Estado VERIFICADO dos P0 (vs auditoria das 09:42)

| P0 | 09:42 | Agora | Evidência |
|----|-------|-------|-----------|
| **C1** self-upgrade de plano | aberto | ✅ **fechado** | Já resolvido em `migrations/25_profiles_guard_sensitive_columns.sql` (trigger `guard_profile_sensitive_columns`, mais completo — também protege `asaas_customer_id/subscription_id`). Migration redundante minha consolidada na `28`. **Aplicar #28** (A3). |
| **C2** chat/consultoria/perfil mortos por slug `vip` | aberto | ✅ **fechado** (antes da sessão) | `src/lib/billing/access.ts` (`hasPlanAccess`). |
| **C3** cashback gasto em pedido não pago | aberto | ✅ **fechado** | Débito movido para `handleLojaPayment`/`handleEsteticaPayment` (confirmação do pagamento), idempotente via `revenue_stream`/booking. Exceção `total=0` debita na criação. `1557dc6`. |
| **C4** treino premium por URL | aberto | ✅ **fechado** | `fitness/[id]` usa RLS client; policy `workouts_select_by_plan` gateia. `1557dc6`. |
| **C5** schema.sql/types dessinc | aberto | 🟡 **aberto** (dívida) | `supabase/schema.sql` e `database.types.ts` não refletem `migrations/19–28`. Não trava runtime, mas mantém `as never` no domínio estética e quebra onboarding de dev/restore. |

**Money bugs (Sprint 0):**
- Double-credit em re-save: ✅ já mitigado por idempotência de `creditWalletCents` (commit R-A `26`) — credita uma vez por `source_revenue_stream_id`.
- Cashback estética sinal+restante: ✅ corrigido (`.maybeSingle()` que estourava com 2 streams → `order+limit(1)`). `1557dc6`.
- Double-booking: ✅ `migrations/27_estetica_no_overlap.sql` (EXCLUDE gist `tstzrange`) **aplicada** + inserts user/admin tratam `23P01`.

---

## 4. NOVOS achados desta sessão (infra/config — não são bugs de código)

### N1 — Clerk↔Supabase RLS incompleto em produção (BLOQUEADOR)
- **Sintoma:** `/fitness` (e tudo RLS-gated) vazio para usuário logado; streak 0. Diagnóstico em `/admin/treinos/diagnostico`: 7 vídeos publicados (todos `free`), profile `free` nível 0, mas **"0 de 7" visíveis**.
- **Causa:** o Supabase de prod confia no issuer `clerk.kathguedes.com.br`, mas o token de sessão do Clerk **não carrega o claim `role: "authenticated"`** → PostgREST trata como `anon` → policies `to authenticated` não se aplicam → 0 linhas.
- **Correção:** A1. Documentado em `docs/deploy/clerk-supabase-rls.md`.
- **Código:** já correto (`src/lib/supabase/server.ts` usa `accessToken: () => getToken()`). Nada a mudar.

### N2 — Asaas com allowlist de IP (BLOQUEADOR de pagamento)
- **Sintoma:** `POST /api/checkout/subscribe` → 500.
- **Causa CRAVADA (curl com a chave):** `{"errors":[{"code":"not_allowed_ip","description":"IP não autorizado..."}]}`. A chave (sandbox — production deu 401) tem restrição de IP; os IPs dinâmicos da Vercel não estão liberados → 403 em toda cobrança.
- **Correção:** A2 (desativar allowlist — a chave já é server-only/secret, não depende de IP).

### N3 — `main` e `kathguedes-app1.0` são históricos git NÃO relacionados
- `merge-base` vazio; conteúdos só ~equivalentes (31 arquivos de diferença, quase tudo trabalho novo da app1.0). **Não fazer `git merge` entre elas.** Produção deploya da `kathguedes-app1.0` (ver §6).

### N4 — Convenção de migrations
- Canônicas em `supabase/migrations/NN_*.sql` (sequência 19→28). Os `supabase/migration_*.sql` achatados são legados. `schema.sql` está dessincronizado (= C5). **Não confiar no schema.sql para o estado atual do DB.**

### N5 — Segurança: PAT do GitHub em texto puro no remote `origin`
- A URL do remote contém um GitHub PAT. Trocar por SSH/credential helper.

---

## 5. Revisão do sistema de pagamento vs doc oficial Asaas (docs.asaas.com)

**Aderente à doc (✅):** header `access_token`; base URLs sandbox/prod; `POST /subscriptions` (customer/billingType/value/nextDueDate/cycle/description/externalReference); PIX QR (`GET /payments/{id}/pixQrCode`); webhook com header `asaas-access-token` + `timingSafeEqual`; eventos CONFIRMED/RECEIVED/OVERDUE/DELETED/REFUNDED/PARTIALLY_REFUNDED com guard que só deixa eventos positivos chegarem aos handlers; idempotência colapsando CONFIRMED+RECEIVED em `:paid`; 5xx p/ reentrega; retry/backoff só em 5xx/rede.

**Corrigidos nesta sessão:**
- **F1** — loja/estética criavam customer **sem CPF/CNPJ** (Asaas exige p/ PIX) → agora enviam `profile.cpf` e retornam `422 cpf_required` acionável se faltar.
- **F2** — faltava rate limit em `loja/payment` e `estetica/bookings/[id]/payment` → adicionado (5/min/user).
- **F3** — `POST /payments` duplicado inline → centralizado em `createPayment()` no client (herda retry/backoff + `AsaasApiError`).

**Aberto (decisão de produto):**
- **F4** — `/api/checkout/cancel` faz downgrade **imediato** para `free` (sem manter acesso até `subscription_ends_at`) e devolve 500 genérico. Decidir comportamento de carência + alinhar erro ao padrão `AsaasApiError`.

**UX a evoluir:** loja/estética não coletam CPF no checkout (dependem de já existir no profile). Considerar coletar CPF inline nesses fluxos (como o subscribe faz).

---

## 6. Infra & deploy (fatos confirmados nesta sessão)

- **Deploy de produção = push para `kathguedes-app1.0`** (Vercel). `main` não é alvo de prod (histórico não relacionado — N3).
- **Supabase prod**: ref `auplhaxwaecsppqizxej`. Third-Party Auth já tem Clerk `clerk.kathguedes.com.br` habilitado (falta o claim — N1).
- **MCP Supabase** conectado **não** alcança o projeto KathApp (só `simulai`/`mitra`) → migrations aplicadas **manualmente** no painel.
- **Asaas**: `ASAAS_ENV=sandbox` + chave sandbox (consistente). Para cobrar de verdade: migrar para produção (A5).
- **Env flags**: `DISABLE_AUTH`/`NEXT_PUBLIC_DISABLE_AUTH` setados no `.env.local` mas **não wired no código** (no-op) — auth sempre ativa.

---

## 7. Ainda aberto (Sprint 1+ — herdado das auditorias anteriores)

| Sev | Item | Nota |
|-----|------|------|
| P0/dívida | **C5** regenerar `schema.sql` + `database.types.ts` das migrations 19–28 | fecha os `as never` da estética |
| P1 | **Sentry** não instalado (`env.ts` exige `SENTRY_DSN` em prod; pacote ausente → no-op) | observabilidade |
| P1 | **`notifyAdmins` no-op** — `team_members` sem `clerk_user_id` | alertas de booking/pagamento/chat silenciosos |
| P1 | **Limite de afiliado FREE (3/mês)** inoperante — `monthly_usage` nunca lido/escrito | |
| P1 | **Admin chat** quebrado por RLS (browser client; sem policy de admin em `messages`) | |
| P2 | 9 rotas de user usando admin client (anti-pattern; sem IDOR vivo) | migrar leituras p/ RLS client |
| P2 | **CSP em Report-Only** — promover a enforce após ajustar `worker-src 'self' blob:` (Clerk) e `script-src-elem` | os erros CSP do console são report-only (não bloqueiam) |
| P2 | `audit_log` (handbook §7.5) não implementado | |
| P3 | Seeds Rickroll, OCR stub, Lalamove/99 stubs, templates duplicados, tokens de cor fora do design system em `user-tier-table.tsx`/`bookings-calendar.tsx` | limpeza |

---

## 8. Roadmap sugerido (atualizado)

- **Próxima sessão (desbloqueio):** A1 (claim Clerk) + A2 (IP Asaas) + A3 (#28) → validar app inteiro funcionando (A4). Sem isso, nada autenticado funciona para o usuário.
- **Sprint 1:** C5 (regenerar schema/types) · Sentry · `notifyAdmins` operacional · admin chat via Server Action/policy · F4 (carência de cancel) · coletar CPF no checkout loja/estética.
- **Sprint 2:** migrar 9 rotas para RLS client · CSP enforce · limite afiliado FREE · testes de integração (Supabase real) para subscribe/webhook/checkout · audit_log.
- **Sprint 3:** fila p/ broadcast de push/notif · analytics · email transacional · OCR de placa real · A5 (Asaas produção).

---

## 9. Mudanças neste documento

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-22 (fim do dia) | Claude (Opus 4.7) | Follow-up da sessão: remediação Sprint 0 (C1 reconciliado, C3, C4, cashback estética, double-booking), fix de onboarding, surfacing de erro Asaas, pagamento F1/F2/F3. Novos bloqueadores de infra: Clerk role claim (N1) e Asaas IP allowlist (N2). Fatos de deploy (N3–N5). Plano de ação A1–A5. |
