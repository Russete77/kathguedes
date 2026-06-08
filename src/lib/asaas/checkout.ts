import {
  createCustomer,
  updateCustomer,
  createSubscription,
  createPayment,
  getSubscriptionPayments,
  getPaymentPixQrCode,
} from "./client";
import { getPlan, getCyclePrice, type BillingCycle } from "@/lib/billing/plans";
import { buildMensalidadeReference } from "./external-reference";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Checkout do modelo semestral/anual (migration 43).
 *
 * Dois fluxos, conforme a forma de pagamento:
 *  - PIX / BOLETO  → assinatura recorrente (createSubscription) com cycle
 *                    SEMIANNUALLY/YEARLY. Cobra o valor cheio à vista a cada
 *                    ciclo e renova sozinho.
 *  - CARTÃO        → cobrança parcelada única (createPayment + installmentCount
 *                    6/12), NÃO recorrente. Ao fim do período o aluno reassina.
 *
 * O plan_tier NÃO é ativado aqui — isso acontece no webhook PAYMENT_CONFIRMED,
 * que lê plano+ciclo do externalReference (`userId:plan:cycle`).
 */

interface CheckoutParams {
  userId: string; // Clerk user ID
  fullName: string;
  email: string;
  cpfCnpj: string; // só dígitos (11 CPF / 14 CNPJ) — obrigatório Asaas
  plan: PlanTier;
  cycle: BillingCycle;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
  /** Slug de promoção a tentar consumir. Se esgotou, segue preço cheio. */
  promoSlug?: string | null;
}

interface CheckoutResult {
  subscriptionId?: string; // só no fluxo recorrente (PIX/BOLETO)
  paymentId?: string; // só no fluxo parcelado (cartão)
  customerId: string;
  invoiceUrl: string;
  billingType: string;
  pixQrCode?: string;
  pixPayload?: string;
  /** Valor cheio à vista do ciclo (R$). */
  chargedValue: number;
  /** Nº de parcelas (cartão) — 6 ou 12. */
  installmentCount?: number;
  promoCodeId?: string;
}

const ASAAS_CYCLE: Record<BillingCycle, "SEMIANNUALLY" | "YEARLY" | "MONTHLY"> = {
  semestral: "SEMIANNUALLY",
  anual: "YEARLY",
  mensal: "MONTHLY",
};

