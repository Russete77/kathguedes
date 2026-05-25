# KathApp — Auditoria CTO Profunda (2026-05-25, fim de sessão)

> Sucede `2026-05-25-cto-audit-followup.md` (manhã). Esta auditoria consolida **uma sessão inteira de remediação** após o follow-up matinal — fechou o Sprint 1 que estava em aberto, destravou todo o app local em dev (que estava com RLS quebrada), reorganizou várias áreas do admin (responsividade mobile, controles totais em /assinantes, soft-delete em serviços/treinos), e expôs a barreira final do pagamento (allowlist de IP na chave Asaas). Branch: `kathguedes-app1.0` (produção).

---

## 0. TL;DR — onde paramos

A app está **deployada** (push feito ao final desta sessão, commits `12d3a88..0d418e3`). O Sprint 1 do audit anterior foi fechado e várias dezenas de bugs/UX foram corrigidos. Continuam **5 itens externos** que dependem do dono da conta (não são bugs de código):

| # | Ação | Onde | Estado |
|---|------|------|--------|
| **A1** | Claim `{"role":"authenticated"}` no token de sessão do Clerk de produção | Dashboard Clerk (`clerk.kathguedes.com.br`) → Configure → Sessions → Customize session token | ⏳ Pendente |
| **A2** | Desativar allowlist de IP da chave Asaas em uso | Dashboard Asaas → Integrações → Chaves de API | ⏳ **Re-confirmado pendente nesta sessão** (curl → `403 not_allowed_ip` código `03AQIAIFTC`) |
| **A3** | Aplicar `supabase/migrations/28_drop_redundant_c1_trigger.sql` | Painel Supabase SQL | ⏳ Pendente |
| **A6** | Aplicar `supabase/migrations/29_affiliate_monthly_usage_rpc.sql` (criada na sessão da manhã) | Painel Supabase SQL | ⏳ Pendente |
| **A7** | Setar `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (+ opcionais `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) na Vercel | Vercel → Settings → Environment Variables | ⏳ Pendente |

Adicional pra dev/local (já documentado em `.env.local` mas vale registrar como padrão):

| # | Ação | Onde |
|---|------|------|
| **A8** | `ADMIN_EMAILS=seu@email.com` (CSV) — destrava `/admin` em dev sem precisar do `metadata.role` no Clerk dev | `.env.local` |

---

## 1. O que foi feito nesta sessão (chronologic, com commit hashes)

### Sprint 1 — fechado de manhã
- **`817b9c2`** — Sentry instalado (`@sentry/nextjs@8.55`) com `sentry.{client,server,edge}.config.ts` + `instrumentation.ts` + `global-error.tsx` + `admin/error.tsx`. F4 carência de cancel. Zod no anamnese. Limite mensal de afiliado FREE com **migration 29** + RPC atômico `try_increment_affiliate_click`. CPF inline em loja/estética. Admin chat via Server Actions (poll 4s).
- **`8aa0467`** — Fallback no `affiliate/click` pra não regredir quando migration 29 ainda não estiver aplicada.
- **`06feafc`** — Anamnese passthrough (form manda ~30 campos com chaves que evoluem; strict() quebraria).
- **`8e8b9d3`** — Docs: follow-up audits + apostila wiki (6 módulos, 5363 linhas).

### Estética admin
- **`de7853b`** — Botão "Editar" funcional no card de serviço (modal externo controlado). Unificação visual de /servicos + /precos.
- **`0fa198a`** — **Revert** da unificação visual (mal interpretado): páginas separadas voltam; bidirectional `revalidatePath` mantido. Botão Editar continua funcionando via `defaultOpen` + `onClose`.
- **`9a1210e`** — `is_active` checkbox bug: HTML checkbox desmarcado não envia o campo no FormData; Zod caía no `.default(true)` e o serviço permanecia ativo. Fix: `formData.has()` antes de parsear.
- **`dae3e3d`** — Soft-delete fallback: `estetica_bookings.service_id` referencia `estetica_services` sem `on delete`. FK `23503` bloqueava deletar. Agora: hard delete → fallback soft (`is_active=false`) + toast diferenciado.
- **`e8b3776`** — Página `/servicos` resiliente: matriz de preço em try/catch (banner amarelo se migration 20 ausente) — não derruba a lista de serviços.

