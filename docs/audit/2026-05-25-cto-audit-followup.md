# KathApp — Auditoria CTO · Follow-up de Sessão (2026-05-25)

> Sucede `2026-05-22-cto-audit-followup.md`. Esta sessão fechou o **grosso do Sprint 1** (Sentry instalado, F4 carência de cancel, Zod no anamnese, limite mensal de afiliado, CPF inline em loja/estética, admin chat via Server Actions) e adiou de forma justificada dois itens (regenerar types e migrar 9 rotas pra RLS client). Branch: `kathguedes-app1.0`.

---

## 0. TL;DR — onde paramos

A app está **deployada e no ar**, mas **ainda não funcional para o usuário final** até os bloqueadores externos (A1/A2) virarem. **Nesta sessão NÃO atacamos A1/A2/A3 (são dashboards externos — dependem do dono).** Atacamos o **Sprint 1** que era pura dívida de código.

- **A1** (Clerk: claim `role:"authenticated"`) — ainda **pendente** (dashboard Clerk de prod).
- **A2** (Asaas: desativar allowlist de IP) — ainda **pendente**. **Verificado por curl nesta sessão**: `POST /v3/customers?limit=1` → `403 not_allowed_ip` (código `03OWL4GJBS`). Confirma que a chave continua presa.
- **A3** (Aplicar `migrations/28_drop_redundant_c1_trigger.sql`) — ainda **pendente** no painel Supabase de prod.

**Novo**: precisa também aplicar `migrations/29_affiliate_monthly_usage_rpc.sql` (criada nesta sessão) — purely additive, não toca em comissões/sócios.

---

## 1. O que foi feito nesta sessão

### 1.1 Sentry instalado (P1, antes ausente)
- `@sentry/nextjs@8.55.2` instalado.
- `sentry.{client,server,edge}.config.ts` criados (gating por `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`; sem DSN = no-op).
- `instrumentation.ts` com `onRequestError` e load condicional dos configs por runtime.
- `next.config.ts` envolvido em `withSentryConfig` (silent, hidden source maps, tunnelRoute `/monitoring` para esquivar de adblockers).
- `src/app/admin/error.tsx` e novo `src/app/global-error.tsx` capturam erros com `Sentry.captureException`.
- `src/lib/api-error.ts` simplificado — antes carregava `@sentry/nextjs` por nome dinâmico pra esconder do bundler quando o pacote não estava instalado; agora import direto + `if (SENTRY_DSN) capture(...)`.
- `env.ts` ganhou `NEXT_PUBLIC_SENTRY_DSN`. `SENTRY_DSN` continua `requiredInProduction`.

**Pendente para ativar (env vars na Vercel):** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (último opcional — apenas pra upload de sourcemaps no build).

### 1.2 F4 — cancelamento com carência (`/api/checkout/cancel`)
Antes: downgrade imediato para `free` + 500 opaco em erro.
Agora:
- Mantém `plan_tier` + `subscription_ends_at` intactos (usuário usa até o fim do ciclo já pago).
- Limpa `asaas_subscription_id` e marca `subscription_status='canceled'`.
- Em erro do Asaas devolve `AsaasApiError.description` com 4xx tipado (em vez de 500 genérico), filtrado por allowlist de palavras pra não vazar detalhe sensível.
- Resposta: `{ ok, accessUntil, planTier }`.
- O downgrade efetivo cai depois quando o webhook `SUBSCRIPTION_DELETED`/`PAYMENT_DELETED` chega.

### 1.3 Zod no `POST /api/consultoria/anamnese`
Schema `submitAnamneseSchema` em `src/lib/validations.ts` com tudo do shape `Anamnesis` (peso/altura/freq/etc) — `.strict()` rejeita chaves estranhas, limites de tamanho em todos os campos texto. Rota agora usa `safeParse` + `handleApiError`.

### 1.4 Limite mensal de afiliado FREE (P1 morto)
- **Migration 29** (`supabase/migrations/29_affiliate_monthly_usage_rpc.sql`): `try_increment_affiliate_click(p_user_id, p_year_month, p_limit)` — atômico, lock pessimista `FOR UPDATE`, retorna `(allowed, new_count)`. Idempotente no upsert da linha do mês. Apenas aditiva — **não toca sócios/comissões**.
- `POST /api/affiliate/click` agora lê `plan_tier`, busca o plano via `getPlan()`, extrai `features.affiliate_clicks_per_month` (3 no FREE, "unlimited" nos demais), chama a RPC com limite numérico ou `NULL`. Se passou, retorna 429 com `code: monthly_limit_reached` e a contagem. Incremento de `affiliate_links.clicks_count` só roda se a gate passou.
- Tipo da RPC adicionado manualmente em `database.types.ts` (mais barato que regenerar agora).

### 1.5 CPF inline em loja/estética (UX do Sprint 1)
Backends já retornavam `422 cpf_required` (audit anterior). Faltava UI.
- `/api/loja/payment` e `/api/estetica/bookings/[id]/payment` agora aceitam `cpfCnpj` opcional no body. Se vier, usam ele; se profile não tinha CPF, salvam.
- `loja/pedido/payment-panel.tsx`: novo estado `need-cpf` com formulário inline (input mascarado, validação 11/14 dígitos). Em 422, troca pra esse formulário em vez de jogar erro genérico.
- `kath-estetica/meus-agendamentos/booking-actions.tsx`: mesmo padrão — antes do botão "Pagar via Pix", se vier 422 mostra formulário CPF compacto.

