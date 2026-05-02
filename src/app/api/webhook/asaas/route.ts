import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import {
  verifyWebhookToken,
  planTierFromValue,
  type AsaasWebhookPayload,
  type AsaasPaymentEvent,
} from "@/lib/asaas/webhook";

/**
 * POST /api/webhook/asaas
 * Processa eventos de pagamento do Asaas.
 * Atualiza plan_tier e subscription_status no profiles.
 *
 * Docs: https://docs.asaas.com/docs/payment-events
 */
export async function POST(req: NextRequest) {
  // 1. Verificar autenticidade do webhook
  const token = req.headers.get("asaas-access-token");
  if (!verifyWebhookToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let payload: AsaasWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, payment } = payload;
  if (!payment?.customer) {
    return NextResponse.json({ error: "Missing customer" }, { status: 400 });
  }

  // 3. Supabase admin client (bypass RLS)
  const supabase = createAdminSupabaseClient();

  // 3.5 Idempotency atômica — INSERT ON CONFLICT.
  // Asaas reentrega webhooks ao receber 5xx ou timeout. Um SELECT-then-INSERT
  // sequencial deixa janela de race onde duas execuções paralelas processam o
  // mesmo evento. Confiamos na PRIMARY KEY (payment_id) de webhook_events:
  // o INSERT falha se já existe → tratamos como duplicata.
  const idempotencyKey = `${payment.id}:${event}`;
  const { error: insertError } = await supabase
    .from("webhook_events")
    .insert({ payment_id: idempotencyKey, event });

  if (insertError) {
    // 23505 = unique_violation no Postgres. Qualquer outra falha é problema real.
    if (insertError.code === "23505") {
      console.log(`[webhook] Already processed ${idempotencyKey}, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhook] Failed to record event:", insertError);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  // 4. Se for pagamento de booking da estética, processa e retorna
  const extRef = payment.externalReference || "";
  if (extRef.startsWith("estetica:")) {
    const bookingId = extRef.replace("estetica:", "");
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const { data: booking } = await supabase
        .from("estetica_bookings")
        .select("id, user_id, estetica_services(title)")
        .eq("id", bookingId)
        .single();

      if (booking) {
        await supabase
          .from("estetica_bookings")
          .update({
            status: "confirmed",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", bookingId);

        notifyUser(booking.user_id as string, {
          title: "Pagamento confirmado!",
          body: `Agendamento da estética confirmado. Até logo!`,
          icon: "Check",
          url: "/kath-estetica/meus-agendamentos",
        }).catch(() => {});
      }
    }
    return NextResponse.json({ received: true });
  }

  // 5. Buscar profile pelo asaas_customer_id (fluxo de assinatura)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, plan_tier")
    .eq("asaas_customer_id", payment.customer)
    .single();

  if (!profile) {
    console.warn(`[webhook] Customer ${payment.customer} not found in profiles`);
    return NextResponse.json({ received: true });
  }

  // 5. Processar evento
  const handlers: Partial<Record<AsaasPaymentEvent, () => Promise<void>>> = {
    // Pagamento confirmado → ativar plano + criar consultoria VIP
    async PAYMENT_CONFIRMED() {
      const newTier = planTierFromValue(payment.value);
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 30);

      await supabase
        .from("profiles")
        .update({
          plan_tier: newTier,
          subscription_status: "active",
          subscription_ends_at: endsAt.toISOString(),
          asaas_subscription_id: payment.subscription,
        })
        .eq("id", profile.id);

      // ── Auto-criar consultoria para VIP ──
      if (newTier === "vip") {
        // Verificar se já tem consultoria ativa (pending ou in_progress)
        const { data: existingConsultation } = await supabase
          .from("consultations")
          .select("id")
          .eq("user_id", profile.id)
          .in("status", ["pending", "in_progress"])
          .limit(1)
          .maybeSingle();

        if (!existingConsultation) {
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + 30);

          await supabase.from("consultations").insert({
            user_id: profile.id,
            package_type: "mensal",
            status: "pending",
            valid_until: validUntil.toISOString(),
          });

          notifyUser(profile.id, {
            title: "Sua consultoria está disponível!",
            body: "Preencha a ficha de anamnese para a Kath montar seu plano personalizado de treino e dieta.",
            icon: "ClipboardList",
            url: "/consultoria/anamnese",
          }).catch(() => {});
        }
      }

      notifyUser(profile.id, {
        title: "Pagamento confirmado!",
        body: `Seu plano ${newTier.toUpperCase()} está ativo. Aproveite!`,
        icon: "Check",
        url: "/dashboard",
      }).catch(() => {});
    },

    // Pagamento recebido (saldo disponível) → manter ativo
    async PAYMENT_RECEIVED() {
      await supabase
        .from("profiles")
        .update({ subscription_status: "active" })
        .eq("id", profile.id);
    },

    // Pagamento atrasado → marcar past_due
    async PAYMENT_OVERDUE() {
      await supabase
        .from("profiles")
        .update({ subscription_status: "past_due" })
        .eq("id", profile.id);

      notifyUser(profile.id, {
        title: "Pagamento pendente",
        body: "Sua assinatura está com pagamento atrasado. Regularize para manter o acesso.",
        icon: "AlertTriangle",
        url: "/planos",
      }).catch(() => {});
    },

    // Assinatura cancelada/removida → agendar downgrade
    async PAYMENT_DELETED() {
      await supabase
        .from("profiles")
        .update({ subscription_status: "canceled" })
        .eq("id", profile.id);
    },

    // Reembolso → downgrade imediato para free
    async PAYMENT_REFUNDED() {
      await supabase
        .from("profiles")
        .update({
          plan_tier: "free",
          subscription_status: "canceled",
          asaas_subscription_id: null,
        })
        .eq("id", profile.id);
    },

    // Reembolso parcial → manter plano mas logar
    async PAYMENT_PARTIALLY_REFUNDED() {
      console.warn(
        `[webhook] Partial refund for ${profile.id}, payment ${payment.id}`
      );
    },
  };


  // Dispatch — se nao temos handler para o evento, apenas logamos e retornamos 200
  // (Asaas requer 2xx para nao reentregar).
  const handler = handlers[event as AsaasPaymentEvent];
  if (handler) {
    try {
      await handler();
    } catch (err) {
      console.error("[webhook] Handler error:", { event, payment_id: payment.id, err });
    }
  } else {
    console.log(`[webhook] No handler for event ${event}, skipping`);
  }

  return NextResponse.json({ received: true });
}
