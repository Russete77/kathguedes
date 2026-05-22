import { ASAAS_CONFIG } from "./config";

/**
 * Asaas API client — server-only.
 * Docs: https://docs.asaas.com/docs/visao-geral
 *
 * Retry/backoff: tentamos até 3 vezes em 5xx e network errors.
 * 4xx (incluindo 422 de validação) NÃO retentam — o erro veio do client,
 * retry só piora.
 */

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * Erro tipado do Asaas — carrega o status HTTP e o corpo de erro retornado.
 * Permite ao chamador distinguir 4xx (dados do usuário: CPF inválido, etc.)
 * de 5xx (indisponibilidade do provedor) e exibir a causa real ao usuário,
 * em vez de um 500 genérico.
 */
export class AsaasApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Asaas API error ${status}: ${JSON.stringify(body)}`);
    this.name = "AsaasApiError";
  }

  /** Primeira descrição de erro retornada pelo Asaas (`errors[0].description`), se houver. */
  get description(): string | null {
    const b = this.body as { errors?: Array<{ description?: string }> } | null;
    return b?.errors?.[0]?.description ?? null;
  }
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function asaasRequest<T>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: object,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${ASAAS_CONFIG.baseUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: ASAAS_CONFIG.apiKey,
        },
        ...(body && { body: JSON.stringify(body) }),
      });
    } catch (networkErr) {
      // Network error / timeout — retentar
      lastError = networkErr;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
        continue;
      }
      throw new Error(
        `Asaas network error after ${MAX_ATTEMPTS} attempts: ${
          networkErr instanceof Error ? networkErr.message : String(networkErr)
        }`,
      );
    }

    if (res.ok) {
      return res.json() as Promise<T>;
    }

    // 4xx — não retentar
    if (res.status >= 400 && res.status < 500) {
      const err = await res.json().catch(() => ({}));
      throw new AsaasApiError(res.status, err);
    }

    // 5xx — backoff e retentar (se ainda tem tentativa)
    const errBody = await res.json().catch(() => ({}));
    lastError = new AsaasApiError(res.status, errBody);
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }
    throw lastError;
  }

  // Defensiva — não deveria chegar aqui
  throw lastError ?? new Error("Asaas request failed unexpectedly");
}

// ── Customers ──

interface CreateCustomerParams {
  name: string;
  email: string;
  cpfCnpj?: string;
}

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
}

export async function createCustomer(
  params: CreateCustomerParams
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>("/customers", "POST", params);
}

export async function getCustomer(
  customerId: string
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(`/customers/${customerId}`);
}

/**
 * Atualiza um customer existente no Asaas (PUT /customers/:id).
 * Usado para preencher CPF/CNPJ em customers criados antes de coletarmos o documento.
 */
interface UpdateCustomerParams {
  name?: string;
  email?: string;
  cpfCnpj?: string;
}

export async function updateCustomer(
  customerId: string,
  params: UpdateCustomerParams,
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(`/customers/${customerId}`, "PUT", params);
}

// ── Subscriptions ──

interface CreateSubscriptionParams {
  customer: string;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
  description: string;
  externalReference?: string;
}

interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  cycle: string;
  status: string;
  nextDueDate: string;
}

export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>("/subscriptions", "POST", params);
}

export async function getSubscription(
  subscriptionId: string
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(
    `/subscriptions/${subscriptionId}`
  );
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(
    `/subscriptions/${subscriptionId}`,
    "DELETE"
  );
}

// ── Payments ──

export interface AsaasPayment {
  id: string;
  customer: string;
  subscription: string | null;
  value: number;
  status: string;
  billingType: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  pixTransaction?: {
    qrCode: string;
    encodedImage: string;
    expirationDate: string;
  };
}

interface PaymentListResponse {
  data: AsaasPayment[];
  totalCount: number;
}

interface CreatePaymentParams {
  customer: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
}

/**
 * Cria uma cobrança avulsa (não-recorrente). Usado por loja e estética (PIX).
 * Centraliza o POST /payments — antes duplicado inline em cada rota — para
 * herdar retry/backoff e o AsaasApiError tipado (expõe a causa real ao usuário).
 */
export async function createPayment(
  params: CreatePaymentParams,
): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>("/payments", "POST", params);
}

/**
 * Lista os pagamentos de uma subscription.
 * O primeiro pagamento é gerado automaticamente pelo Asaas ao criar a subscription.
 */
export async function getSubscriptionPayments(
  subscriptionId: string
): Promise<AsaasPayment[]> {
  const res = await asaasRequest<PaymentListResponse>(
    `/subscriptions/${subscriptionId}/payments?limit=1&sort=dateCreated&order=desc`
  );
  return res.data;
}

/**
 * Busca dados de PIX de um pagamento (QR code).
 */
export async function getPaymentPixQrCode(
  paymentId: string
): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
  return asaasRequest(`/payments/${paymentId}/pixQrCode`);
}
