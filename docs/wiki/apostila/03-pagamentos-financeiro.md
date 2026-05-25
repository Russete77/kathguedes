# Módulo 3 — Pagamentos (Asaas) & Modelo Financeiro

> **Apostila KathApp** — Versão 1.0 · 2026-05-22
> Stack: Next.js 15 · Supabase · Clerk · Asaas · Vercel

---

## Sumário

1. [Asaas: fundamentos e ambiente](#1-asaas-fundamentos-e-ambiente)
   - 1.1 Sandbox vs. Produção
   - 1.2 Autenticação via `access_token`
   - 1.3 Allowlist de IP e o erro `not_allowed_ip`
   - 1.4 Códigos HTTP: 401, 403 e 422
   - 1.5 CPF/CNPJ obrigatório no PIX
2. [Fluxos de Cobrança](#2-fluxos-de-cobrança)
   - 2.1 Assinatura recorrente (`POST /subscriptions`)
   - 2.2 Cobrança avulsa (`POST /payments`)
   - 2.3 PIX QR Code (`GET /payments/{id}/pixQrCode`)
   - 2.4 `processCheckout`: o orquestrador completo
3. [Webhooks Idempotentes](#3-webhooks-idempotentes)
   - 3.1 Verificação de autenticidade
   - 3.2 Deduplicação via `webhook_events`
   - 3.3 Collapso de `PAYMENT_CONFIRMED` + `PAYMENT_RECEIVED`
   - 3.4 Padrão R-A: liberar o claim em erro transitório
   - 3.5 Retornar 5xx para reentrega
4. [Erros Tipados: `AsaasApiError`](#4-erros-tipados-asaasapierror)
   - 4.1 Estrutura da classe
   - 4.2 Retry com backoff exponencial
   - 4.3 `handleApiError` e integração com Sentry
5. [Modelo Financeiro Normalizado](#5-modelo-financeiro-normalizado)
   - 5.1 `revenue_streams`: cada centavo que entra
   - 5.2 `wallet_credits` / `wallet_balance`: cashback FIFO
   - 5.3 `commission_rules` / `commission_allocations`
   - 5.4 Por que tudo converge para `revenue_streams`
6. [Pricing e Decisão no Servidor](#6-pricing-e-decisão-no-servidor)
   - 6.1 O cliente só envia IDs
   - 6.2 Clamp de cashback e a regra dos 50%
   - 6.3 Sinal (prepay) na estética
   - 6.4 Bug C3: cashback debitado antes do pagamento
7. [Diagrama do Fluxo de Pagamento](#7-diagrama-do-fluxo-de-pagamento)
8. [Exercícios](#8-exercícios)

---

## 1. Asaas: fundamentos e ambiente

### 1.1 Sandbox vs. Produção

O Asaas disponibiliza dois ambientes completamente independentes. Cada um tem sua própria base de dados, seus próprios clientes e seus próprios webhooks configurados separadamente no painel.

| Ambiente    | Base URL                          | Dados reais? |
|-------------|-----------------------------------|--------------|
| Sandbox     | `https://sandbox.asaas.com/api/v3`| Não          |
| Produção    | `https://api.asaas.com/v3`        | Sim          |

No KathApp, a escolha é feita pela variável de ambiente `ASAAS_ENV`:

**`src/lib/asaas/config.ts`**
```typescript
export const ASAAS_CONFIG = {
  apiKey: process.env.ASAAS_API_KEY ?? "",
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? "",
  baseUrl:
    process.env.ASAAS_ENV === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3",
  env: process.env.ASAAS_ENV === "production" ? "production" : "sandbox",
} as const;
```

A lógica é deliberadamente defensiva: qualquer valor de `ASAAS_ENV` diferente de `"production"` cai no sandbox. Isso evita o pior dos erros de configuração — cobrar um cliente real em ambiente de desenvolvimento.

> **Variáveis de ambiente necessárias:**
> - `ASAAS_API_KEY` — chave de API (sandbox ou produção, dependendo do ambiente).
> - `ASAAS_WEBHOOK_TOKEN` — token secreto para validar webhooks recebidos.
> - `ASAAS_ENV` — `"production"` ou qualquer outra string (sandbox).

### 1.2 Autenticação via `access_token`

Toda requisição ao Asaas exige o header `access_token` com a chave de API do ambiente. O Asaas não usa Bearer Token (padrão OAuth) — o header chama-se literalmente `access_token`.

**`src/lib/asaas/client.ts` — linha 53**
```typescript
headers: {
  "Content-Type": "application/json",
  access_token: ASAAS_CONFIG.apiKey,
},
```

Se esse header estiver ausente, mal-formado ou usar a chave do ambiente errado, o Asaas retorna **401 Unauthorized**.

### 1.3 Allowlist de IP e o erro `not_allowed_ip`

O Asaas em produção exige que os IPs de origem das chamadas à API estejam cadastrados no painel. Se uma chamada chega de um IP não cadastrado, o Asaas retorna:

```json
{
  "errors": [
    {
      "code": "not_allowed_ip",
      "description": "IP 203.0.113.42 not allowed"
    }
  ]
}
```

Esse erro travou o projeto em um momento do desenvolvimento: a Vercel usa IPs dinâmicos em suas Serverless Functions, e esses IPs não estavam na allowlist do Asaas. A solução é cadastrar os ranges de IP da Vercel (disponíveis em `https://vercel.com/docs/edge-network/regions`) ou usar o recurso de **egress estático** (IPs fixos) da Vercel Pro.

Em sandbox, a restrição de IP não existe — por isso o erro só aparece quando a aplicação sobe para produção.

### 1.4 Códigos HTTP: 401, 403 e 422

Entender a semântica dos códigos HTTP do Asaas é essencial para exibir mensagens úteis ao usuário:

| Código | Significado no Asaas                                                          | O que fazer                          |
|--------|-------------------------------------------------------------------------------|--------------------------------------|
| **401**| `access_token` ausente ou inválido (chave errada ou ambiente errado).         | Checar `ASAAS_API_KEY` e `ASAAS_ENV`.|
| **403**| Operação proibida (ex.: tentar acessar um recurso que não pertence à conta).  | Checar permissões do usuário Asaas.  |
| **422**| Dados do cliente inválidos — CPF malformado, e-mail duplicado, valor zero, etc. O body tem `errors[0].description` com a causa exata. | Expor a causa ao usuário; não retentar. |
| **5xx**| Indisponibilidade do provedor.                                                | Retry com backoff; retornar 502/503. |

O KathApp mapeia esses códigos em `AsaasApiError` (seção 4) para que cada camada saiba exatamente o que aconteceu, sem precisar parsear strings de erro.

### 1.5 CPF/CNPJ obrigatório no PIX

O PIX, por regulamentação do Banco Central, exige a identificação completa do pagador. O Asaas propaga essa exigência: sem CPF ou CNPJ vinculado ao customer, a geração do QR Code PIX falha com 422.

O KathApp coleta o CPF no momento do checkout e o armazena em `profiles.cpf`. Se o usuário já tem um customer no Asaas mas o CPF não estava preenchido (caso de usuários criados antes dessa exigência ser implementada), o `processCheckout` faz um `PUT /customers/:id` idempotente para garantir que o customer Asaas está atualizado.

**`src/lib/asaas/checkout.ts` — linha 77**
```typescript
// Customer ja existe — garantir IDEMPOTENTEMENTE que tem CPF correto.
// Sempre fazemos PUT, sem condicional, porque profile.cpf no Supabase
// pode estar dessincronizado do customer no Asaas (caso classico: profile
// foi atualizado em tentativa anterior mas o PUT no Asaas falhou).
await updateCustomer(customerId, { name: fullName, email, cpfCnpj });
```

> **Armadilha:** Tentar criar o QR Code sem CPF no customer gera um 422 com `"CPF/CNPJ is required for PIX transactions"`. O erro é correto mas pode ser confuso em testes — verifique sempre se o customer tem CPF antes de tentar PIX.

---

## 2. Fluxos de Cobrança

O KathApp usa dois modelos de cobrança distintos dependendo do contexto:

| Modelo             | Endpoint Asaas        | Usado em                       |
|--------------------|-----------------------|-------------------------------|
| Assinatura recorrente | `POST /subscriptions` | Planos mensais (mensalidade)  |
| Cobrança avulsa    | `POST /payments`      | Loja, Kath Estética (PIX)     |

### 2.1 Assinatura recorrente (`POST /subscriptions`)

Uma subscription no Asaas é um acordo de cobrança periódica. Ao ser criada, o Asaas automaticamente gera o **primeiro pagamento** e o disponibiliza em `GET /subscriptions/{id}/payments`.

Parâmetros mínimos:
```typescript
interface CreateSubscriptionParams {
  customer: string;        // ID do customer no Asaas
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
  value: number;           // valor em reais (ex.: 39.90)
  nextDueDate: string;     // YYYY-MM-DD: data do primeiro vencimento
  cycle: "MONTHLY";        // renovação mensal
  description: string;     // texto da fatura
  externalReference?: string; // userId do Clerk — liga o pagamento ao perfil
}
```

O `externalReference` é o identificador que o webhook usa para encontrar o usuário. Sem ele, um pagamento confirmado chega sem contexto e não pode atualizar o `plan_tier`.

**`src/lib/asaas/checkout.ts` — linhas 93-106**
```typescript
const subscription = await createSubscription({
  customer: customerId,
  billingType,
  value: planRow.asaas_value,     // valor vem da tabela `plans`, nunca do cliente
  nextDueDate,
  cycle: "MONTHLY",
  description: planRow.asaas_description,
  externalReference: userId,      // Clerk user ID
});
```

> **Importante:** O `plan_tier` do usuário **não é ativado aqui**. Ele só é ativado quando o webhook `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` chega (ver seção 3). O checkout apenas cria a subscription e devolve a URL de pagamento.

### 2.2 Cobrança avulsa (`POST /payments`)

Para compras da loja ou agendamentos da estética, usa-se uma cobrança avulsa — sem recorrência.

**`src/lib/asaas/client.ts` — linha 220**
```typescript
export async function createPayment(
  params: CreatePaymentParams,
): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>("/payments", "POST", params);
}
```

Na loja, o fluxo é dividido em dois passos separados (duas rotas):
1. `POST /api/loja/checkout` — valida itens, calcula preços, cria o pedido no Supabase com `status: "pending"`.
2. `POST /api/loja/payment` — cria a cobrança PIX no Asaas e devolve o QR Code.

Essa separação é intencional: o pedido precisa existir no banco antes de criar a cobrança, para que o `externalReference` já aponte para um `order.id` válido quando o webhook chegar.

**`src/app/api/loja/payment/route.ts` — linhas 165-172**
```typescript
payment = await createPayment({
  customer: customerId,
  billingType: "PIX",
  value: totalReais,
  dueDate: dueDateStr,
  description: `Pedido KathApp Loja #${orderId.substring(0, 8).toUpperCase()}`,
  externalReference: orderId,
});
```

### 2.3 PIX QR Code (`GET /payments/{id}/pixQrCode`)

Após criar o pagamento (subscription ou avulso com billingType `PIX`), é necessário buscar o QR Code:

**`src/lib/asaas/client.ts` — linha 242**
```typescript
export async function getPaymentPixQrCode(
  paymentId: string
): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
  return asaasRequest(`/payments/${paymentId}/pixQrCode`);
}
```

Retorna:
- `encodedImage`: imagem do QR Code em base64 (para renderizar como `<img src="data:image/png;base64,...">`)
- `payload`: string do "copia e cola" do PIX
- `expirationDate`: data/hora de expiração do QR Code

No checkout de planos, existe um `await new Promise(r => setTimeout(r, 1500))` antes de buscar o pagamento gerado pela subscription. Isso se deve ao fato de o Asaas processar a geração do primeiro pagamento de forma assíncrona — não está disponível instantaneamente após o `POST /subscriptions`.

### 2.4 `processCheckout`: o orquestrador completo

A função `processCheckout` em `src/lib/asaas/checkout.ts` encapsula todo o fluxo de checkout de planos em cinco passos:

```
processCheckout(params)
  │
  ├─ 1. getPlan(plan)               → valida plano ativo e busca asaas_value
  │
  ├─ 2a. createCustomer(...)        → se não tem asaas_customer_id no profile
  │   ou
  │  2b. updateCustomer(...)        → idempotente: garante CPF atualizado
  │
  ├─ 3. createSubscription(...)     → cria assinatura mensal no Asaas
  │
  ├─ 4. UPDATE profiles             → salva asaas_subscription_id
  │
  └─ 5. getSubscriptionPayments     → busca invoiceUrl + pixQrCode (se PIX)
```

O plano **não é ativado aqui** — é ativado pelo webhook.

---

## 3. Webhooks Idempotentes

O webhook é o coração do sistema de pagamentos. Qualquer falha aqui resulta em usuários sem acesso ao plano pago, cashback não creditado, ou comissões não calculadas. Por isso, a implementação precisa ser robusta contra duplicação, falhas transitórias e ataques de falsificação.

### 3.1 Verificação de autenticidade

O Asaas envia um header `asaas-access-token` em cada chamada de webhook. O KathApp verifica esse token comparando com `ASAAS_WEBHOOK_TOKEN` usando `timingSafeEqual` do módulo nativo `crypto`:

**`src/lib/asaas/webhook.ts` — linha 37**
```typescript
export function verifyWebhookToken(headerToken: string | null): boolean {
  if (!ASAAS_CONFIG.webhookToken) {
    console.error("[webhook] ASAAS_WEBHOOK_TOKEN not configured");
    return false;
  }
  if (!headerToken) return false;

  const a = Buffer.from(headerToken);
  const b = Buffer.from(ASAAS_CONFIG.webhookToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

A comparação com `timingSafeEqual` é necessária para evitar **timing attacks**: uma comparação ingênua (`===`) pode vazar informação sobre o token real através do tempo de resposta (caracteres corretos no início tornam a comparação mais lenta). O `timingSafeEqual` sempre leva o mesmo tempo independentemente de quantos caracteres coincidem.

Se o token não bater, a rota retorna 401 imediatamente:

**`src/app/api/webhook/asaas/route.ts` — linha 29**
```typescript
const token = req.headers.get("asaas-access-token");
if (!verifyWebhookToken(token)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 3.2 Deduplicação via `webhook_events`

O Asaas pode entregar o mesmo evento mais de uma vez (rede instável, timeout de resposta, reinicializações). Sem deduplicação, um único pagamento poderia creditar cashback duas vezes, gerar revenue_stream duplicado e ativar o plano múltiplas vezes.

A tabela `webhook_events` age como um registro de eventos já processados:

```sql
-- Estrutura conceitual (criada no schema.sql principal)
create table webhook_events (
  payment_id text primary key,  -- chave de idempotência
  event      text not null,
  created_at timestamptz not null default now()
);
```

O `INSERT` atômico garante que apenas um processamento ocorre:

**`src/app/api/webhook/asaas/route.ts` — linha 56**
```typescript
const { error: insertError } = await supabase
  .from("webhook_events")
  .insert({ payment_id: idempotencyKey, event });

if (insertError) {
  if (insertError.code === "23505") {   // unique violation
    return NextResponse.json({ received: true, duplicate: true });
  }
  return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
}
```

O código `23505` é o código PostgreSQL para violação de constraint UNIQUE. Se esse INSERT falhar por duplicação, o evento já foi processado e podemos retornar 200 com segurança.

### 3.3 Collapso de `PAYMENT_CONFIRMED` + `PAYMENT_RECEIVED`

O Asaas dispara dois eventos distintos para o mesmo "dinheiro entrou":
- `PAYMENT_CONFIRMED`: quando a cobrança é confirmada (PIX aprovado, boleto compensado).
- `PAYMENT_RECEIVED`: quando o valor está disponível para saque.

Se tratados independentemente, os dois eventos causariam cashback em dobro, revenue_stream duplicado e comissões duplicadas. A solução é **colapsar os dois em uma mesma chave de idempotência**:

**`src/app/api/webhook/asaas/route.ts` — linhas 54-55**
```typescript
const isPositive = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
const idempotencyKey = isPositive
  ? `${payment.id}:paid`       // ambos usam a mesma chave
  : `${payment.id}:${event}`;  // outros eventos: chave individual
```

O primeiro dos dois eventos a chegar grava `payment123:paid` na tabela. Quando o segundo chega, o INSERT falha com 23505 e é descartado silenciosamente.

> **Armadilha:** Antes desse collapso, o KathApp tinha um bug onde o cashback da mensalidade era creditado duas vezes — uma vez por `PAYMENT_CONFIRMED` e outra por `PAYMENT_RECEIVED`. O valor de cashback aparecia incorreto no extrato do usuário.

### 3.4 Padrão R-A: liberar o claim em erro transitório

Este é o padrão mais sofisticado do sistema de webhooks. O problema: e se o INSERT na `webhook_events` for bem-sucedido (o evento é "reivindicado"), mas o handler falhar na metade do processamento? Por exemplo:
- O `revenue_stream` é criado.
- O `creditWalletCents` falha por timeout.
- O cashback não é creditado.
- O Asaas não vai retentar porque o webhook já retornou 200.

O padrão R-A resolve isso: **em caso de erro no handler, deletar o registro da `webhook_events`**, liberando o evento para ser reentregue pelo Asaas.

**`src/app/api/webhook/asaas/route.ts` — linhas 164-181**
```typescript
try {
  if (ref.type === "estetica") {
    await handleEsteticaPayment(supabase, payment, ref.reference_id);
  } else if (ref.type === "loja") {
    await handleLojaPayment(supabase, payment, ref.reference_id);
  } else {
    await handleMensalidadePayment(supabase, payment, ref.reference_id);
  }
} catch (handlerErr) {
  // R-A: libera o claim de idempotência para o Asaas reentregar e reprocessar.
  // As operações de dinheiro são idempotentes (revenue único por asaas_payment_id,
  // cashback checado por stream, compute_commissions on-conflict), então
  // reprocessar não duplica. Sem isto, um erro transitório deixaria o
  // pagamento "pago mas não processado por completo".
  await supabase.from("webhook_events").delete().eq("payment_id", idempotencyKey);
  throw handlerErr;
}
```

Para que isso seja seguro, **todas as operações do handler precisam ser idempotentes**. Se o evento for reentregue e o handler rodar novamente, não podem ocorrer duplicações. No KathApp:
- `recordRevenueStream` usa `ON CONFLICT` em `asaas_payment_id` — reusa o stream existente.
- `creditWalletCents` checa se já existe crédito vinculado ao `source_revenue_stream_id`.
- `spendWalletCents` checa se já existe gasto vinculado ao `revenue_stream_id`.
- `compute_commissions` usa `ON CONFLICT DO NOTHING` nas allocations.

### 3.5 Retornar 5xx para reentrega

O fluxo de catch externo retorna 500, não 200:

**`src/app/api/webhook/asaas/route.ts` — linhas 184-187**
```typescript
} catch (err) {
  // Em erro: retornar 5xx para Asaas reentregar
  return handleApiError(err, "POST /api/webhook/asaas");
}
```

`handleApiError` retorna `{ status: 500 }`. O Asaas interpreta qualquer resposta não-2xx como falha e reagendará a entrega do evento. Retornar 200 em erro é um **anti-pattern proibido** — silencia o problema e garante que o pagamento nunca será processado.

---

## 4. Erros Tipados: `AsaasApiError`

### 4.1 Estrutura da classe

**`src/lib/asaas/client.ts` — linhas 20-31**
```typescript
export class AsaasApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`Asaas API error ${status}: ${JSON.stringify(body)}`);
    this.name = "AsaasApiError";
  }

  get description(): string | null {
    const b = this.body as { errors?: Array<{ description?: string }> } | null;
    return b?.errors?.[0]?.description ?? null;
  }
}
```

A classe carrega:
- `status`: o código HTTP (401, 422, 503, etc.).
- `body`: o corpo completo da resposta do Asaas (para log/auditoria).
- `description`: o getter conveniente que extrai `errors[0].description` — a mensagem legível pelo usuário que o Asaas inclui em erros 4xx.

Sem essa classe, um erro de CPF inválido chegaria ao usuário como um genérico `"Internal server error"`. Com ela:

**`src/app/api/checkout/subscribe/route.ts` — linhas 165-178**
```typescript
if (err instanceof AsaasApiError) {
  handleApiError(err, "POST /api/checkout/subscribe (asaas)"); // loga para Sentry
  if (err.status >= 400 && err.status < 500) {
    return NextResponse.json(
      {
        error: "payment_validation",
        message:
          err.description ??
          "Dados de pagamento recusados. Confira o CPF/CNPJ informado.",
      },
      { status: 422 },
    );
  }
  // 5xx = indisponibilidade do provedor
  return NextResponse.json(
    { error: "payment_provider_error", message: "..." },
    { status: 502 },
  );
}
```

A lógica é: erros 4xx do Asaas são causados pelos dados do usuário (CPF inválido, e-mail, etc.) e devem ser exibidos como mensagem acionável. Erros 5xx são falhas do provedor e devem retornar 502/503 — "tente novamente em instantes".

### 4.2 Retry com backoff exponencial

A função interna `asaasRequest` implementa 3 tentativas com backoff exponencial para erros de rede e 5xx:

**`src/lib/asaas/client.ts` — linhas 40-93**
```typescript
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  // ...
  if (res.status >= 400 && res.status < 500) {
    // 4xx — não retentar (erro do cliente, retry só piora)
    const err = await res.json().catch(() => ({}));
    throw new AsaasApiError(res.status, err);
  }

  // 5xx — backoff e retentar
  lastError = new AsaasApiError(res.status, errBody);
  if (attempt < MAX_ATTEMPTS) {
    await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1)); // 250ms, 500ms
    continue;
  }
  throw lastError;
}
```

Tentativas: backoff de 250 ms na primeira, 500 ms na segunda. Erros 4xx não retentam nunca — eles representam dados incorretos enviados pelo cliente, e tentar novamente com os mesmos dados só geraria mais erros.

### 4.3 `handleApiError` e integração com Sentry

**`src/lib/api-error.ts`** centraliza o tratamento de erros não-esperados de todas as rotas:

```typescript
export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";

  // Log estruturado para Vercel (stdout → logs)
  console.error(JSON.stringify({
    level: "error",
    context,
    message,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  }));

  // Sentry: carga dinâmica para não quebrar build se @sentry/nextjs não estiver instalado
  loadSentry().then((capture) => {
    if (capture) capture(error, { extra: { context } });
  }).catch(() => {});

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

