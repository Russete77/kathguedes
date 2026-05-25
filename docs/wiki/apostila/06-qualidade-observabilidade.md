# Módulo 6 — Qualidade & Observabilidade

> Apostila técnica KathApp · Stack: Next.js 15 + TypeScript + Supabase + Clerk + Asaas · Vitest

---

## Sumário

1. [Testes com Vitest](#1-testes-com-vitest)
   - 1.1 Estrutura e configuração
   - 1.2 Rodando os testes
   - 1.3 Dois tipos de teste: puro vs. com mock do cliente Supabase
   - 1.4 A regra do projeto: nunca mockar DB em testes de integração
   - 1.5 Como construir um mock de Supabase client correto
   - 1.6 Padrão de idempotência testada (wallet.test.ts)
   - 1.7 Testes puramente funcionais (access.test.ts, cashback-utils.test.ts)
2. [Validação com Zod](#2-validação-com-zod)
   - 2.1 Por que centralizar em validations.ts
   - 2.2 `safeParse` vs `parse` — quando usar cada um
   - 2.3 `transform` e `refine` — CPF, códigos normalizados, e-mails opcionais
   - 2.4 `parseFormData` — helper para Server Actions
   - 2.5 Schemas em Route Handlers
3. [Contrato de Erros](#3-contrato-de-erros)
   - 3.1 `handleApiError` — log estruturado vs. mensagem genérica
   - 3.2 Quando expor erro acionável: `AsaasApiError` 4xx
   - 3.3 Anti-patterns proibidos
   - 3.4 Webhook: 5xx garante reentrega
4. [Sentry — instalação e instrumentação](#4-sentry--instalação-e-instrumentação)
   - 4.1 O no-op gracioso via dynamic import
   - 4.2 Por que `env.ts` exige `SENTRY_DSN` em prod
   - 4.3 Como instalar e instrumentar
5. [CI — Pipeline de qualidade](#5-ci--pipeline-de-qualidade)
   - 5.1 O que roda no GitHub Actions
   - 5.2 Jobs `quality` e `build`
   - 5.3 Audit gate — bloqueio em vulnerabilidades
6. [Disciplina de qualidade do projeto](#6-disciplina-de-qualidade-do-projeto)
   - 6.1 Checklist antes de fechar trabalho
   - 6.2 Design System e regras de código
7. [Exercícios](#7-exercícios)

---

## 1. Testes com Vitest

### 1.1 Estrutura e configuração

O KathApp usa **Vitest 4.x** como framework de testes. O arquivo de configuração fica em `vitest.config.ts` na raiz do projeto.

**Arquivo:** `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",      // simula DOM para testes de componentes React
    globals: true,             // describe/it/expect disponíveis sem import
    setupFiles: ["./src/test/setup.ts"],
    pool: "threads",           // paralelismo via worker threads
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // resolve @/lib/... igual ao Next.js
    },
  },
});
```

O setup global (`src/test/setup.ts`) apenas importa `@testing-library/jest-dom/vitest` para os matchers extras de DOM como `toBeInTheDocument()`.

Os testes de lógica de negócio vivem junto ao código que testam, dentro de `src/lib/billing/`:

```
src/lib/billing/
  access.ts               # lógica pura de níveis de plano
  access.test.ts          # testes puramente funcionais (sem mock)
  cashback-utils.ts       # cálculos de cashback
  cashback-utils.test.ts  # testes puramente funcionais (sem mock)
  wallet.ts               # operações de wallet via Supabase
  wallet.test.ts          # testes com mock do cliente Supabase
  plans.ts                # carregamento e cache de planos
  plans.test.ts           # testes com mock do cliente Supabase
  revenue.ts              # registro de receitas e comissões
  revenue.test.ts         # testes com mock do cliente Supabase
  commissions.ts          # cálculo e aprovação de comissões
  commissions.test.ts     # testes com mock do cliente Supabase
```

### 1.2 Rodando os testes

```bash
# Roda todos os testes uma vez (modo CI)
npm run test

# Modo watch para desenvolvimento
npm run test:watch

# Equivalente direto ao Vitest
npx vitest run
npx vitest run --passWithNoTests  # usado no CI para não falhar em repos sem testes
```

### 1.3 Dois tipos de teste: puro vs. com mock do cliente Supabase

O projeto distingue claramente dois tipos de teste unitário:

**Tipo A — Teste puro (zero dependências externas)**

Funções que recebem apenas tipos primitivos, executam lógica matemática ou de comparação, e retornam valores — sem I/O. Não precisam de mock algum.

**Tipo B — Teste com mock do cliente Supabase**

Funções que dependem de `createAdminSupabaseClient()` para ler ou escrever no banco. O módulo é interceptado via `vi.mock()`, e o cliente retornado é um objeto com `vi.fn()` para cada método da query builder.

### 1.4 A regra do projeto: nunca mockar DB em testes de integração

O `CLAUDE.md` lista entre os anti-patterns proibidos:

> **Mock de DB em teste integration**

E a memória do projeto reforça:

> Sem mocks de DB em testes — usar Supabase real; mocks existentes são dívida técnica, sinalizar antes de seguir o padrão.

**O trade-off:**

| | Mock de Supabase (unit) | Supabase real (integração) |
|---|---|---|
| Velocidade | Milissegundos | Segundos (rede) |
| O que testa | Lógica interna da função | Comportamento end-to-end com RLS, constraints, triggers |
| Confiabilidade | Alta (sem flake de rede) | Depende de conectividade e estado do banco |
| Cobertura de RLS | Nenhuma | Total |
| Cobertura de trigger/RPC SQL | Nenhuma | Total |

**A escolha do projeto:** usar mocks de Supabase client apenas para testar a **lógica da camada TypeScript** (sequência de chamadas, tratamento de erro, idempotência, cálculos). Para validar que policies de RLS, constraints de unicidade e stored procedures funcionam, o teste correto é rodar contra o Supabase real (em staging ou numa branch de banco dedicada).

> **Quando mockar é adequado:** funções como `spendWalletCents`, `recordRevenueStream` e `computeCommissions` têm lógica complexa em TypeScript (checagem de idempotência, ordenação de chamadas, propagação de erro). Testar essa lógica sem atingir o banco é exatamente o papel do mock de unit test. O mock não substitui um teste de integração — ele o complementa.

### 1.5 Como construir um mock de Supabase client correto

O padrão adotado em todos os arquivos `*.test.ts` do projeto usa `vi.mock()` no topo do arquivo, **antes** dos imports do módulo testado (o Vitest içe `vi.mock()` automaticamente):

**Arquivo:** `src/lib/billing/wallet.test.ts` (linhas 1-25)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Declara as funções mock antes do vi.mock() — serão referenciadas na factory
const mockRpc = vi.fn();
const mockFrom = vi.fn();

// Intercepta o módulo inteiro; a factory retorna um objeto compatível
// com a interface do cliente Supabase usado em wallet.ts
vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

// Apenas DEPOIS do vi.mock() importamos o modulo que usa o client
import { spendWalletCents, creditWalletCents } from "./wallet";

beforeEach(() => {
  mockRpc.mockReset();   // limpa chamadas e valores entre testes
  mockFrom.mockReset();
});
```

**Por que declarar mocks antes do `vi.mock()`?**

O Vitest eleva `vi.mock()` para antes de qualquer import. Por isso, as variáveis referenciadas dentro da factory precisam ser declaradas antes — caso contrário, a factory acessa variáveis ainda não inicializadas. O padrão correto é: `vi.fn()` no topo → `vi.mock()` com factory → `import` do módulo real.

**Encadeando o query builder:**

O cliente Supabase retorna um builder fluente: `.from().select().eq().limit().maybeSingle()`. O mock precisa replicar essa cadeia:

```typescript
// Exemplo: mock para .from("wallet_credits").select().eq().limit().maybeSingle()
function mockExistingSpend(existing: { id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
  const limit     = vi.fn().mockReturnValue({ maybeSingle });
  const eq        = vi.fn().mockReturnValue({ limit });
  const select    = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}
```

Cada nível da cadeia retorna o próximo. Note: `mockReturnValue` para métodos síncronos (que retornam um builder), `mockResolvedValue` para o método terminal que resolve a Promise.

**Verificando a chamada:**

```typescript
it("chama RPC com args corretos", async () => {
  mockExistingSpend(null);
  mockRpc.mockResolvedValueOnce({ data: 500, error: null });

  const result = await spendWalletCents({
    userId: "user_1",
    amountCents: 1000,
    revenueStreamId: "rs_1",
  });

  expect(mockRpc).toHaveBeenCalledWith("spend_wallet_cents", {
    p_user_id: "user_1",
    p_amount_cents: 1000,
    p_revenue_stream_id: "rs_1",
  });
  expect(result).toBe(500);
});
```

### 1.6 Padrão de idempotência testada

Um dos padrões mais importantes no projeto é verificar que operações críticas (crédito e débito de carteira, registro de receita) são idempotentes — ou seja, não se repetem se já foram executadas para a mesma chave.

**Arquivo:** `src/lib/billing/wallet.test.ts` (linha 49-55)

```typescript
it("idempotente: nao gasta de novo se ja existe gasto para o stream", async () => {
  mockExistingSpend({ id: "wc_spent" });  // simula registro existente no banco

  const result = await spendWalletCents({
    userId: "user_1",
    amountCents: 1000,
    revenueStreamId: "rs_1",
  });

  expect(mockFrom).toHaveBeenCalledWith("wallet_credits");
  expect(mockRpc).not.toHaveBeenCalled();  // RPC nao deve ser chamado
  expect(result).toBe(0);
});
```

O teste verifica que a função consultou a tabela buscando um registro existente e, ao encontrá-lo, saiu sem chamar o RPC — sem necessidade de atingir o banco real.

### 1.7 Testes puramente funcionais

Funções sem I/O são testadas de forma direta, sem nenhum mock:

**Arquivo:** `src/lib/billing/access.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { hasPlanAccess, isTopPlan, planLevel, TOP_PLAN } from "./access";

describe("planLevel", () => {
  it("maps each slug to its level", () => {
    expect(planLevel("free")).toBe(0);
    expect(planLevel("atleta")).toBe(5);
  });

  it("treats null/undefined/unknown (incl. legacy slugs) as level 0", () => {
    expect(planLevel(null)).toBe(0);
    expect(planLevel("vip")).toBe(0);   // slug legado morto — level 0
    expect(planLevel("pro")).toBe(0);   // idem
  });
});

describe("hasPlanAccess", () => {
  it("chat gate (plano3) exclui tiers inferiores mas inclui atleta", () => {
    expect(hasPlanAccess("plano2", "plano3")).toBe(false);
    expect(hasPlanAccess("plano3", "plano3")).toBe(true);
    expect(hasPlanAccess("atleta", "plano3")).toBe(true);
  });
});
```

**Arquivo:** `src/lib/billing/cashback-utils.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { clampCashbackCents, computeAmountPaidCash } from "./cashback-utils";

describe("clampCashbackCents", () => {
  it("limita ao saldo ativo", () => {
    expect(clampCashbackCents({ requested: 5000, gross: 10000, activeBalance: 3000 })).toBe(3000);
  });

  it("limita a 50% do gross", () => {
    expect(clampCashbackCents({ requested: 8000, gross: 10000, activeBalance: 9000 })).toBe(5000);
  });

  it("trata NaN como 0", () => {
    expect(clampCashbackCents({ requested: NaN, gross: 10000, activeBalance: 5000 })).toBe(0);
  });
});
```

Esses testes são extremamente rápidos (sub-millisecond cada), cobrem todos os edge cases relevantes e nunca dependem de infraestrutura externa. São o tipo de teste mais valioso para manter: fáceis de escrever, impossíveis de ter flake.

---

## 2. Validação com Zod

### 2.1 Por que centralizar em validations.ts

O `CLAUDE.md` é explícito: **"Validação Zod sempre em `src/lib/validations.ts`. Toda entrada externa."**

Centralizar os schemas em um único arquivo oferece:

- **Reutilização:** o mesmo schema é usado no Route Handler, na Server Action e no teste unitário, sem duplicação.
- **Rastreabilidade:** quando um campo muda (por exemplo, um novo método de pagamento é adicionado), há um único lugar para atualizar.
- **Consistência:** a mesma mensagem de erro e a mesma regra de normalização são aplicadas em todos os pontos de entrada.

**Arquivo:** `src/lib/validations.ts` — o arquivo define schemas para todas as entidades manipuladas externamente: workouts, cupons, afiliados, produtos, serviços de estética, agendamentos, walk-ins, consultorias e status de pedidos.

### 2.2 `safeParse` vs `parse` — quando usar cada um

**`schema.parse(data)`** — lança `ZodError` se a validação falhar.

Use em Server Actions e contextos onde você quer que o erro seja propagado para o boundary de erro mais próximo (ou capturado por um `try/catch` que retorna uma resposta de erro ao usuário).

**Arquivo:** `src/app/admin/kath-estetica/actions.ts` (linha 586)

```typescript
// Em Server Action: parse lanca ZodError; o erro e capturado pelo boundary de erro do Next.js
const data = walkinServiceSchema.parse(raw);
```

**`schema.safeParse(data)`** — retorna `{ success: true, data }` ou `{ success: false, error }` sem lançar.

Use em Route Handlers, onde você precisa retornar uma resposta HTTP estruturada com status 400 em vez de deixar o erro estourar:

**Arquivo:** `src/app/api/checkout/subscribe/route.ts` (linha 56-59)

```typescript
const parsed = subscribeBodySchema.safeParse(raw);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const { plan, billingType, cpfCnpj: cpfFromBody } = parsed.data;
```

`error.flatten()` converte o `ZodError` em um objeto com `fieldErrors` (erros por campo) e `formErrors` (erros gerais), fácil de consumir no frontend.

| Cenário | Método |
|---|---|
| Route Handler (precisa de HTTP 400) | `safeParse` + verificação manual |
| Server Action (boundary captura ZodError) | `parse` |
| Validação inline sem lançar (ex.: CPF do body) | `safeParse` |
| Schema intermediário (sub-validação) | `parse` dentro de `try/catch` |

### 2.3 `transform` e `refine` — normalizações e validações compostas

**`transform`** — transforma o valor após validação de tipo. Usado para normalizar:

**Arquivo:** `src/lib/validations.ts` (linha 27)

```typescript
code: z.string().min(1, "Código obrigatório").max(50).transform(v => v.toUpperCase()),
```

O código do cupom entra como qualquer string e sai sempre em maiúsculas — sem depender do frontend fazer isso.

**Arquivo:** `src/app/api/checkout/subscribe/route.ts` (linha 18-22)

```typescript
// CPF/CNPJ: remove mascara, normalizando para apenas digitos
const cpfCnpjSchema = z
  .string()
  .min(1, "CPF ou CNPJ obrigatorio")
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .refine((v) => v.length === 11 || v.length === 14, {
    message: "CPF deve ter 11 digitos ou CNPJ 14 digitos",
  });
```

Note a ordem: `transform` executa primeiro (remove a máscara), depois `refine` valida o comprimento do valor já normalizado. Isso evita que o usuário seja punizado por ter digitado `123.456.789-09` em vez de `12345678909`.

**`refine`** — validação booleana customizada com mensagem de erro:

**Arquivo:** `src/lib/validations.ts` (linha 103-105)

```typescript
plate: z
  .string()
  .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, "Placa inválida (use ABC1D23 ou ABC1234)"),
```

**E-mail opcional que aceita string vazia:**

**Arquivo:** `src/lib/validations.ts` (linha 108)

```typescript
customer_email: z.string().email("E-mail inválido").max(200).nullable().optional()
  .or(z.literal("").transform(() => null)),
```

O `.or(z.literal("").transform(() => null))` resolve um problema real de formulários HTML: o campo vazio vem como string `""`, que não é null nem undefined. Sem esse tratamento, `z.string().email()` rejeitaria o campo vazio de um usuário que simplesmente não preencheu o e-mail.

### 2.4 `parseFormData` — helper para Server Actions

**Arquivo:** `src/lib/validations.ts` (linhas 148-154)

```typescript
export function parseFormData<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    raw[key] = value === "" ? null : value;   // strings vazias viram null
  });
  return schema.parse(raw);
}
```

O `FormData` dos formulários HTML envia todos os valores como strings. O helper normaliza strings vazias para `null` antes de entregar ao Zod. Os schemas usam `z.coerce.number()` para converter strings numéricas, então um campo `price_cents` com valor `"3990"` é convertido automaticamente.

**Uso em Server Action:**

**Arquivo:** `src/app/admin/actions.ts` (linha 50)

```typescript
export async function createWorkout(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const data = parseFormData(createWorkoutSchema, formData);
  // data ja esta tipado e validado; acessar data.title, data.youtube_id, etc. e seguro
}
```

### 2.5 Schemas em Route Handlers

Em Route Handlers, o body vem de `req.json()` — que pode lançar se o JSON estiver malformado. O padrão do projeto é tratar isso separadamente antes do Zod:

```typescript
let raw: unknown;
try {
  raw = await req.json();
} catch {
  return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
}

const parsed = subscribeBodySchema.safeParse(raw);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
```

---

## 3. Contrato de Erros

### 3.1 `handleApiError` — log estruturado vs. mensagem genérica

**Arquivo:** `src/lib/api-error.ts`

```typescript
export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const stack   = error instanceof Error ? error.stack  : undefined;

  // Log em JSON estruturado: Vercel ingere stdout e indexa por campo
  console.error(JSON.stringify({
    level:     "error",
    context,                             // ex.: "POST /api/checkout/subscribe"
    message,                             // causa real — visível apenas server-side
    stack,
    timestamp: new Date().toISOString(),
  }));

  // Sentry — async, nao bloqueia a resposta
  loadSentry().then((capture) => {
    if (capture) capture(error, { extra: { context } });
  }).catch(() => { /* swallow */ });

  // Cliente recebe apenas: 500 + mensagem generica
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

**Principio:** o servidor sabe tudo; o cliente sabe o mínimo necessário para reagir. Stack traces e mensagens de banco de dados nunca chegam ao browser.

O `console.error(JSON.stringify(...))` é a escolha deliberada para a Vercel: a plataforma ingere stdout/stderr e indexa como JSON estruturado no painel de logs, permitindo filtrar por `context`, nível e intervalo de tempo. Se o log fosse texto livre, perderia-se a possibilidade de busca por campo.

### 3.2 Quando expor erro acionável: `AsaasApiError` 4xx

**Arquivo:** `src/lib/asaas/client.ts` (linhas 20-31)

```typescript
export class AsaasApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Asaas API error ${status}: ${JSON.stringify(body)}`);
    this.name = "AsaasApiError";
  }

  // Primeira descricao de erro retornada pelo Asaas, se houver
  get description(): string | null {
    const b = this.body as { errors?: Array<{ description?: string }> } | null;
    return b?.errors?.[0]?.description ?? null;
  }
}
```

A distinção entre 4xx e 5xx do Asaas determina o que o usuário vê:

**Arquivo:** `src/app/api/checkout/subscribe/route.ts` (linhas 163-190)

```typescript
} catch (err) {
  if (err instanceof AsaasApiError) {
    // Loga server-side com causa completa para auditoria
    handleApiError(err, "POST /api/checkout/subscribe (asaas)");

    if (err.status >= 400 && err.status < 500) {
      // 4xx = dados recusados pelo Asaas (CPF invalido, e-mail, etc.)
      // Mensagem acionavel: o usuario pode corrigir os dados
      return NextResponse.json(
        {
          error: "payment_validation",
          message: err.description ?? "Dados de pagamento recusados. Confira o CPF/CNPJ informado.",
        },
        { status: 422 },
      );
    }
    // 5xx = indisponibilidade do provedor — mensagem generica
    return NextResponse.json(
      { error: "payment_provider_error", message: "O processador de pagamento esta instavel. Tente novamente." },
      { status: 502 },
    );
  }
  // Qualquer outro erro: 500 generico
  return handleApiError(err, "POST /api/checkout/subscribe");
}
```

**Regra geral:**

- Erro causado **pelos dados do usuário** (4xx) → mensagem acionável ao cliente, logada server-side.
- Erro de **infraestrutura** (5xx, banco, timeout) → mensagem genérica ao cliente, detalhe nos logs.
- Erro **desconhecido** → `handleApiError` (500 genérico + log completo).

### 3.3 Anti-patterns proibidos

O `CLAUDE.md` é explícito sobre dois anti-patterns críticos em tratamento de erros:

**1. Engolir erros silenciosamente:**

```typescript
// PROIBIDO — nunca faça isso
try {
  await operacaoCritica();
} catch {
  // swallow — o erro desaparece; o usuario nao sabe; o log nao sabe
}
```

**2. Webhook retornando 200 em erro de handler:**

```typescript
// PROIBIDO
export async function POST(req: NextRequest) {
  try {
    await processarPagamento(req);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false });  // ERRADO: retorna 200 com corpo de erro
  }
}