### 1.6 Admin chat — Server Actions (audit P1)
Antes: `admin-chat-inbox.tsx` usava `useSupabase()` (browser client com JWT do admin). RLS `messages_select_own` exige `sub = user_id` → admin **nunca conseguia ler** thread de outro user (só dele). Insert idem.
Agora:
- Novo `src/app/admin/chat/actions.ts` com `listAdminThreadMessages`, `pollAdminThreadMessages(since)`, `sendAdminMessage`, `markThreadAsRead`. Todas chamam `requireAdmin()` + `createAdminSupabaseClient()`.
- `admin-chat-inbox.tsx` reescrito sem dependência do browser client. Realtime simulado por **polling de 4s** (com `since=lastSeenIso`). Sem RLS workarounds.
- Insert do admin marca `is_read: true` (não precisa contar como "não lida" pro próprio admin).
- Push notification mantida (fetch direto pra `/api/push/send`).

### 1.7 Build/lint/test
- `npm run lint`: 0 errors, 1 warning herdado (sw.js `SW_VERSION` unused).
- `npm run build`: ✅ (Next 15.5.18, Sentry source maps gerando).
- `npm run test`: **113 / 113 verde** (`vitest`).

---

## 2. O que foi deferido (e por quê)

### Migração das 9 rotas de user para RLS client (P2 do audit anterior)
`workout/complete`, `coupon/use`, `estetica/slots`, `loja/checkout`, `loja/payment`, `estetica/loyalty/upload`, `estetica/bookings/[id]/payment`, `estetica/bookings`, `consultoria/anamnese`, `affiliate/click`.

**Razão**: enquanto **A1 não estiver aplicado** (claim `role:"authenticated"` no Clerk de prod), **toda leitura RLS volta vazia**. Migrar essas rotas agora deixaria todas elas quebradas em produção até o dono mexer no dashboard. É inverter a ordem — primeiro destrava o Clerk, depois migra.

**Quando atacar**: na próxima sessão, **depois** que `/admin/treinos/diagnostico` virar "7 de 7" (sinal de que A1 está OK).

### C5 — regenerar `schema.sql` + `database.types.ts` completo
**Razão**: o MCP Supabase desta sessão **não alcança o projeto KathApp** (`auplhaxwaecsppqizxej`) — só vê `simulai`/`mitra`. Não dá pra rodar `pg_dump --schema-only` nem `supabase gen types` sem acesso ao DB de prod. O `as never` no domínio estética é estável em runtime (build passa). Adicionei manualmente o tipo da nova RPC `try_increment_affiliate_click` — único caso onde a falta forçou a mão.

**Quando atacar**: quando tivermos acesso ao DB de prod (CLI configurado, MCP estendido, ou pg_dump do painel).

---

## 3. Ações pendentes (dashboards externos — dono da conta)

| # | Ação | Onde | Status |
|---|------|------|--------|
| **A1** | Adicionar claim `{"role":"authenticated"}` no token de sessão do Clerk **prod** (`clerk.kathguedes.com.br`) | Dashboard Clerk → Configure → Sessions → Customize session token | ⏳ |
| **A2** | Desativar allowlist de IP da chave Asaas (sandbox e — quando promover — prod) | Dashboard Asaas | ⏳ |
| **A3** | Aplicar `supabase/migrations/28_drop_redundant_c1_trigger.sql` | Painel Supabase SQL (ref `auplhaxwaecsppqizxej`) | ⏳ |
| **A6** | Aplicar `supabase/migrations/29_affiliate_monthly_usage_rpc.sql` (nova, desta sessão) | Painel Supabase SQL | ⏳ |
| **A7** | Setar env vars do Sentry na Vercel: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` (mín.). Opcional: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Vercel → Project → Environment Variables → Production | ⏳ |

> Validação após A1: abrir `/admin/treinos/diagnostico` (prod) → seção 4 deve virar "7 de 7" e veredito "Tudo correto".
> Validação após A2: curl com a chave Asaas deve virar `200`.
> Validação após A6: chamar `POST /api/affiliate/click` 4× no mesmo mês como user FREE → 4ª chamada deve voltar `429 monthly_limit_reached`.
> Validação após A7: forçar um throw em rota qualquer e ver aparecer no Sentry.

---

## 4. Pendente (Sprint 2/3 — herdado)

| Sev | Item | Nota |
|-----|------|------|
| P0 dívida | **C5** regenerar `schema.sql` + `database.types.ts` (completo) | depende de acesso ao DB; runtime atual estável |
| P1 | **`notifyAdmins` no-op** — `team_members` sem `clerk_user_id` | **CUIDADO**: mexer aqui afeta sócios. Tratar como ação aditiva (preencher `clerk_user_id` por sócio, sem reset) |
| P2 | **9 rotas user com admin client** | deferido até A1 (ver §2) |
| P2 | **CSP em Report-Only** | promover quando worker-src `'self' blob:` for adicionado |
| P2 | `audit_log` (handbook §7.5) não implementado | |
| P3 | Seeds Rickroll, OCR stub, Lalamove/99 stubs, tokens de cor fora do design em `user-tier-table.tsx`/`bookings-calendar.tsx` | limpeza |

---

## 5. Mudanças neste documento

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-25 | Claude (Opus 4.7) | Sprint 1 fechado: Sentry instalado, F4 carência, Zod anamnese, limite mensal afiliado (com migration 29), CPF inline em loja/estética, admin chat via Server Actions. C5 parcial (só RPC nova). 9 rotas RLS-client deferidas até A1. Build/lint/test verdes (113/113). |