O import dinâmico do Sentry usa um trick de concatenação de string (`["@sentry", "nextjs"].join("/")`) para que o webpack/turbopack não emita warnings caso o pacote não esteja instalado. Em produção, quando `SENTRY_DSN` está definida e `@sentry/nextjs` está nas dependências, o erro é capturado automaticamente.

---

## 5. Modelo Financeiro Normalizado

O modelo financeiro do KathApp foi desenhado para resolver um problema comum em aplicações com múltiplos módulos de receita: **como manter uma visão unificada do dinheiro sem criar silos por feature?**

A resposta é a tabela `revenue_streams` como ponto de convergência de toda receita, e tabelas satélite para cashback (`wallet_credits`, `wallet_balance`) e comissões (`commission_rules`, `commission_allocations`).

### 5.1 `revenue_streams`: cada centavo que entra

**`supabase/migration_modelo_financeiro.sql` — linha 181**
```sql
create table if not exists public.revenue_streams (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null
    check (type in ('mensalidade','loja','estetica','afiliado_externo')),
  category            text,               -- ex.: 'plano3', 'signal', módulo da loja
  user_id             text references public.profiles(id),
  reference_type      text not null
    check (reference_type in ('subscription','order','booking','affiliate_payout')),
  reference_id        text not null,      -- ID do pedido/booking/subscription
  asaas_payment_id    text,               -- para deduplicação por pagamento
  gross_cents         int  not null,      -- receita bruta (inclui cashback usado)
  cost_cents          int  not null,      -- custo do produto/serviço
  net_cents           int  GENERATED ALWAYS AS (gross_cents - cost_cents) STORED,
  cashback_used_cents int  not null,      -- desconto por cashback neste stream
  status              text not null default 'confirmed',
  occurred_at         timestamptz not null,
  created_at          timestamptz not null default now()
);
```

