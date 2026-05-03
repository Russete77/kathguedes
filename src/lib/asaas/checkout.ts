import {
  createCustomer,
  createSubscription,
  getSubscriptionPayments,
  getPaymentPixQrCode,
} from "./client";
import { getPlan } from "@/lib/billing/plans";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Fluxo completo de checkout:
 * 1. Cria customer no Asaas (se não existe)
 * 2. Cria subscription no Asaas (gera 1º pagamento automaticamente)
 * 3. Busca invoiceUrl do 1º pagamento para o usuário pagar
 * 4. Atualiza profile no Supabase com asaas_customer_id
 *
 * O plan_tier NÃO é ativado aqui — isso acontece pelo webhook PAYMENT_CONFIRMED.
 */

interface CheckoutParams {
  userId: string; // Clerk user ID
  fullName: string;
  email: string;
  plan: Exclude<PlanTier, "free">;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
}

interface CheckoutResult {
  subscriptionId: string;
  customerId: string;
  invoiceUrl: string;
  billingType: string;
  pixQrCode?: string; // base64 encoded QR code image for PIX
  pixPayload?: string; // PIX copia-e-cola
}

export async function processCheckout(
  params: CheckoutParams
): Promise<CheckoutResult> {
  const { userId, fullName, email, plan, billingType } = params;
  const supabase = createAdminSupabaseClient();

  // 0. Resolver plano (preço + descrição vêm da tabela `plans`, admin-editável)
  const planRow = await getPlan(plan);
  if (!planRow || !planRow.is_active || planRow.asaas_value <= 0) {
    throw new Error(`[checkout] plano inválido ou gratuito: ${plan}`);
  }

  // 1. Verificar se já tem customer no Asaas
  const { data: profile } = await supabase
    .from("profiles")
    .select("asaas_customer_id")
    .eq("id", userId)
    .single();

  let customerId = profile?.asaas_customer_id;

  // 2. Criar customer se não existe
  if (!customerId) {
    const customer = await createCustomer({
      name: fullName,
      email,
    });
    customerId = customer.id;

    // Salvar no profile
    await supabase
      .from("profiles")
      .update({ asaas_customer_id: customerId })
      .eq("id", userId);
  }

  // 3. Criar subscription (Asaas gera o 1º pagamento automaticamente)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDueDate = tomorrow.toISOString().split("T")[0];

  const subscription = await createSubscription({
    customer: customerId,
    billingType,
    value: planRow.asaas_value,
    nextDueDate,
    cycle: "MONTHLY",
    description: planRow.asaas_description,
    externalReference: userId,
  });

  // 4. Salvar subscription ID no profile
  await supabase
    .from("profiles")
    .update({
      asaas_subscription_id: subscription.id,
    })
    .eq("id", userId);

  // 5. Buscar o 1º pagamento para obter invoiceUrl
  let invoiceUrl = "";
  let pixQrCode: string | undefined;
  let pixPayload: string | undefined;

  try {
    // Pequeno delay para o Asaas gerar o pagamento
    await new Promise((r) => setTimeout(r, 1500));

    const payments = await getSubscriptionPayments(subscription.id);
    if (payments.length > 0) {
      invoiceUrl = payments[0].invoiceUrl;

      // Se PIX, buscar QR code
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

  return {
    subscriptionId: subscription.id,
    customerId,
    invoiceUrl,
    billingType,
    pixQrCode,
    pixPayload,
  };
}