// CORRETO — erros de handler devem retornar 5xx para reentrega
export async function POST(req: NextRequest) {
  try {
    await processarPagamento(req);
    return NextResponse.json({ received: true });
  } catch (err) {
    return handleApiError(err, "POST /api/webhook/asaas");
    // handleApiError retorna NextResponse com status 500
  }
}
```

O Asaas (e qualquer gateway de pagamento) reentrega webhooks que recebem 5xx. Se o handler retornar 200 mesmo em erro, o evento é considerado processado e nunca reenviado — causando perda de dados silenciosa.

### 3.4 Webhook: 5xx garante reentrega

A regra do projeto (CLAUDE.md §8): **"Webhook idempotente. Erro de handler = 5xx para reentregar."**

Isso significa que toda função chamada por um webhook deve ser escrita para ser segura de executar múltiplas vezes com o mesmo payload. A idempotência é garantida por checagens antes da ação destrutiva (ex.: verificar se o `asaas_payment_id` já existe em `webhook_events` antes de processar).

---

## 4. Sentry — instalação e instrumentação

### 4.1 O no-op gracioso via dynamic import

O pacote `@sentry/nextjs` **não está instalado** como dependência do projeto (ausente em `package.json`). Mesmo assim, `handleApiError` tenta carregá-lo em runtime:

**Arquivo:** `src/lib/api-error.ts` (linhas 16-34)

```typescript
async function loadSentry(): Promise<SentryCapture | null> {
  if (sentryLoadAttempted) return sentryCapture;  // singleton — tenta so uma vez
  sentryLoadAttempted = true;
  if (!process.env.SENTRY_DSN) return null;       // sem DSN, nem tenta
  try {
    // O nome do pacote e construido dinamicamente para esconder o specifier
    // do webpack/turbopack: eles nao emitem warning "Can't resolve" para imports
    // com nome dinamico. Quando @sentry/nextjs estiver instalado, funciona normalmente.
    const sentryPkg = ["@sentry", "nextjs"].join("/");
    const mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ sentryPkg);
    sentryCapture = (error, ctx) => mod.captureException(error, ctx);
    return sentryCapture;
  } catch {
    return null;  // pacote nao instalado: degrada graciosamente para console.error
  }
}
```

**Por que esse design?**

- Em desenvolvimento, `SENTRY_DSN` geralmente nao esta definido. O `loadSentry` retorna `null` imediatamente e o código funciona apenas com `console.error`.
- Quando o pacote for instalado e `SENTRY_DSN` for configurado em produção, o import dinâmico funcionará sem nenhuma alteração no código.
- O truque `["@sentry", "nextjs"].join("/")` evita que o webpack analise estaticamente o specifier e emita avisos de módulo não encontrado durante o build — mesmo com o pacote ausente.

### 4.2 Por que `env.ts` exige `SENTRY_DSN` em prod

**Arquivo:** `src/lib/env.ts` (linhas 64-70)

```typescript
get SENTRY_DSN() {
  return requiredInProduction("SENTRY_DSN");
},
```

A função `requiredInProduction` lança `Error` se a variável estiver ausente em `NODE_ENV === "production"` com `VERCEL_ENV !== "preview"`. Isso garante que o deploy em produção falhe rápido na inicialização, em vez de silenciosamente não capturar erros durante toda a vida útil da instância.

Em preview (Vercel PR deployments) e em desenvolvimento local, a variável é opcional — o sistema degrada para logs no console.

### 4.3 Como instalar e instrumentar

Quando o projeto estiver pronto para capturar erros em produção via Sentry:

**1. Instalar o pacote:**

```bash
npm install @sentry/nextjs
```

**2. Inicializar com o wizard (recomendado):**

```bash
npx @sentry/wizard@latest -i nextjs
```

O wizard cria `sentry.client.config.ts`, `sentry.server.config.ts` e `sentry.edge.config.ts`, e modifica `next.config.ts` para instrumentação automática.

**3. Configurar o DSN no Vercel:**

```
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