O campo `net_cents` é uma **coluna gerada** pelo Postgres: `gross_cents - cost_cents`. Nunca é escrito pela aplicação — o banco mantém automaticamente.

O campo `gross_cents` inclui o cashback usado pelo cliente:
```
gross_cents = valor_pago_em_dinheiro + cashback_usado
```

Isso garante que o revenue_stream reflete o valor "real" da transação para fins de cálculo de comissões (o sócio recebe comissão sobre o valor do serviço, não sobre o quanto saiu do bolso do cliente).

**`src/lib/billing/revenue.ts` — linha 31**
```typescript
export async function recordRevenueStream(input: RecordRevenueInput): Promise<RevenueStream> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("revenue_streams")
    .insert({ ...input, status: "confirmed" })
    .select()
    .single();

  // Idempotência (R-A): se já existe stream para este asaas_payment_id,
  // reusa o existente em vez de duplicar receita.
  if (!data && error?.code === "23505" && input.asaas_payment_id) {
    const { data: existing } = await supabase
      .from("revenue_streams")
      .select()
      .eq("asaas_payment_id", input.asaas_payment_id)
      .single();
    stream = existing;
  }

  // Dispara compute_commissions — idempotente (on conflict do nothing)
  await supabase.rpc("compute_commissions", { p_revenue_stream_id: stream.id });

  return stream;
}
```