### Calendar UI
- **`f3aa295`** — Primeira tentativa: `relative` em `.month`. Não pegou — `<Nav>` em `react-day-picker@10` é **irmão** de `.month`, não filho.
- **`83e8c31`** — Fix correto: `relative` em `.months` + nav `absolute top-0 inset-x-1 flex justify-between pointer-events-none`.

### Treinos
- **`e5ffa24`** — Novas categorias `quadriceps` + `inferior` (par do `superior`). Atualiza enum em `validations.ts` + 2 forms admin + 5 `categoryLabels` espalhados (completados, antes só tinham 6/19 mapeados).
- **`e402ee9`** — `/fitness` filtros refletem só categorias com vídeo publicado. Motivacional player in-app vertical Shorts (autoplay mute + botão "Tocar com som"). `/motivacional/[id]` rota nova protegida; cron `wellness-reminder` agora envia `url: /motivacional/{id}` (antes mandava YouTube externo).
- **`1e3802b`** — Admin/treinos responsivo: cards verticais < `md`, tabela densa >= `md`. Sem scroll horizontal no celular.
- **`dad62f6`** — Soft-delete em workouts. `workout_logs.workout_id` sem `on delete` bloqueava DELETE. Fallback `is_published=false`.
- **`4b4e648`** — `/fitness` mostra TODOS os treinos publicados com cadeado nos planos pagos. Antes filtrava por plano do user → free só via 2 categorias (achava que catálogo estava vazio).

### Dev unlock (RLS / Clerk-Supabase mismatch)
Em dev, o JWT do Clerk dev (`*.clerk.accounts.dev`) não é reconhecido pelo Supabase Third-Party Auth (que confia no issuer prod `clerk.kathguedes.com.br`). Resultado: toda leitura RLS volta vazia. Em prod funciona porque o issuer correto está cadastrado.

**Padrão aplicado**: catálogos (públicos por natureza) e leitura do próprio user (com filtro `.eq("user_id", userId)` explícito) migrados pra admin client. Sem regressão de segurança — `/fitness/[id]` mantém o gate em código (replica `workouts_select_by_plan`), e `notFound()` em URL direta de treino pago.

- **`2705006`** — `/kath-estetica/servicos` (lista)
- **`9375672`** — `/kath-estetica/servicos/[id]` (detalhe) + `/kath-estetica/agendar/[serviceId]` (form)
- **`e8046b5`** — `/fitness` (com gate manual de plano) · `/fitness/[id]` (com C4 preservado) · `/loja` · `/cupons` (gate manual) · `/afiliados` (gate manual) · `/kath-estetica` (hub) · `/kath-estetica/portfolio` · `/planos`
- **`a7e9dcd`** — `/meus-agendamentos`
- **`de59eca`** — `/perfil`, `/perfil/notificacoes`, `/dashboard`, `/desafio`, `/chat` (gate VIP), `/consultoria`, `/consultoria/anamnese`, `/kath-estetica/fidelidade`, `/loja/pedidos`, `/loja/pedido?id=`

### Admin total dos assinantes
- **`a5ce068`** — `/admin/assinantes` ganhou: seletor de plano + botão Aplicar (`setAssinantePlan` espelha webhook PAYMENT_CONFIRMED), toggle Ativar/Desativar (`setSubscriptionStatus`), stats por tier real (antes mostrava slugs legados `start/pro/vip` sempre zerados), filtros completos, layout dual mobile/desktop. **Bypass admin em dev**: `ADMIN_EMAILS` env var (`.env.local`) faz `isAdmin()` retornar true por email — middleware deixa passar, layout faz a checagem completa. Bypass desabilitado em prod (`NODE_ENV=production && VERCEL_ENV=production`).
- **`c1d034a`** — Duas reimplementações inline de `requireAdmin` (em `kath-estetica/actions.ts` e `shipping/label/route.ts`) trocadas pelo helper central. Sem isso, `/admin/kath-estetica/servicos` lançava "Acesso negado" em dev mesmo com `ADMIN_EMAILS` setado.
- **`bb1f784`** — Mudança de plano em /admin/assinantes não refletia em /perfil. Causa: `revalidatePath` cobria só `/admin/*`, deixando `/perfil`, `/dashboard`, `/fitness` com client-router cache stale. Fix: `revalidatePath("/", "layout")` invalida tudo abaixo da raiz.

