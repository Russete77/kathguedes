# Plataforma — Modelo Financeiro

> Implementado em 2026-05-02 conforme `docs/superpowers/specs/2026-05-02-modelo-financeiro-design.md`. Refatora o modelo de planos, adiciona receita unificada (`revenue_streams`), comissões automáticas para sócios e cashback wallet (loja + estética).

## 1. Visão geral

O modelo financeiro tem 4 pilares:

1. **Planos admin-editáveis** (`plans` table) — substitui as constants hardcoded `PLAN_PRICES`/`PLAN_DESCRIPTIONS`/`PLAN_HIERARCHY` que viviam em `lib/asaas/config.ts`.
2. **Receita unificada** (`revenue_streams`) — toda transação confirmada (mensalidade, loja, estética, afiliado externo) gera uma linha. É a única fonte de verdade para faturamento e splits.
3. **Comissões automáticas** (`commission_rules` + `commission_allocations`) — RPC `compute_commissions` aloca para `partner`/`consultant` por regras explícitas e residual para `owner`.
4. **Cashback** (`wallet_credits` + `wallet_balance`) — gerado em cada transação confirmada (após consolidação para loja/estética), gasto no checkout (FIFO), expira em 120 dias.

## 2. Tiers de plano

| `plan_tier` | Nome exibido | `level` | Preço | Cashback | Loja off | Estética off |
|-------------|--------------|:-------:|------:|:--------:|:--------:|:------------:|
| `free` | Free | 0 | — | 0% | 0% | 0% |
| `acesso` | Acesso | 1 | R$ 19,90 | 2% | 5% | 5% |
| `plano1` | Plano 1 — Treino | 2 | R$ 39,90 | 3% | 8% | 7% |
| `plano2` | Plano 2 — Treino + Dieta | 3 | R$ 74,90 | 5% | 12% | 10% |
| `plano3` | Plano 3 — Saúde Completa | 4 | R$ 99,90 | 7% | 18% | 12% |
| `atleta` | Atleta | 5 | R$ 309,90 | 10% | 25% | 15% |

Todos os percentuais são *defaults* — admin altera em `/admin/plans`.

**Gating cumulativo:** cada tier herda os benefícios dos anteriores. Função SQL `plan_tier_level(slug) → int` faz lookup dinâmico em `plans`.

## 3. Splits de comissão

```
Russo: 25% de TUDO (regra geral, sem filtros)
Sidney: 30% só de mensalidades de plano1, plano2, plano3, atleta
Kath: residual automático (owner) — recebe o que sobra após explícitas e absorve o cashback queimado
```

Detalhe: `compute_commissions(revenue_stream_id)` (RPC) faz:
1. Itera `commission_rules` ativas vigentes que matcham `(applies_to_type, applies_to_category)` para `partners`/`consultants`. Aloca `pct * net_cents / 100`.
2. Cria allocation residual para o `owner` ativo: `net_cents − soma(explícitas) − cashback_used_cents`.

| Categoria de receita | Russo | Sidney | Kath |
|----------------------|:-----:|:------:|:----:|
| Mensalidade `acesso` | 25% | 0% | 75% |
| Mensalidade `plano1`/`plano2`/`plano3`/`atleta` | 25% | 30% | 45% |
| Loja (qualquer módulo) | 25% | 0% | 75% |
| Estética | 25% | 0% | 75% |
| Afiliado externo (qualquer slice) | 25% | 0% | 75% |

**Sobre líquido** (`net_cents = gross_cents − cost_cents`). `cost_cents` = CMV (custo do fornecedor para produto, custo médio de insumos para serviço de estética). Mensalidades e afiliados têm `cost_cents = 0`.

## 4. Cashback (wallet interno)

| Regra | Valor |
|-------|-------|
| Quem absorve | Kath (owner) — sai do residual da Kath em `compute_commissions` |
| Validade | 120 dias por crédito (FIFO no consumo) |
| Pode gastar em | Loja + Estética **apenas** |
| Não pode | Mensalidade, saque, transferência |
| Limite por transação | Até 50% do `gross_cents` da compra |
| Gera cashback sobre cashback? | Não — só sobre `amount_paid_cash` |
| Crédito quando? | Mensalidade: imediato no `PAYMENT_CONFIRMED`. Loja: ao mudar `orders.status='delivered'` (server action `updateOrderStatus`). Estética: ao mudar `estetica_bookings.status='done'` (server action `updateBookingStatus`). |
| Cancelamento | Reverte cashback se ainda não foi usado; trava se foi gasto |
| Aviso de expiração | Cron diário (`/api/cron/wallet-expire`) notifica push 7 dias antes |
| Limite mensal de acúmulo | Não enforçado nesta versão (admin pode adicionar via migration futura) |