### 5.2 `wallet_credits` / `wallet_balance`: cashback FIFO

O cashback é implementado como uma carteira de créditos com expiração. Cada crédito tem:
- `amount_cents`: saldo em centavos.
- `expires_at`: data de expiração (padrão: 120 dias).
- `source_revenue_stream_id`: de qual pagamento veio (para auditoria e idempotência).
- `spent_on_revenue_stream_id`: em qual compra foi usado (quando gasto).

A tabela `wallet_balance` é um **agregado desnormalizado** mantido por triggers implícitos nas RPCs `credit_wallet_cents` e `spend_wallet_cents`. Ela existe para leituras rápidas do saldo ativo sem precisar somar todos os créditos a cada requisição.

**Algoritmo FIFO em `spend_wallet_cents` (SQL):**

```sql
create or replace function public.spend_wallet_cents(
  p_user_id text,
  p_amount_cents int,
  p_revenue_stream_id uuid default null
) returns int language plpgsql security definer as $$
declare
  v_remaining int := p_amount_cents;
  v_credit record;
begin
  for v_credit in
    select id, amount_cents
    from public.wallet_credits
    where user_id = p_user_id
      and used_at is null
      and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, created_at asc  -- créditos mais antigos primeiro
    for update  -- lock pessimista para evitar race condition
  loop
    exit when v_remaining <= 0;
    -- gasta este crédito (total ou parcial) e segue para o próximo...
  end loop;
  -- atualiza wallet_balance atomicamente
  ...
end;
$$;
```

