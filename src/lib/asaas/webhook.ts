import { timingSafeEqual } from "crypto";
import { ASAAS_CONFIG } from "./config";
import { planTierFromValue as planTierFromValueDynamic } from "@/lib/billing/plans";
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
 * Resolve plan_tier a partir do valor pago. Lookup dinâmico em `plans` table.
 * Async porque depende de cache TTL 60s do `lib/billing/plans`.
 */
export async function planTierFromValue(value: number): Promise<PlanTier> {
  return planTierFromValueDynamic(value);
}