Helpers SQL: `compute_cashback_cents(user_id, amount_paid_cash_cents)`, `wallet_active_cents(user_id)`, `spend_wallet_cents(user_id, amount, revenue_stream_id?)` (FIFO com `for update`), `credit_wallet_cents(user_id, amount, source_stream_id, validity_days?)`, `expire_wallet_credits()` → int.

Helpers TS em `lib/billing/wallet.ts`: `getWalletActiveCents`, `getWalletBalance`, `spendWalletCents`, `creditWalletCents`, `expireWalletCredits`, `listWalletCreditsForUser`.

## 5. Fluxo: webhook Asaas → revenue_streams

`/api/webhook/asaas/route.ts` faz:
1. Verifica token (`verifyWebhookToken` timing-safe).
2. Idempotência: INSERT em `webhook_events` com PK `(payment_id:event)`. Se 23505 → duplicate, return 200.
3. Roteia via `parseExternalReference(payment.externalReference)`:
   - `"estetica:<id>"` → `handleEsteticaPayment`
   - `"loja:<id>"` → `handleLojaPayment`
   - userId puro → `handleMensalidadePayment`
4. Em cada handler:
   - Atualiza tabela alvo (`estetica_bookings`/`orders`/`profiles`)
   - Cria `revenue_streams` via `recordRevenueStream` (que dispara `compute_commissions`)
   - Mensalidade: credita cashback imediato + `ensureConsultationForTier` (plano2/plano3 → mensal; atleta → premium)
   - Loja/Estética: cashback creditado depois nas transições `delivered`/`done`
5. Em erro de handler: `handleApiError` retorna 5xx para Asaas reentregar.

## 6. Crons (Vercel Cron)

Configurados em `vercel.json`:

| Path | Schedule | O quê |
|------|----------|-------|
| `/api/cron/wallet-expire` | `0 6 * * *` (06:00 UTC diário) | Marca créditos expirados como usados; notifica usuários cujo cashback expira em 7 dias |
| `/api/cron/order-timeout` | `0 * * * *` (de hora em hora) | Cancela orders/bookings em `pending` há >24h; reverte estoque (orders) + cashback (orders+bookings, validade 30d) |

Auth: `Authorization: Bearer ${CRON_SECRET}` — env var obrigatória em produção.

## 7. Painel admin

Rotas novas em `/admin/`:

- **`/admin/financeiro`** — visão geral (receita 30d por type, KPIs, carteira agregada)
- **`/admin/financeiro/comissoes`** — allocations por status; aprovar lote (draft → approved); marcar pago (approved → paid) com referência; "a pagar por sócio"
- **`/admin/financeiro/afiliado-externo`** — form para registrar payout mensal por plataforma + slice por módulo (fitness/moto/geral); histórico
- **`/admin/team`** — CRUD `team_members` (id/clerk_user_id/email/full_name/role/pix_key/bank_account/is_active)
- **`/admin/team/regras`** — CRUD `commission_rules` (team_member_id/applies_to_type/applies_to_category/pct/applies_from/applies_to/is_active)
- **`/admin/plans`** — editor de tiers (preço/cashback/descontos/features JSON/is_active). Após salvar, invalida cache (`_resetPlanCache`) + `revalidatePath`.

Aviso fixo no `/admin/plans`: mudanças de preço **não** afetam assinantes existentes. Asaas mantém o valor da subscription até a próxima renovação.

## 8. Eventos de borda

| Cenário | Comportamento |
|---------|---------------|
| User aplica cashback > 50% gross | Server clampa em 50%; UI já valida |
| User aplica cashback > saldo | Server clampa no saldo; UI já valida |
| Webhook chega antes da transição `delivered`/`done` | Cashback creditado só na transição (não no webhook) |
| Pedido cancelado antes do webhook | Cron horário detecta + cancel + reversão de cashback (validade 30d) |
| Pedido cancelado depois do webhook (refund) | `revenue_streams.status` → `'refunded'`; allocations afetadas → `'failed'` (via `refundRevenueStream`); cashback consumido **não** ressuscita |
| Duas requests paralelas tentando gastar mesmo crédito | RPC `spend_wallet_cents` usa `FOR UPDATE` → serializa |
| Preço de plano alterado | Asaas mantém valor antigo até a renovação. Painel admin avisa. |
| Sócio adicionado/removido | Allocations existentes mantêm; novas seguem regras vigentes |

## 9. Como aplicar a migration em sandbox