Com o pacote instalado e o DSN configurado, o `loadSentry()` em `handleApiError` passa a capturar automaticamente no Sentry todas as exceções de Route Handlers e Server Actions que passam por `handleApiError`. Nenhuma outra alteração de código é necessária.

**4. Captura manual em contextos específicos:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.captureException(err, {
  extra: { userId, webhookEventId },
  tags: { module: "estetica" },
});
```

> **Nota:** Erros de webhooks são especialmente importantes de capturar, porque falhas silenciosas ali podem resultar em perda de dados financeiros. Sentry com alertas por email/Slack é a primeira linha de defesa.

---

## 5. CI — Pipeline de qualidade

### 5.1 O que roda no GitHub Actions

**Arquivo:** `.github/workflows/ci.yml`

O pipeline é acionado em todo push para `main` e em todo Pull Request para `main`. É composto por dois jobs sequenciais: `quality` e `build`.

### 5.2 Jobs `quality` e `build`

**Job `quality`** (roda primeiro):

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: npm

  - name: Install deps
    run: npm ci

  - name: Type-check
    run: npx tsc --noEmit         # falha se houver erro de tipo TypeScript

  - name: Lint
    run: npm run lint             # ESLint com eslint-config-next

  - name: Tests
    run: npx vitest run --passWithNoTests

  - name: Audit production deps (blocking)
    run: npm audit --omit=dev --audit-level=high   # bloqueia merge

  - name: Audit dev deps (informational)
    run: npm audit --audit-level=high || true       # nao bloqueia
```