O `FOR UPDATE` garante que dois checkouts simultâneos do mesmo usuário não gastem o mesmo saldo duas vezes (race condition de duplo gasto). O Postgres serializa as transações pelo lock na linha.

**Idempotência do gasto (TypeScript):**

**`src/lib/billing/wallet.ts` — linhas 49-57**
```typescript
if (args.revenueStreamId) {
  const { data: already } = await supabase
    .from("wallet_credits")
    .select("id")
    .eq("spent_on_revenue_stream_id", args.revenueStreamId)
    .limit(1)
    .maybeSingle();
  if (already) return 0;  // já gastou para este stream — idempotente
}
```

### 5.3 `commission_rules` / `commission_allocations`

O modelo de comissões é baseado em regras configuráveis por membro da equipe:

```
team_members (Kath, Russo, Sidney)
    │
    ├── commission_rules (por tipo e categoria de receita, com % e período)
    │        │
    │        └── applies_to: mensalidade/loja/estetica
    │             applies_to_category: plano3, atleta, etc.
    │             pct: 25, 30, etc.
    │
    └── commission_allocations (por revenue_stream, status: draft→approved→paid)
```

A RPC `compute_commissions` é chamada toda vez que um `revenue_stream` é registrado. Ela:
1. Busca as `commission_rules` ativas que se aplicam ao tipo/categoria do stream.
2. Calcula o `amount_cents` proporcional ao `net_cents` do stream.
3. Insere na `commission_allocations` com `ON CONFLICT DO NOTHING` (idempotente).
4. Calcula o resíduo para o owner (Kath): `net_cents - soma_das_comissoes - cashback_usado`.