export async function processCheckout(
  params: CheckoutParams,
): Promise<CheckoutResult> {
  const { userId, fullName, email, cpfCnpj, plan, cycle, billingType, promoSlug } = params;
  const supabase = createAdminSupabaseClient();

  // 0. Resolver plano + preço do ciclo (tabela `plans`, admin-editável).
  const planRow = await getPlan(plan);
  if (!planRow || !planRow.is_active) {
    throw new Error(`[checkout] plano inválido: ${plan}`);
  }
  const cyclePrice = getCyclePrice(planRow, cycle);
  if (cyclePrice.asaasValue <= 0) {
    throw new Error(`[checkout] preço inválido para ${plan}/${cycle}`);
  }

  // 0.1 Promo opcional (RPC atômico). Se esgotou/ausente, segue preço cheio.
  //
  // Dois tipos de promo:
  //  - Percentual (discount_pct > 0): aplica % sobre chargedValue — seguro para
  //    todas as formas de pagamento (10% off nunca viola o mínimo R$5/parcela).
  //  - Valor fixo (promo_value_cents > 0): substitui chargedValue, mas SOMENTE
  //    para PIX/BOLETO. No cartão parcelado, o valor fixo/N pode ficar abaixo do
  //    mínimo exigido pelo Asaas (R$5/parcela), causando rejeição 4xx.
  let chargedValue = cyclePrice.asaasValue;
  let promoCodeId: string | undefined;
  if (promoSlug && promoSlug.trim().length > 0) {
    try {
      const { data: promoRaw } = await supabase.rpc(
        "claim_promo_slot" as never,
        { p_slug: promoSlug, p_plan_tier: plan } as never,
      );
      const promo = (Array.isArray(promoRaw) ? promoRaw[0] : promoRaw) as
        | { id: string; promo_value_cents: number; discount_pct?: number }
        | null
        | undefined;
      if (promo) {
        const discountPct = promo.discount_pct ?? 0;
        if (discountPct > 0) {
          // Percentual: aplica a todas as formas de pagamento
          chargedValue = Math.round(chargedValue * (1 - discountPct / 100) * 100) / 100;
          promoCodeId = promo.id;
        } else if (promo.promo_value_cents > 0 && billingType !== "CREDIT_CARD") {
          // Valor fixo: somente PIX/BOLETO
          chargedValue = promo.promo_value_cents / 100;
          promoCodeId = promo.id;
        }
      }
    } catch (err) {
      console.warn("[checkout] claim_promo_slot fail (segue preço cheio):", err);
    }
  }

  // 1. Customer no Asaas (cria ou atualiza CPF idempotentemente).
  const { data: profile } = await supabase
    .from("profiles")
    .select("asaas_customer_id, cpf")
    .eq("id", userId)
    .single();

  type ProfileRow = { asaas_customer_id: string | null; cpf: string | null };
  const profileRow = profile as ProfileRow | null;
  let customerId = profileRow?.asaas_customer_id ?? null;

  if (!customerId) {
    const customer = await createCustomer({ name: fullName, email, cpfCnpj });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ asaas_customer_id: customerId, cpf: cpfCnpj })
      .eq("id", userId);
  } else {
    await updateCustomer(customerId, { name: fullName, email, cpfCnpj });
    await supabase.from("profiles").update({ cpf: cpfCnpj }).eq("id", userId);
  }

  // 2. externalReference carrega plano+ciclo → webhook resolve o tier sem
  //    depender do valor pago (que muda por ciclo).
  const externalReference = buildMensalidadeReference(userId, plan, cycle);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDate = tomorrow.toISOString().split("T")[0];

  const description =
    chargedValue !== cyclePrice.asaasValue
      ? `${planRow.asaas_description} (${cycle}, promoção)`
      : `${planRow.asaas_description} (${cycle})`;

  let invoiceUrl = "";
  let pixQrCode: string | undefined;
  let pixPayload: string | undefined;
  let subscriptionId: string | undefined;
  let paymentId: string | undefined;
  let installmentCount: number | undefined;

  if (billingType === "CREDIT_CARD") {
    installmentCount = cyclePrice.months; // 1 (mensal), 6 (semestral) ou 12 (anual)
    const payment = await createPayment(
      installmentCount > 1
        ? {
            customer: customerId,
            billingType: "CREDIT_CARD",
            // Parcelamento: totalValue + installmentCount (Asaas divide automaticamente)
            totalValue: chargedValue,
            installmentCount,
            dueDate,
            description,
            externalReference,
          }
        : {
            customer: customerId,
            billingType: "CREDIT_CARD",
            // Pagamento avulso (mensal): usa `value`, sem installmentCount
            value: chargedValue,
            dueDate,
            description,
            externalReference,
          },
    );
    paymentId = payment.id;
    invoiceUrl = payment.invoiceUrl;
    if (installmentCount === 1) installmentCount = undefined;
  } else {
    // ── Fluxo recorrente (PIX/BOLETO) ──
    const subscription = await createSubscription({
      customer: customerId,
      billingType,
      value: chargedValue,
      nextDueDate: dueDate,
      cycle: ASAAS_CYCLE[cycle],
      description,
      externalReference,
    });
    subscriptionId = subscription.id;

    await supabase
      .from("profiles")
      .update({ asaas_subscription_id: subscription.id })
      .eq("id", userId);

    // Busca o 1º pagamento para invoiceUrl (+ QR se PIX).
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const payments = await getSubscriptionPayments(subscription.id);
      if (payments.length > 0) {
        invoiceUrl = payments[0].invoiceUrl;
        if (billingType === "PIX" && payments[0].id) {
          try {
            const pixData = await getPaymentPixQrCode(payments[0].id);
            pixQrCode = pixData.encodedImage;
            pixPayload = pixData.payload;
          } catch (pixErr) {
            console.warn("[checkout] Could not fetch PIX QR code:", pixErr);
          }
        }
      }
    } catch (err) {
      console.warn("[checkout] Could not fetch payment invoiceUrl:", err);
    }
  }

  // 3. Salva promo no profile (se houve).
  if (promoCodeId) {
    await supabase
      .from("profiles")
      // promo_code_id existe (migration 37) mas falta no database.types.ts — cast.
      .update({ promo_code_id: promoCodeId } as never)
      .eq("id", userId);
  }

  return {
    subscriptionId,
    paymentId,
    customerId,
    invoiceUrl,
    billingType,
    pixQrCode,
    pixPayload,
    chargedValue,
    installmentCount,
    promoCodeId,
  };
}
