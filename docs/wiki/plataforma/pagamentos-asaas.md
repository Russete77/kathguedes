# Setor: Pagamentos (Asaas)

## 1. Visão geral

- **Propósito:** Integração com o gateway de pagamentos brasileiro **Asaas** (PIX, Boleto e Cartão de Crédito) para cobrar assinaturas mensais dos planos KathApp (`start`, `pro`, `vip`) e cobranças avulsas de bookings da Estética. Inclui cliente HTTP, helpers de checkout, webhook receiver com idempotência e despacho de eventos para os domínios consumidores.
- **Quem usa:** Backend (server-only). É invocado pelo usuário final indiretamente via rotas `/api/checkout/*` (assinaturas) e `/api/estetica/bookings/[id]/payment` (Estética). Admins não interagem diretamente.
- **Status percebido:** **production** — sandbox vs produção controlado por `ASAAS_ENV`; webhook protegido por token + idempotência atômica via `webhook_events` (PRIMARY KEY); cobre os 6 eventos de pagamento da documentação Asaas.

## 2. Rotas

| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `POST /api/webhook/asaas` | `src/app/api/webhook/asaas/route.ts` | API Route | Recebe eventos de pagamento do Asaas, valida token, garante idempotência, despacha para handlers (assinatura ou estética). |
| `POST /api/checkout/subscribe` | `src/app/api/checkout/subscribe/route.ts` | API Route | Cria customer + subscription no Asaas para o usuário Clerk autenticado. Retorna `invoiceUrl` e (se PIX) QR code. |
| `POST /api/checkout/cancel` | `src/app/api/checkout/cancel/route.ts` | API Route | Cancela a subscription Asaas atual e faz downgrade do `plan_tier` para `free`. |

> O fluxo completo de checkout (UI, página `/planos`, validação client-side) é responsabilidade do setor **Loja / Planos**. Aqui só documentamos os endpoints que tocam Asaas.

## 3. Componentes

**N/A** — A integração Asaas é puramente backend (lib + API routes). Os componentes UI que disparam o checkout (ex.: `src/app/(app)/planos/subscribe-button.tsx`) pertencem ao setor Loja/Planos.

## 4. Server Actions / API Routes

| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `/api/checkout/subscribe` | POST | `{ plan: "start"\|"pro"\|"vip", billingType: "PIX"\|"BOLETO"\|"CREDIT_CARD" }` (`subscribe/route.ts:22-25`) | `{ subscriptionId, customerId, invoiceUrl, billingType, pixQrCode?, pixPayload?, message }` (`subscribe/route.ts:115-123`) | UI da página `/planos` (subscribe-button.tsx) |
| `/api/checkout/cancel` | POST | (sem body — usa `userId` do Clerk) | `{ ok: true }` (`cancel/route.ts:62`) | Tela de gerenciamento de assinatura |
| `/api/webhook/asaas` | POST | `AsaasWebhookPayload` (header `asaas-access-token`) (`webhook.ts:18-30`) | `{ received: true, duplicate?: true }` ou `4xx` | Asaas (servidor externo) |
| `processCheckout(...)` | função | `CheckoutParams` (`checkout.ts:21-27`) | `CheckoutResult` (`checkout.ts:29-36`) | `subscribe/route.ts:102-108` |
| `createCustomer(params)` | função | `{ name, email, cpfCnpj? }` (`client.ts:36-40`) | `AsaasCustomer` (`client.ts:42-46`) | `processCheckout` (`checkout.ts:55-58`) |
| `createSubscription(params)` | função | `CreateSubscriptionParams` (`client.ts:62-70`) | `AsaasSubscription` (`client.ts:72-79`) | `processCheckout` (`checkout.ts:73-81`) |
| `cancelSubscription(id)` | função | `subscriptionId: string` | `AsaasSubscription` (`client.ts:95-102`) | `cancel/route.ts:50` |
| `getSubscriptionPayments(id)` | função | `subscriptionId: string` | `AsaasPayment[]` (`client.ts:131-138`) | `processCheckout` (`checkout.ts:100`) |
| `getPaymentPixQrCode(id)` | função | `paymentId: string` | `{ encodedImage, payload, expirationDate }` (`client.ts:143-147`) | `processCheckout` (`checkout.ts:107`) |
| `verifyWebhookToken(header)` | função | `headerToken: string \| null` | `boolean` (timing-safe) (`webhook.ts:36-47`) | `webhook/asaas/route.ts:21` |
| `planTierFromValue(value)` | função | `value: number` | `PlanTier` (`webhook.ts:52-57`) | `webhook/asaas/route.ts:109` |