**Job `build`** (roda após `quality` passar):

```yaml
build:
  needs: quality    # so executa se quality passou
  steps:
    - run: npm run build
      env:
        NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
        # ... outras vars placeholder para o build estatico passar
```

O build usa variáveis placeholder porque o Next.js precisa das variáveis `NEXT_PUBLIC_*` em build time, mas os valores reais são injetados pelo Vercel em runtime. O CI valida apenas que o código compila sem erros de build.

### 5.3 Audit gate — bloqueio em vulnerabilidades

A linha `npm audit --omit=dev --audit-level=high` **bloqueia o merge** se qualquer dependência de produção tiver vulnerabilidade classificada como `high` ou `critical`. Dependências de desenvolvimento (Vitest, ESLint, TypeScript) são auditadas em seguida mas não bloqueiam o merge.

Essa distinção é deliberada: uma vulnerabilidade em `vitest` é um problema, mas não afeta usuários em produção. Uma vulnerabilidade em `@supabase/supabase-js` ou `next` pode ter impacto direto.

---

## 6. Disciplina de qualidade do projeto

### 6.1 Checklist antes de fechar trabalho

O `CLAUDE.md` §14 define o checklist que deve ser executado antes de qualquer commit ou PR:

```bash
# 1. Linting — zero warnings tratados como erro pela config do ESLint
npm run lint

# 2. Build — garante que nenhum erro de tipo ou import quebrado passou pelo TSC
npm run build

# 3. Testes — todos devem passar
npm run test

# 4. Teste de browser — abrir o fluxo afetado no navegador e verificar manualmente
```