A migration consolidada está em `supabase/migration_modelo_financeiro.sql` (637 linhas). Aplique via:

```bash
psql $SUPABASE_DB_URL -f supabase/migration_modelo_financeiro.sql
```

Ou pelo Dashboard Supabase → SQL Editor → cola o conteúdo do arquivo.

**Verificações pós-migration:**

```sql
select count(*) from public.plans;            -- esperado: 6
select count(*) from public.team_members;     -- esperado: 3
select count(*) from public.commission_rules; -- esperado: 5 (Russo geral + Sidney 4 planos)
select plan_tier_level('atleta');             -- esperado: 5
select plan_tier_level('inexistente');        -- esperado: 0

-- Testar compute_commissions com stream fake
do $$
declare
  v_stream uuid;
  v_user_test text := 'test_smoke';
  v_count int;
begin
  insert into public.profiles (id, full_name, plan_tier) values (v_user_test, 'Test', 'plano3') on conflict do nothing;
  insert into public.revenue_streams (type, category, user_id, reference_type, reference_id, gross_cents, cost_cents, occurred_at)
  values ('mensalidade', 'plano3', v_user_test, 'subscription', 'sub_test_001', 9990, 0, now())
  returning id into v_stream;
  v_count := public.compute_commissions(v_stream);
  raise notice 'Allocations created: %', v_count;
  raise notice '%', (
    select string_agg(tm.full_name || ': ' || ca.pct || '% = R$' || (ca.amount_cents/100.0), ', ')
    from public.commission_allocations ca
    join public.team_members tm on tm.id = ca.team_member_id
    where ca.revenue_stream_id = v_stream
  );
  -- Esperado: Russo 25%=R$24.97, Sidney 30%=R$29.97, Kath 45%=R$44.96 (somam R$99.90)
  delete from public.commission_allocations where revenue_stream_id = v_stream;
  delete from public.revenue_streams where id = v_stream;
  delete from public.profiles where id = v_user_test;
end $$;
```

Após aplicar, regenerar tipos TS (opcional — Task 4 já editou manualmente o que era crítico):

```bash
supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > src/lib/supabase/types.ts
```

## 10. Smoke test em sandbox (após migration)

1. **Sandbox Asaas**: criar customer + simular `PAYMENT_CONFIRMED` para cada um dos 5 valores: 19.90, 39.90, 74.90, 99.90, 309.90.
2. Para cada um:
   - Conferir `profiles.plan_tier` atualizado.
   - `revenue_streams` tem 1 row de `type='mensalidade'`, `category=<slug>`.
   - `commission_allocations` tem 2 rows (Russo + Kath) ou 3 (Russo + Sidney + Kath para plano1+).
   - `wallet_balance.active_cents` = round(price_cents × cashback_pct / 100).
   - Para plano2/plano3: `consultations` tem nova row `package_type='mensal'`. Para atleta: `package_type='premium'`.
3. **Loja**: simular `PAYMENT_CONFIRMED` com `externalReference="loja:<orderId>"`. Conferir `orders.status='paid'` + `revenue_streams.type='loja'`. Mudar status para `'delivered'` em `/admin/loja` → cashback creditado.
4. **Estética**: idem com `externalReference="estetica:<bookingId>"`. Mudar para `'done'` em `/admin/kath-estetica/agendamentos` → cashback creditado.
5. **`/admin/financeiro`**: confere KPIs e tabela.
6. **`/admin/financeiro/comissoes`**: aprova lote → marca pago.
7. **`/admin/financeiro/afiliado-externo`**: registra payout teste com slices 50/30/20.

## 11. Configurar ambiente

Adicionar ao `.env.local` (já em `.env.example`):

```
CRON_SECRET=<gerar string aleatória forte>
```

No Vercel Dashboard → Project → Settings → Environment Variables, adicionar `CRON_SECRET` para Production e Preview.

## 12. Referências cruzadas

- Spec: `docs/superpowers/specs/2026-05-02-modelo-financeiro-design.md`
- Plano: `docs/superpowers/plans/2026-05-02-modelo-financeiro.md`
- Auditoria: `docs/audit/2026-05-01-cto-audit.md` (gaps que originaram esse modelo)
- Pagamentos Asaas: `docs/wiki/plataforma/pagamentos-asaas.md` (atualizado com novo fluxo)
- Loja: `docs/wiki/dominio/loja.md`
- Estética: `docs/wiki/dominio/kath-estetica.md`
- Chat: `docs/wiki/dominio/chat.md` (agora Plano 3+, sender_role)
- Planos: `docs/wiki/dominio/perfil-onboarding-planos.md` (6 tiers + cashback)