## 5. Modelo de dados

Tabelas exclusivas do setor Pagamentos:

### `webhook_events` (idempotência)

Definida em `supabase/migration_fixes.sql:57-61`:

```sql
CREATE TABLE IF NOT EXISTS webhook_events (
  payment_id TEXT PRIMARY KEY,
  event     TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);
```

- **Chave primária:** `payment_id` — armazena a string composta `${payment.id}:${event}` (`webhook/asaas/route.ts:46`). Ex.: `pay_123abc:PAYMENT_CONFIRMED`.
- **Função:** garantir idempotência atômica do webhook. Asaas reentrega webhooks ao receber 5xx ou timeout; um SELECT-then-INSERT abre janela de race. A solução é `INSERT` direto e tratar `unique_violation` (Postgres SQLSTATE `23505`) como duplicata (`webhook/asaas/route.ts:47-59`).
- **Sem RLS configurada** explicitamente no fix — assume-se acesso via `service_role` (admin client).

> Tabelas como `profiles` (campos `asaas_customer_id`, `asaas_subscription_id`, `plan_tier`, `subscription_status`, `subscription_ends_at`), `estetica_bookings`, `consultations`, `orders` etc. **não** são documentadas aqui — pertencem aos respectivos domínios (Auth/Profile, Estética, Consultoria, Loja).

## 6. Integrações externas

### 6.1 Configuração

`src/lib/asaas/config.ts`:

- `ASAAS_ENV` (`config.ts:6`) — controla a base URL:
  - `production` → `https://api.asaas.com/v3`
  - `sandbox` (default) → `https://sandbox.asaas.com/api/v3`
- `ASAAS_API_KEY` (`config.ts:13-17`) — header `access_token` em toda requisição. Lazy getter (lança se ausente).
- `ASAAS_WEBHOOK_TOKEN` (`config.ts:18-22`) — token compartilhado com Asaas para validar autenticidade do webhook.
- `PLAN_PRICES` (`config.ts:25-29`) — `start: 19`, `pro: 39`, `vip: 99` (BRL).
- `PLAN_DESCRIPTIONS` (`config.ts:31-35`) — strings que aparecem na fatura Asaas.

### 6.2 Endpoints Asaas consumidos

Cliente HTTP em `src/lib/asaas/client.ts` (função `asaasRequest` linhas 10-32, `Content-Type: application/json` + header `access_token`):

| Recurso | Método | Endpoint | Função |
|---|---|---|---|
| Customers | POST | `/customers` | `createCustomer` (`client.ts:48-52`) |
| Customers | GET | `/customers/{id}` | `getCustomer` (`client.ts:54-58`) |
| Subscriptions | POST | `/subscriptions` | `createSubscription` (`client.ts:81-85`) |
| Subscriptions | GET | `/subscriptions/{id}` | `getSubscription` (`client.ts:87-93`) |
| Subscriptions | DELETE | `/subscriptions/{id}` | `cancelSubscription` (`client.ts:95-102`) |
| Payments | GET | `/subscriptions/{id}/payments?limit=1&sort=dateCreated&order=desc` | `getSubscriptionPayments` (`client.ts:131-138`) |
| Payments (PIX) | GET | `/payments/{id}/pixQrCode` | `getPaymentPixQrCode` (`client.ts:143-147`) |

### 6.3 Métodos de pagamento

Definidos em `CreateSubscriptionParams.billingType` (`client.ts:64`) e validados em `subscribe/route.ts:76-80`:

- **PIX** — gera QR code via `/payments/{id}/pixQrCode`, retornado como `pixQrCode` (base64) e `pixPayload` (copia-e-cola).
- **BOLETO** — retorna apenas `invoiceUrl`.
- **CREDIT_CARD** — retorna `invoiceUrl` (Asaas hospeda formulário).