**`supabase/migration_modelo_financeiro.sql` — linhas 577-603**
```sql
-- owner recebe o resíduo após comissões dos parceiros e cashback
v_owner_amount := v_stream.net_cents - v_explicit_total - v_stream.cashback_used_cents;
insert into public.commission_allocations
  (revenue_stream_id, team_member_id, pct, amount_cents)
values
  (p_revenue_stream_id, v_owner_id, v_owner_pct, v_owner_amount)
on conflict (revenue_stream_id, team_member_id) do nothing;
```

O ciclo de vida de uma allocation: `draft` (calculada automaticamente) → `approved` (admin confirma) → `paid` (Pix enviado, referência registrada). Em caso de estorno: `failed`.

### 5.4 Por que tudo converge para `revenue_streams`

Antes do modelo normalizado, cada módulo (loja, estética, planos) tinha sua própria lógica de "dinheiro entrou" espalhada em diferentes tabelas e server actions. Isso criava problemas:
- Comissões calculadas de formas diferentes por módulo.
- Cashback creditado com lógicas divergentes.
- Relatórios financeiros impossíveis de consolidar.

Com `revenue_streams` como ponto central:
- **Uma linha por pagamento confirmado**, independente do módulo.
- `compute_commissions` é chamado uma vez por stream — não por módulo.
- O dashboard financeiro do admin consulta apenas `revenue_streams`.
- Estornos invalidam o stream e todas as allocations derivadas automaticamente.

```
Pagamento confirmado (webhook)
           │
           ▼
    recordRevenueStream()           ← uma chamada, toda receita
           │
           ├── INSERT revenue_streams (net_cents gerado pelo DB)
           │
           └── compute_commissions()  ← uma chamada, todas as allocations
                      │
                      ├── INSERT commission_allocations (Russo: 25%)
                      ├── INSERT commission_allocations (Sidney: 30%)
                      └── INSERT commission_allocations (Kath: resíduo)
```

---

## 6. Pricing e Decisão no Servidor

### 6.1 O cliente só envia IDs

Esta é uma das regras inegociáveis do KathApp: **o cliente nunca envia preços, descontos ou percentuais**. Ele envia apenas identificadores (IDs de produto, slug de plano, método de pagamento), e o servidor recalcula tudo.

**Por que isso importa?** Em uma implementação ingênua onde o cliente envia o preço final, um usuário mal-intencionado pode manipular a requisição para pagar R$ 0,01 por um produto de R$ 399. O Asaas processaria normalmente — ele não sabe o "preço correto", apenas cobra o valor recebido.

**Fluxo correto no KathApp:**

```
Cliente envia:
  { items: [{ product_id: "uuid", quantity: 2 }], use_cashback_cents: 500 }

Servidor (POST /api/loja/checkout) faz:
  1. SELECT products WHERE id IN (...) → price_cents real do banco
  2. SELECT profiles.plan_tier WHERE id = userId
  3. getStoreDiscountPct(planTier) → desconto % da tabela plans
  4. finalPrice = price_cents * (100 - discountPct) / 100
  5. clampCashbackCents({ requested: 500, gross: ..., activeBalance: ... })
  6. totalCents = grossCents - cashbackUsedCents
  7. INSERT orders com total_cents calculado no servidor
```

O cliente nunca "propõe" o preço — apenas informa o que quer comprar.

**O mesmo padrão na estética** (`src/app/api/estetica/bookings/route.ts` — linhas 134-169):
```typescript
// Busca preço da matriz no servidor (por vehicle_type_id)
const pricing = await getServicePricing(service.id);
const basePriceCents = pricingOption?.price_cents ?? service.price_cents;

// Desconto do plano calculado no servidor
const discountPct = await getEsteticaDiscountPct(planTier);
const finalCents = finalPriceCents(baseServiceForDiscount, discountPct);
```

E no checkout de planos (`src/app/api/checkout/subscribe/route.ts` — linha 62):
```typescript
// Valida que o slug de plano é real e ativo
const activePlans = await getActivePlans();
const validPaidSlugs = activePlans
  .filter(p => p.slug !== "free" && p.asaas_value > 0)
  .map(p => p.slug);
const matched = validPaidSlugs.find(slug => slug === plan);
if (!matched) {
  return NextResponse.json({ error: "Plano invalido" }, { status: 400 });
}
// O valor para o Asaas vem da tabela plans, não do cliente:
// planRow.asaas_value → nunca req.body.price
```

> **Armadilha:** Nunca use `req.body.price` ou qualquer valor financeiro vindo do cliente para criar cobranças. Use sempre IDs para buscar os valores no banco.

### 6.2 Clamp de cashback e a regra dos 50%

O cashback tem duas restrições que protegem a margem:
1. **Máximo 50% do valor bruto**: evita que o cliente zere o pagamento em compras grandes usando cashback acumulado.
2. **Máximo saldo ativo**: não pode usar mais do que tem.

**`src/lib/billing/cashback-utils.ts`**
```typescript
export function clampCashbackCents(input: ClampInput): number {
  if (!Number.isFinite(input.requested) || input.requested <= 0) return 0;
  if (!Number.isFinite(input.gross) || input.gross <= 0) return 0;
  if (!Number.isFinite(input.activeBalance) || input.activeBalance <= 0) return 0;

  const halfGross = Math.floor(input.gross * 0.5);  // regra dos 50%
  return Math.min(input.requested, halfGross, input.activeBalance);
}
```

Exemplo: produto de R$ 100,00 (10000 centavos), saldo de R$ 80,00. O cliente pede R$ 80,00 de cashback.
- `halfGross` = 5000 centavos (50% de 10000).
- `Math.min(8000, 5000, 8000)` = 5000 centavos.
- Cashback usado: R$ 50,00. Valor pago: R$ 50,00.

O clamp acontece no servidor — mesmo que o cliente manipule o campo `use_cashback_cents`, o servidor nunca aplica mais do que o permitido.

### 6.3 Sinal (prepay) na estética

Alguns serviços da estética (como vitrificação) exigem um sinal antecipado pelo app. O valor do sinal é determinado pela tabela `estetica_service_pricing_rules` (campo `prepay_pct`), não pelo cliente.