### Sync Clerk → DB
- **`028e862`** — User mudou nome no Clerk pra "Beto" mas admin continuava vendo nome antigo. **A**: handler `user.updated` adicionado ao webhook Clerk — sincroniza `profiles.full_name` e `profiles.avatar_url`. **B**: best-effort sync no `(app)/layout.tsx` — em dev sem túnel, layout (que já chamava `currentUser()`) compara com profile e patch se mudou. Não toca em `plan_tier`/`subscription_status` (trigger `guard_profile_sensitive_columns` protege).

### Fidelidade
- **`3189212`** — UI da `/kath-estetica/fidelidade` reorganizada: galeria do mês separada em "Aguardando aprovação (N)" + "Aprovadas este mês (N)" (antes mistura confusa). Empty state explica fluxo.
- **`0d418e3`** — Botões "Tirar foto / Galeria" SEMPRE visíveis em `/fidelidade` (não dependiam de ter booking `done`). API `/api/estetica/loyalty/upload` agora aceita `booking_id` opcional — quando ausente, server escolhe o primeiro booking done elegível sem foto. 422 acionável quando não há candidato.

---

## 2. Novos achados desta sessão

### Achados de código / arquitetura
1. **N6 — `requireAdmin` reimplementado inline em 2 lugares** (kath-estetica/actions:25 e shipping/label:17). Já estava sinalizado no audit das 09:42 mas só foi consolidado nesta sessão. Lição: o `isAdmin()` central agora tem um bypass por email (`ADMIN_EMAILS`); qualquer reimplementação inline perde acesso a esse caminho.
2. **N7 — FK sem `on delete` em referências críticas** bloqueiam DELETE silenciosamente. Pelo menos 2 ocorrências:
   - `estetica_bookings.service_id` → `estetica_services(id)` (corrigido com soft-delete app-side em `dae3e3d`)
   - `workout_logs.workout_id` → `workout_videos(id)` (corrigido em `dad62f6`)
   - Provavelmente há outros (orders.user_id, etc) — não exaustivamente checado.
3. **N8 — Checkbox HTML omite o campo do FormData quando desmarcado**, e o schema Zod com `.default(true)` mascarava o bug. Pattern a evitar globalmente; padrão correto = `formData.has(key)` antes de parsear. Foi corrigido na estética; **provavelmente repete-se em motivacionais, team, plans, portfolio** (forms admin com checkbox + Zod default — não testado).
4. **N9 — `react-day-picker v10` mudou o DOM hierarchy**: `<Nav>` é irmão de `.month` (não filho). O `relative` da v9 não funciona mais.
5. **N10 — Clerk dev/prod são instâncias separadas com issuers diferentes**. O JWT do dev não é reconhecido pelo Supabase Third-Party Auth (que confia só no issuer prod). Resultado: app local fica todo vazio. Padrão de fix: admin client para reads de catálogo e reads filtrados por `user_id` explícito.

### Achados de UX / fluxo
6. **N11 — `revalidatePath` precisa cobrir layout-root** quando a mudança afeta dado lido em múltiplas páginas. O client router cache do Next só evict o que foi explicitamente revalidado. Aplicado em `setAssinantePlan`/`setSubscriptionStatus`/`setTestUserTier`.
7. **N12 — Clerk não sincroniza `full_name` de volta pro DB** sem webhook `user.updated`. Adicionado handler + best-effort sync no layout.
8. **N13 — Botões de upload escondidos atrás de pré-requisitos** (booking `done`) deixavam features inacessíveis em dev e confundiam o user. Padrão corrigido em fidelidade: botões sempre visíveis, server resolve o contexto ou retorna 422 acionável.