O passo 4 não pode ser automatizado: o desenvolvedor deve abrir o fluxo no browser e exercitar o caminho feliz e pelo menos um caminho de erro. Por exemplo, ao modificar o checkout, testar com CPF inválido, com plano inválido e com pagamento real em sandbox do Asaas.

### 6.2 Design System e regras de código

**Server Component por padrão:** toda page, layout e componente é Server Component por padrão. `'use client'` é adicionado apenas quando há interatividade real (hooks de estado, event handlers do browser). Forms usam Server Actions.

```tsx
// CORRETO — Server Component
export default async function AgendamentosPage() {
  const bookings = await getBookings();
  return <BookingsList bookings={bookings} />;
}

// INCORRETO — nao adicionar 'use client' ao layout
// "use client"  <-- proibido em layout.tsx
export default function AdminLayout({ children }) { ... }
```

**Design tokens em vez de hex hardcoded:**

```tsx
// CORRETO — usa tokens do globals.css
<div className="bg-bg-1 text-pink border-border-1">

// INCORRETO — hex hardcoded em componente
<div style={{ backgroundColor: "#1a1a2e", color: "#ff69b4" }}>
```

**Sem emojis em código de produção** (CLAUDE.md §12): emojis em componentes, strings de erro, logs e comentários de código são proibidos salvo instrução explícita do usuário.