### 6.4 Eventos de webhook tratados

Tipos em `webhook.ts:10-16` (`AsaasPaymentEvent`). Handlers em `webhook/asaas/route.ts:106-211`:

| Evento | Ação no `profiles` | Side-effects |
|---|---|---|
| `PAYMENT_CONFIRMED` | `plan_tier ← planTierFromValue(value)`, `subscription_status="active"`, `subscription_ends_at = +30 dias`, salva `asaas_subscription_id` | Auto-cria `consultations` (pacote `mensal`, status `pending`, válida 30 dias) se plano for VIP e não houver consultoria ativa (`route.ts:124-152`); push notification "Pagamento confirmado!" |
| `PAYMENT_RECEIVED` | `subscription_status="active"` (`route.ts:163-168`) | — |
| `PAYMENT_OVERDUE` | `subscription_status="past_due"` (`route.ts:171-183`) | Push notification "Pagamento pendente" |
| `PAYMENT_DELETED` | `subscription_status="canceled"` (`route.ts:186-191`) | — |
| `PAYMENT_REFUNDED` | `plan_tier="free"`, `subscription_status="canceled"`, `asaas_subscription_id=null` (`route.ts:194-203`) | Downgrade imediato |
| `PAYMENT_PARTIALLY_REFUNDED` | (não altera profile) | Apenas `console.warn` (`route.ts:206-210`) |

Eventos sem handler caem no fallback `console.log` + retorno 200 (`route.ts:223-225`) — Asaas exige 2xx para não reentregar.

### 6.5 Roteamento por `externalReference`

O webhook usa `payment.externalReference` para discriminar fluxos (`route.ts:62-91`):