**`src/app/api/estetica/bookings/route.ts` — linhas 172-180**
```typescript
const rule = pricing.payment_rule;
let prepayCents = 0;
if (totalCents > 0 && rule && rule.require_app_prepay && rule.prepay_pct > 0) {
  const pct = Math.min(100, Math.max(0, rule.prepay_pct));  // clamp 0-100
  prepayCents = Math.min(totalCents, Math.round((totalCents * pct) / 100));
}
const remainingCents = totalCents - prepayCents;
```

O booking é criado com:
- `prepay_cents`: valor do sinal gerado no PIX.
- `remaining_cents`: valor pago presencialmente na entrega.
- `prepay_paid_at`: preenchido pelo webhook quando o sinal for confirmado.
- `paid_at`: preenchido quando o pagamento integral for confirmado.

O webhook distingue os dois momentos pelo valor recebido:

**`src/app/api/webhook/asaas/route.ts` — linhas 232-238**
```typescript
const isSignalPayment =
  prepayCents > 0 &&
  !booking.prepay_paid_at &&
  Math.abs(receivedCents - prepayCents) <= 1 &&  // margem de 1 centavo
  remainingAfterSignal > 0;
```

### 6.4 Bug C3: cashback debitado antes do pagamento

> **Esta seção documenta um bug real que foi corrigido.**

**O bug:** O saldo de cashback do usuário era debitado no momento da criação do booking/pedido (status `pending`), não no momento da confirmação do pagamento.

**O problema:** Se o usuário cria um booking mas abandona o pagamento (não paga o PIX dentro do prazo), o cashback fica bloqueado para sempre — o booking fica `pending`, nunca é confirmado, o cashback nunca é devolvido.

**A correção (C3):** Debitar o cashback apenas na confirmação do pagamento, dentro do handler do webhook.

**`src/app/api/estetica/bookings/route.ts` — linhas 222-236** (comentário no código):
```typescript
// C3: o cashback de um booking `pending` (aguardando sinal/pagamento) e
// debitado so na confirmacao do pagamento (handleEsteticaPayment), de forma
// idempotente — adiar evita queimar o saldo de um sinal nunca pago.
// EXCECAO: quando o cashback cobre 100% (totalCents === 0) o booking ja nasce
// confirmado/pago e NAO havera webhook, entao debitamos agora.
if (totalCents === 0 && cashbackUsedCents > 0) {
  await spendWalletCents({ userId, amountCents: cashbackUsedCents });
}
```

A exceção é necessária: quando o cashback cobre 100% do valor, não haverá pagamento Asaas e portanto não haverá webhook. Nesses casos, o booking nasce já `confirmed` e o cashback deve ser debitado imediatamente.

O mesmo padrão existe na loja (`src/app/api/loja/checkout/route.ts` — linha 217):
```typescript
// C3: o pedido nasce `pending`; um PIX abandonado nunca seria pago, e gastar
// o saldo agora o queimaria para sempre sem estorno.
if (cashbackUsedCents > 0 && totalCents === 0) {
  await spendWalletCents({ userId, amountCents: cashbackUsedCents });
}
```

---

## 7. Diagrama do Fluxo de Pagamento

### 7.1 Fluxo de mensalidade (plano)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CLIENTE (browser)                                                       │
│  POST /api/checkout/subscribe                                            │
│  { plan: "plano3", billingType: "PIX", cpfCnpj: "..." }                 │
└─────────────────────────────────────────────────────────────────────────┘
                           │ auth() — Clerk JWT
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SERVIDOR (Next.js Route Handler)                                        │
│                                                                          │
│  1. checkRateLimitAsync(userId) — 5 req/min por usuário                 │
│  2. getActivePlans() → valida slug "plano3", pega asaas_value = 99.90   │
│  3. SELECT profiles.cpf → CPF do usuário (obrigatório)                  │
│  4. processCheckout():                                                   │
│     a. createCustomer (ou updateCustomer se já existe)  ──► Asaas API   │
│     b. createSubscription(value=99.90, cycle=MONTHLY)   ──► Asaas API   │
│     c. UPDATE profiles.asaas_subscription_id                            │
│     d. sleep(1500ms) — Asaas gera o 1º pagamento                        │
│     e. getSubscriptionPayments() ──► Asaas API                          │
│     f. getPaymentPixQrCode(paymentId) ──► Asaas API                     │
│                                                                          │
│  Retorna: { invoiceUrl, pixQrCode, pixPayload, subscriptionId }         │
└─────────────────────────────────────────────────────────────────────────┘
                           │ usuário paga o PIX
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ASAAS (webhook)                                                         │
│  POST /api/webhook/asaas                                                 │
│  { event: "PAYMENT_CONFIRMED", payment: { id, value: 99.90, ... } }     │
└─────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SERVIDOR (Webhook Handler)                                              │
│                                                                          │
│  1. verifyWebhookToken(asaas-access-token) — timingSafeEqual            │
│  2. INSERT webhook_events({ payment_id: "pay123:paid" })                │
│     → se 23505 (dup): return 200 { duplicate: true }                    │
│  3. parseExternalReference → type: "mensalidade", userId: "clerk_xxx"   │
│  4. handleMensalidadePayment():                                          │
│     a. planTierFromValue(99.90) → "plano3"                              │
│     b. UPDATE profiles.plan_tier = "plano3", subscription_status="active"│
│     c. recordRevenueStream(type="mensalidade", gross=9990, cost=0)      │
│     d. compute_commissions(stream.id) → allocations para Russo/Sidney   │
│     e. getCashbackPct("plano3") → 7%                                    │
│     f. creditWalletCents(userId, 699 centavos, stream.id)               │
│     g. ensureConsultationForTier() → cria consultoria se necessário     │
│     h. notifyUser() → push notification "Plano PLANO3 ativo!"           │
│  5. return 200 { received: true }                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Fluxo de compra na loja