**Idiomas:**
- UI visível ao usuário: pt-BR
- Mensagens de erro técnicas em Route Handlers (logs, respostas de erro): inglês curto
- Identificadores de código, nomes de variáveis, funções: inglês

**Contadores atômicos — nunca SELECT-then-UPDATE:**

```typescript
// PROIBIDO
const { data } = await supabase.from("coupons").select("uses").eq("id", id).single();
await supabase.from("coupons").update({ uses: data.uses + 1 }).eq("id", id);

// CORRETO — atomico via RPC ou UPDATE direto
await supabase.rpc("increment_coupon_uses", { p_coupon_id: id });
// ou:
await supabase.from("coupons").update({ uses: supabase.rpc("uses + 1") }).eq("id", id);
```

A versão com SELECT-then-UPDATE tem race condition: se dois requests processarem o mesmo cupom simultaneamente, ambos leem `uses = 5` e escrevem `uses = 6`, quando o correto seria `uses = 7`.

---

## 7. Exercícios

**Exercício 1 — Teste puro**

Escreva um arquivo `src/lib/billing/format-cents.test.ts` para uma função hipotética `formatCents(cents: number, locale?: string): string` que converte `1990` em `"R$ 19,90"`. A função deve retornar `"Grátis"` para `0`. Escreva pelo menos 5 casos de teste (incluindo valores negativos, `NaN` e `Infinity`) sem usar nenhum mock.