- **Prefixo `estetica:<bookingId>`** — atualiza `estetica_bookings` para `status="confirmed"` + `paid_at` em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` e dispara push. (Tabela `estetica_bookings` documentada pelo setor Estética.) `externalReference` desse formato é setado em `src/app/api/estetica/bookings/[id]/payment/route.ts:113`.
- **Sem prefixo** — assume fluxo de assinatura: busca `profiles` por `asaas_customer_id` e roda os handlers da seção 6.4. Em `processCheckout` o `externalReference` é o próprio `userId` Clerk (`checkout.ts:80`).

## 7. Validações

- **Checagem de presença e enum** dos campos `plan` / `billingType` em `subscribe/route.ts:62-81` (validação manual, sem Zod).
- **Verificação de token de webhook** com `crypto.timingSafeEqual` (`webhook.ts:36-47`) — protege contra timing attacks. Comparação retorna `false` se `ASAAS_WEBHOOK_TOKEN` ausente, header ausente ou tamanhos diferentes.
- **JSON parse defensivo** do payload do webhook (`route.ts:27-31`) — retorna 400 em JSON inválido.
- **Validação mínima do payload**: exige `payment.customer` (`route.ts:34-36`).
- **Rate limit:** 5 tentativas/minuto/usuário em `/api/checkout/subscribe` via `checkRateLimitAsync` (`subscribe/route.ts:39-48`). Vide setor de Infra/Rate Limit.
- **Sem schemas Zod no escopo Asaas** — N/A. A confiança vem do token verificado + tipos TypeScript (`AsaasWebhookPayload`). Considerar adicionar Zod no Fase B (vide seção 9).

## 8. Fluxos principais

### Fluxo: Criação de assinatura (Checkout)

1. Usuário clica em "Assinar" no `subscribe-button.tsx` (`/planos`) → `POST /api/checkout/subscribe`.
2. Route handler valida `userId` Clerk + rate limit (`subscribe/route.ts:30-48`).
3. Carrega `currentUser()` do Clerk para email + `profiles.full_name` do Supabase (`subscribe/route.ts:50-99`).
4. Chama `processCheckout(...)` (`subscribe/route.ts:102-108` → `checkout.ts:38`).
5. Em `processCheckout`:
   - Lê `profiles.asaas_customer_id` (`checkout.ts:45-49`).
   - Se vazio → `createCustomer({ name, email })` no Asaas (`checkout.ts:54-66`) e persiste `asaas_customer_id` no `profiles`.
   - Calcula `nextDueDate = amanhã` (`checkout.ts:69-71`).
   - Chama `createSubscription({ customer, billingType, value: PLAN_PRICES[plan], cycle: "MONTHLY", description: PLAN_DESCRIPTIONS[plan], externalReference: userId })` (`checkout.ts:73-81`). Asaas auto-gera o **primeiro pagamento**.
   - Persiste `asaas_subscription_id` em `profiles` (`checkout.ts:84-89`).
   - **Aguarda 1.5s** (`checkout.ts:98`) — janela para o Asaas materializar o `payment` da subscription. Vide TODO na seção 9.
   - `getSubscriptionPayments(subscription.id)` → pega o primeiro pagamento e `invoiceUrl` (`checkout.ts:100-103`).
   - Se `billingType === "PIX"` → `getPaymentPixQrCode(payment.id)` retorna QR base64 + payload (`checkout.ts:105-113`).
6. Route devolve `{ subscriptionId, customerId, invoiceUrl, pixQrCode?, pixPayload? }` ao client.
7. Client redireciona para `invoiceUrl` (BOLETO/CARTÃO) ou exibe QR (PIX).
8. **`plan_tier` permanece o que era** — só é ativado quando o webhook `PAYMENT_CONFIRMED` chega (vide próximo fluxo).

### Fluxo: Recebimento de webhook Asaas

1. Asaas envia `POST /api/webhook/asaas` com header `asaas-access-token` + JSON (`AsaasWebhookPayload`).
2. `verifyWebhookToken(header)` compara com `ASAAS_WEBHOOK_TOKEN` via `timingSafeEqual` (`route.ts:20-23`). Falha → 401.
3. `req.json()` defensivo + valida `payment.customer` (`route.ts:27-36`).
4. **Idempotência atômica**: `INSERT INTO webhook_events (payment_id, event)` com `payment_id = "${payment.id}:${event}"` (`route.ts:46-49`). Se já existe (Postgres `23505`) → retorna `{ received: true, duplicate: true }` em 200 (`route.ts:51-56`).
5. **Discriminação por `externalReference`** (`route.ts:62-91`):
   - Começa com `estetica:` → atualiza booking, manda push, retorna 200.
   - Caso contrário → busca `profiles` pelo `asaas_customer_id` e roda handler do evento.
6. Se profile não encontrado → `console.warn` + retorna 200 sem ação (`route.ts:100-103`).
7. Despacha para `handlers[event]` (mapa parcial em `route.ts:106-211`). Erros do handler são logados mas o response continua 200 para evitar reentregas (`route.ts:218-225`).
8. Resposta final: `{ received: true }`.

### Fluxo: Cancelamento de assinatura

1. Usuário (autenticado) → `POST /api/checkout/cancel`.
2. Route lê `profiles.asaas_subscription_id` (`cancel/route.ts:27-39`). Vazio → 400.
3. Chama `cancelSubscription(subscriptionId)` → `DELETE /subscriptions/{id}` no Asaas (`cancel/route.ts:50` → `client.ts:95-102`).
4. Atualiza `profiles`: `plan_tier="free"`, `subscription_status="canceled"`, `asaas_subscription_id=null` (`cancel/route.ts:53-60`).
5. Retorna `{ ok: true }`.

## 9. Observações (notas para Fase B — não auditar agora)

- **Sleep arbitrário de 1.5s** (`checkout.ts:98`) para esperar o Asaas materializar o pagamento da nova subscription. Frágil sob latência alta — considerar polling com backoff ou trigger via primeiro webhook `PAYMENT_CREATED`.
- **`tomorrow.toISOString().split("T")[0]`** em `checkout.ts:69-71` — usa UTC. Pode resultar em `nextDueDate` "ontem" no fuso BRT em horários próximos da meia-noite. Validar.
- **Sem schemas Zod** para `AsaasWebhookPayload`. A confiança vem só do token + tipagem TS. Em produção, payload malformado mas com token válido pode causar exceção não tratada nos handlers.
- **`console.error/log` para auditoria** — não há tabela de log de pagamentos persistente além de `webhook_events`. Saídas só em logs de runtime.
- **Race no contador VIP de consultorias**: a checagem `existingConsultation` (`route.ts:128-133`) é `select-then-insert` sem lock. Se dois webhooks `PAYMENT_CONFIRMED` rodarem em paralelo (cenário raro: idempotência blinda na maior parte), pode criar consultoria duplicada. A trava de idempotência (passo 3.5 do webhook) cobre 99% dos casos.
- **`PAYMENT_PARTIALLY_REFUNDED`** apenas loga (`route.ts:206-210`) — não há reconciliação automática.
- **`PAYMENT_DELETED`** marca canceled mas não zera `plan_tier` nem `asaas_subscription_id`, diferente de `PAYMENT_REFUNDED`. Verificar se é intencional.
- **`getCustomer`** (`client.ts:54-58`) está exposto mas não é chamado em nenhum fluxo atual. Possível dead code.
- **`cpfCnpj`** opcional em `createCustomer` (`client.ts:39`) — Asaas pode exigir para boleto/PIX em produção dependendo do tipo de conta.
- **Nota de teste:** `webhook.test.ts:5-12` confirma que `verifyWebhookToken` lança quando `ASAAS_WEBHOOK_TOKEN` está ausente (referência ao fix SD-01). Cobertura focada em `planTierFromValue` (4 casos, `webhook.test.ts:15-35`).
- **Migration de `webhook_events`** está em `supabase/migration_fixes.sql:57-61` (arquivo de fixes), **não** na migration "oficial" `supabase/migrations/20260101000000_initial_schema.sql`. Risco de drift ao recriar o banco do zero — considerar consolidar.

## 10. Referências

### Arquivos-chave (escopo do setor)

- `src/lib/asaas/config.ts:1-36` — configuração, planos, env vars.
- `src/lib/asaas/client.ts:1-148` — cliente HTTP, customers, subscriptions, payments, PIX.
- `src/lib/asaas/checkout.ts:1-128` — orquestrador `processCheckout`.
- `src/lib/asaas/webhook.ts:1-58` — tipos, `verifyWebhookToken`, `planTierFromValue`.
- `src/lib/asaas/webhook.test.ts:1-36` — testes unitários (Vitest).
- `src/app/api/webhook/asaas/route.ts:1-228` — receiver + idempotência + dispatch.
- `src/app/api/checkout/subscribe/route.ts:1-131` — endpoint de criação de assinatura.
- `src/app/api/checkout/cancel/route.ts:1-70` — endpoint de cancelamento.

### Migrations

- `supabase/migration_fixes.sql:55-61` — `CREATE TABLE webhook_events`.
- `supabase/migrations/20260101000000_initial_schema.sql:37-38` — colunas `asaas_customer_id` (UNIQUE) e `asaas_subscription_id` em `profiles` (tabela documentada pelo setor Auth/Profile).

### Setores cruzados (não documentados aqui)

- **Loja / Planos** — UI `src/app/(app)/planos/subscribe-button.tsx` e fluxo completo de checkout client-side. → `../dominio/loja.md` (responsável: outro agente).
- **Estética** — `src/app/api/estetica/bookings/[id]/payment/route.ts:113` define `externalReference: estetica:<bookingId>`; tabela `estetica_bookings`. → `../dominio/estetica.md`.
- **Consultoria** — webhook `PAYMENT_CONFIRMED` cria registro em `consultations` para plano VIP. Tabela documentada em → `../dominio/consultoria.md`.
- **Auth / Profile** — campos `asaas_customer_id`, `asaas_subscription_id`, `plan_tier`, `subscription_status`, `subscription_ends_at` em `profiles`. → `../dominio/auth-profile.md`.
- **Notificações Push** — `notifyUser(...)` chamado pelos handlers do webhook. → `./notificacoes-push.md`.
- **Rate Limit** — `checkRateLimitAsync` em `src/lib/rate-limit.ts`. → `./rate-limit.md`.
- **Supabase Admin Client** — `createAdminSupabaseClient()` (bypass RLS) usado pelo webhook. → `./supabase.md`.