```
Cliente → POST /api/loja/checkout
              │ valida itens, calcula preço, cria order (pending), retorna orderId
              ▼
         POST /api/loja/payment
              │ cria PIX avulso no Asaas, salva asaas_payment_id no order
              ▼
         [usuário paga o PIX]
              ▼
         Asaas → POST /api/webhook/asaas
              │ handleLojaPayment(orderId)
              │   UPDATE orders.status = "paid"
              │   recordRevenueStream(type="loja")
              │   compute_commissions()
              │   spendWalletCents() ← cashback debitado AQUI (C3)
              │   notifyUser()
              └─► return 200
```

### 7.3 Fluxo com sinal (estética)

```
Cliente → POST /api/estetica/bookings
              │ calcula total (ex: R$200), sinal 50% = R$100
              │ INSERT booking { status:"pending", prepay_cents:10000 }
              │ retorna { prepay_cents:10000, requires_prepay:true }
              ▼
         [usuário paga o sinal via PIX - R$100]
              ▼
         Asaas → POST /api/webhook/asaas
              │ recebido R$100 ≈ prepay_cents → isSignalPayment=true
              │ UPDATE booking.prepay_paid_at = now(), status = "confirmed"
              │ recordRevenueStream(category:"signal", gross:10000)
              │ spendWalletCents() ← cashback debitado AQUI (C3)
              ▼
         [serviço executado, admin marca restante como pago presencialmente]
```

---

## 8. Exercícios

### Exercício 1 — Configuração de ambiente

**Cenário:** O checkout de planos funciona em desenvolvimento mas retorna erro 401 em produção.

a) Quais variáveis de ambiente devem ser verificadas primeiro?

b) Qual o significado específico do erro `not_allowed_ip` e como resolvê-lo na Vercel?

c) Se `ASAAS_ENV` não estiver definida, para qual ambiente o KathApp aponta? Por quê essa escolha é considerada segura?

---

### Exercício 2 — Idempotência do webhook

**Cenário:** O servidor está sob carga alta. O Asaas envia `PAYMENT_CONFIRMED` para o pagamento `pay_abc123`. O servidor processa o evento em 28 segundos. O Asaas considera timeout após 30 segundos e reenvia o evento. O segundo evento chega antes do primeiro terminar.

a) O que acontece no segundo evento ao tentar fazer `INSERT INTO webhook_events`?

b) Se o handler do primeiro evento falhar após registrar o revenue_stream mas antes de creditar o cashback, o que o padrão R-A faz? Quais operações são executadas?

c) Quando o Asaas reentregar o evento e `recordRevenueStream` for chamado novamente, o que evita a duplicação do revenue_stream?

---

### Exercício 3 — Cálculo de cashback

**Cenário:** Uma usuária tem R$ 120,00 de saldo ativo na carteira. Ela quer usar R$ 80,00 de cashback em uma compra de R$ 130,00 (13000 centavos). O plano dela é `plano3` (7% de cashback).

a) Qual o valor máximo de cashback que pode ser usado nessa compra? Mostre o cálculo passo a passo usando `clampCashbackCents`.

b) Qual será o `total_cents` (valor pago em dinheiro) após aplicar o cashback?

c) Quando o pagamento for confirmado pelo webhook, quanto de novo cashback será creditado na carteira? (Dica: o `gross_cents` inclui o cashback usado.)

---

### Exercício 4 — Erros tipados

**Cenário:** Um usuário tenta assinar o `plano3` mas informou um CPF com formato inválido. O Asaas retorna:
```json
{
  "errors": [{ "code": "invalid_cpfCnpj", "description": "CPF/CNPJ is invalid" }]
}
```
com status HTTP 422.

a) Qual classe é instanciada pelo `asaasRequest`? Quais propriedades ela terá?

b) No handler de `POST /api/checkout/subscribe`, qual ramificação do `if (err instanceof AsaasApiError)` é executada?

c) Qual mensagem o usuário recebe na UI? De onde vem essa mensagem?

d) O sistema vai tentar novamente (retry) essa requisição? Por quê?

---

### Exercício 5 — Modelo financeiro

**Cenário:** Um usuário do plano `plano1` compra um produto de R$ 50,00 usando R$ 20,00 de cashback. Considere que Russo tem uma regra de 25% sobre toda receita e Sidney não tem regra para a loja.

a) Qual será o `gross_cents`, `cost_cents` (produto custa R$ 15,00 para repor), e `net_cents` no `revenue_stream`?

b) Qual será o `amount_cents` da allocation de Russo? (Comissão sobre `net_cents`, não sobre `gross_cents`.)

c) Quanto Kath recebe nessa transação? (Resíduo após comissão e cashback.)

d) Se o usuário pedir estorno depois, o que acontece com as `commission_allocations` com status `draft`?

---

> **Respostas esperadas — use os arquivos do repositório como referência:**
> - Ex. 1: `src/lib/asaas/config.ts`, docs do Asaas, Vercel IP egress.
> - Ex. 2: `src/app/api/webhook/asaas/route.ts` linhas 56-67, 164-181; `src/lib/billing/revenue.ts` linhas 42-52.
> - Ex. 3: `src/lib/billing/cashback-utils.ts`; cálculo: `min(8000, 6500, 12000) = 6500`. Total: `13000 - 6500 = 6500`. Cashback novo: `floor((6500 + 6500) * 0.07) = floor(910) = 910` centavos.
> - Ex. 4: `src/lib/asaas/client.ts` linhas 20-31; `src/app/api/checkout/subscribe/route.ts` linhas 165-178.
> - Ex. 5: `gross=5000+2000=7000`, `cost=1500`, `net=5500`. Russo: `round(5500*0.25)=1375`. Kath: `5500 - 1375 - 2000 = 2125`. Estorno: `commission_allocations` mudam para `status="failed"` via `refundRevenueStream`.