**Exercício 2 — Mock de query builder**

A função `getBookingByPlate(plate: string)` chama `supabase.from("estetica_bookings").select("*").eq("plate", plate).order("created_at", { ascending: false }).limit(1).maybeSingle()`. Escreva o teste completo com `vi.mock()` e `vi.fn()` verificando (a) que `eq` foi chamado com `"plate"` e o valor correto, (b) que `limit` foi chamado com `1`, e (c) que a função retorna `null` quando `maybeSingle` resolve `{ data: null, error: null }`.

**Exercício 3 — Schema Zod com transform e refine**

Crie em `src/lib/validations.ts` um schema `pixKeySchema` que aceita chaves Pix dos tipos CPF (11 dígitos), CNPJ (14 dígitos), e-mail, telefone (`+55` seguido de 10-11 dígitos) ou chave aleatória (UUID v4). Use `transform` para normalizar CPF/CNPJ removendo máscara e `refine` para validar o comprimento. Teste com `safeParse` três casos válidos e três inválidos.

**Exercício 4 — Contrato de erros**

Implemente um Route Handler `POST /api/estetica/walkin-test` que: (a) valida o body com um schema Zod via `safeParse` retornando 400 em falha, (b) realiza uma operação no Supabase, (c) em erro do Supabase, chama `handleApiError` e retorna 500, e (d) em sucesso, retorna 201 com o recurso criado. Certifique-se de que nenhum `catch` engole o erro silenciosamente.

**Exercício 5 — CI local**

Adicione ao `package.json` um script `"check": "npm run lint && npm run build && npm run test"` que replica localmente a sequência do pipeline de CI. Execute-o e corrija qualquer falha encontrada. Em seguida, adicione uma step ao `ci.yml` existente que rode `npm audit --audit-level=critical` separadamente das deps de prod, apenas como informação (sem bloquear o build).

---

*Fim do Módulo 6 — Qualidade & Observabilidade*
