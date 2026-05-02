import { timingSafeEqual } from "crypto";
import { ASAAS_CONFIG } from "./config";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Asaas Webhook Types & Verification.
 * Docs: https://docs.asaas.com/docs/payment-events
 */

export type AsaasPaymentEvent =
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_PARTIALLY_REFUNDED";

export interface AsaasWebhookPayload {
  event: string;
  payment: {
    id: string;
    customer: string;
    subscription: string | null;
    value: number;
    status: string;
    billingType: string;
    externalReference: string | null;
    description: string | null;
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

/**
 * Determina o plan_tier baseado no valor da assinatura.
 */
export function planTierFromValue(value: number): PlanTier {
  if (value >= 99) return "vip";
  if (value >= 39) return "pro";
  if (value >= 19) return "start";
  return "free";
}
