import { timingSafeEqual } from "crypto";
import { ASAAS_CONFIG } from "./config";

/**
 * Asaas Webhook Types & Verification.
 *
 * Refs (auditado 26/05/2026, doc oficial atualizada):
 *  - https://docs.asaas.com/docs/payment-events
 *  - https://docs.asaas.com/docs/subscription-events
 *  - https://docs.asaas.com/docs/about-webhooks
 *  - https://docs.asaas.com/docs/chargeback
 *
 * Fluxos canonicos (doc oficial):
 *  - Boleto pago no prazo:  PAYMENT_CREATED -> PAYMENT_CONFIRMED -> PAYMENT_RECEIVED
 *  - PIX pago no prazo:     PAYMENT_CREATED -> PAYMENT_RECEIVED
 *  - Cartao no prazo:       PAYMENT_CREATED -> PAYMENT_CONFIRMED -> PAYMENT_RECEIVED (D+30)
 *  - Chargeback ganho:      PAYMENT_RECEIVED -> CHARGEBACK_REQUESTED -> CHARGEBACK_DISPUTE
 *                                            -> AWAITING_CHARGEBACK_REVERSAL -> PAYMENT_RECEIVED
 *  - Chargeback perdido:    PAYMENT_RECEIVED -> CHARGEBACK_REQUESTED -> CHARGEBACK_DISPUTE
 *                                            -> PAYMENT_REFUNDED
 *
 * Idempotencia: tabela `webhook_events` PK `payment_id:event`. PAYMENT_CONFIRMED e
 * PAYMENT_RECEIVED sao colapsados em `payment_id:paid` por representarem o mesmo
 * "dinheiro entrou".
 *
 * Resposta esperada pelo Asaas: HTTP 200 quando processado. 4xx/5xx faz Asaas reentregar.
 */

// Lista completa de events de COBRANCA (payment) do Asaas.
export type AsaasPaymentEvent =
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_AWAITING_RISK_ANALYSIS"
  | "PAYMENT_APPROVED_BY_RISK_ANALYSIS"
  | "PAYMENT_REPROVED_BY_RISK_ANALYSIS"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_ANTICIPATED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_RESTORED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_PARTIALLY_REFUNDED"
  | "PAYMENT_REFUND_IN_PROGRESS"
  | "PAYMENT_RECEIVED_IN_CASH_UNDONE"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED"
  | "PAYMENT_BANK_SLIP_VIEWED"
  | "PAYMENT_CHECKOUT_VIEWED";

// Eventos de assinatura.
export type AsaasSubscriptionEvent =
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_INACTIVATED"
  | "SUBSCRIPTION_DELETED"
  | "SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK";

export type AsaasEvent = AsaasPaymentEvent | AsaasSubscriptionEvent;

/**
 * Payload do webhook conforme doc oficial.
 * Campos opcionais marcados como undefined-friendly — Asaas omite quando nao se aplicam.
 */
export interface AsaasWebhookPayload {
  event: string;
  // dateCreated: ISO-8601 da criacao do evento
  dateCreated?: string;
  payment?: {
    id: string;
    customer: string;
    subscription: string | null;
    value: number;
    netValue?: number;
    status: string;
    billingType: string;
    externalReference: string | null;
    description: string | null;
    dueDate?: string;
    paymentDate?: string | null;
    clientPaymentDate?: string | null;
    invoiceUrl?: string;
    chargeback?: {
      status?: "REQUESTED" | "IN_DISPUTE" | "DISPUTE_LOST" | "REVERSED" | "DONE";
      reason?: string;
    };
  };
  subscription?: {
    id: string;
    customer: string;
    value: number;
    cycle: string;
    status: string;
    nextDueDate: string;
    externalReference?: string | null;
  };
}

/**
 * Verifica se o webhook veio do Asaas comparando o token do header.
 * Usa timingSafeEqual para evitar timing attacks (vazamento microscopico do token).
 */
export function verifyWebhookToken(headerToken: string | null): boolean {
  if (!ASAAS_CONFIG.webhookToken) {
    console.error("[webhook] ASAAS_WEBHOOK_TOKEN not configured - rejecting all webhooks");
    return false;
  }
  if (!headerToken) return false;

  const a = Buffer.from(headerToken);
  const b = Buffer.from(ASAAS_CONFIG.webhookToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