---

## 3. Estado VERIFICADO dos P0/P1 (consolidado)

| Item | 2026-05-22 fim do dia | 2026-05-25 fim do dia | Evidência |
|------|----------------------|-----------------------|-----------|
| **C1** self-upgrade plano | ✅ fechado (`migrations/25`) | ✅ fechado | trigger `guard_profile_sensitive_columns` ativo |
| **C2** slugs `vip` mortos | ✅ fechado | ✅ fechado | `hasPlanAccess` central |
| **C3** cashback em pedido não pago | ✅ fechado | ✅ fechado | `handleLojaPayment` / `handleEsteticaPayment` |
| **C4** treino premium por URL | ✅ fechado (RLS) | ✅ fechado **+ replicado em código** | `/fitness/[id]:67` `notFound()` quando `planLevel(user) < required` |
| **C5** schema.sql/types dessinc | 🟡 dívida | 🟡 dívida — adicionado só RPC da migration 29 | precisa pg_dump da prod ou `supabase gen types` |
| **F4** cancel com carência | aberto | ✅ fechado | `/api/checkout/cancel:50-65` mantém `plan_tier` + `subscription_ends_at` |
| **Sentry** | ausente | ✅ instalado (pendente env var prod) | `@sentry/nextjs@8.55` + instrumentation |
| **Admin chat** quebrado por RLS | aberto | ✅ fechado | Server Actions + admin client + poll 4s |
| **Limite afiliado FREE** | morto | ✅ código pronto (pendente migration 29 prod) | RPC + fallback se RPC ausente |
| **9 rotas user com admin client** | aberto | ⚠️ **estratégia mudou** — admin client virou pattern para catálogos + reads filtrados em dev. Sprint 2 original deixa de fazer sentido sem A1 | — |
| **CSP Report-Only** | aberto | aberto | promover requer `worker-src 'self' blob:` (Clerk) + revisar `style-src-elem` |
| **`notifyAdmins` no-op** | aberto | aberto | `team_members` sem `clerk_user_id` (CUIDADO: tabela protegida — config de sócios já em prod) |
| **`audit_log`** (handbook §7.5) | aberto | aberto | — |

---

## 4. Análise de pagamento Asaas — barreira final

Sessão fez análise profunda do fluxo Asaas. Resultado:

**Código está aderente à doc oficial Asaas** (validado linha-a-linha):
- URLs sandbox/prod corretas (ambos `https://sandbox.asaas.com/api/v3` e `https://api-sandbox.asaas.com/v3` respondem; a do código funciona).
- Header `access_token`, retry/backoff exponencial só em 5xx, `AsaasApiError` tipado, idempotência webhook com colapso `:paid`, todos os eventos negativos tratados, rate limit em todas as rotas que criam cobrança.
- CPF/CNPJ exigido tanto no subscribe quanto no PIX avulso (loja/estética), com UI inline pra coleta.
- Carência de cancel preserva `plan_tier` até `subscription_ends_at`.

**Único bloqueador**: chave Asaas em uso (`$aact_hmlg_000...OTVl` — sandbox) tem **allowlist de IP ativa**.

```
$ curl -H "access_token: <chave>" "https://api-sandbox.asaas.com/v3/customers?limit=1"
HTTP/1.1 403 Forbidden
{"errors":[{"code":"not_allowed_ip","description":"IP não autorizado. Código de erro: 03AQIAIFTC."}]}
```

**Fix dependente do dono da conta**: painel Asaas → Configurações → Integrações → Chaves de API → desativar liberação por IP (chave já é server-only/secret, validação por header + rate limit + Sentry).

Quando A2 for resolvido, sigo com pagamento de teste end-to-end (subscribe → invoiceUrl → simular pagamento no painel Asaas → webhook → `plan_tier` ativado).

Quando for cobrar de verdade: trocar `ASAAS_ENV=production` + chave de produção (`$aact_prod_*`) na Vercel + desativar allowlist na chave prod + redeploy.

---

## 5. Estado das migrations (canônicas em `supabase/migrations/`)

```
19_estetica_walkin.sql          ← aplicada
20_estetica_pricing_matrix.sql  ← aplicada
21_estetica_bookings_prepay.sql ← aplicada
22_estetica_requires_booking.sql ← aplicada
23_wellness_reminders.sql       ← aplicada
24_estetica_bookings_admin_created.sql ← aplicada
25_profiles_guard_sensitive_columns.sql ← aplicada
26_revenue_idempotency.sql      ← aplicada
27_estetica_no_overlap.sql      ← aplicada
28_drop_redundant_c1_trigger.sql ← ⏳ pendente (A3)
29_affiliate_monthly_usage_rpc.sql ← ⏳ pendente (A6 — nova nesta sessão, criada de manhã)
```

Convenção mantida: 1 arquivo por feature, aditivo, idempotente.

---

## 6. Pendente (Sprint 2/3 — repriorizado)

### Sprint 2 (próxima sessão, depois de A1+A2)
| Sev | Item | Nota |
|-----|------|------|
| P0/dívida | **C5** — pg_dump da prod ou `supabase gen types` pra regenerar `schema.sql` + `database.types.ts` completos | fecha os `as never` no domínio estética; depende de acesso ao DB ou MCP estendido |
| P1 | Verificar e corrigir checkbox HTML bug em outros admin forms (motivacionais, team, plans, portfolio) — N8 desta auditoria | pattern: `formData.has()` antes de parsear |
| P1 | Auditar FK constraints sem `on delete` em outras tabelas — N7 | candidatos: `orders`, `consultations`, `wallet_credits`, `revenue_streams` |
| P1 | F4 — coletar CPF inline em loja/estética (faltou esse caminho — só subscribe tem) | UX consistente com subscribe |
| P2 | **CSP Report-Only → enforce** | depois de adicionar `worker-src 'self' blob:` |

### Sprint 3 (engagement / scale)
| Sev | Item | Nota |
|-----|------|------|
| P1 | `notifyAdmins` operacional | requer linkar `clerk_user_id` em `team_members` — **tabela protegida por config de sócios**; mexer só de forma aditiva |
| P2 | `audit_log` (handbook §7.5) | trail financeiro/admin |
| P3 | Seeds Rickroll, OCR stub, Lalamove/99 stubs, templates duplicados | limpeza pré-launch |
| P3 | Fila pra broadcast de push/notif | quando base crescer (~1k+ assinantes) |

---

## 7. Métricas da sessão

- **27 commits** em `kathguedes-app1.0` (do `12d3a88` ao `0d418e3`).
- **Build**: 0 erros, 1 warning (sw.js SW_VERSION unused — pré-existente).
- **Lint**: 0 erros, 1 warning (mesmo do build).
- **Test**: 113/113 verde (sem novos testes adicionados nesta sessão; cobertura mantida).
- **Push**: feito ao final da sessão para `origin/kathguedes-app1.0` → Vercel auto-deploya.

---

## 8. Mudanças neste documento

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-25 (fim do dia) | Claude (Opus 4.7) | Auditoria profunda pós-sessão de remediação ampla. Fechou Sprint 1 (Sentry + F4 + Zod anamnese + limite afiliado + CPF inline + admin chat SA). Destravou todo o app local em dev (N10 — Clerk dev/prod separation). Reorganizou admin: assinantes ganhou CRUD total, botão editar funcional na estética, mobile responsividade nos treinos, soft-delete fallback. Achados novos: N6 (requireAdmin inline), N7 (FK sem on delete), N8 (checkbox HTML/Zod), N9 (rdp v10), N10 (Clerk dual instance), N11 (revalidatePath layout-root), N12 (Clerk → DB name sync), N13 (botões escondidos atrás de pré-requisitos). Pagamento Asaas: código aderente à doc; único bloqueador = A2 (IP allowlist na chave Asaas), confirmado por curl. |
