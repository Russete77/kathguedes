import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import {
  verifyWebhookToken,
  type AsaasWebhookPayload,
} from "@/lib/asaas/webhook";
import { parseExternalReference } from "@/lib/asaas/external-reference";
import { planTierFromValue, getCashbackPct } from "@/lib/billing/plans";
import { recordRevenueStream, refundRevenueStream } from "@/lib/billing/revenue";
import { creditWalletCents } from "@/lib/billing/wallet";
import { handleApiError } from "@/lib/api-error";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * POST /api/webhook/asaas
 * Processa eventos de pagamento do Asaas.
 * Atualiza plan_tier e subscription_status no profiles, alimenta revenue_streams,
 * dispara compute_commissions, credita cashback (mensalidades).
 *
 * Idempotência: tabela webhook_events com PK (payment_id:event).
 * Em erro de handler: retorna 5xx para Asaas reentregar.
 *
 * Docs: https://docs.asaas.com/docs/payment-events
 */
export async function POST(req: NextRequest) {
  try {
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
    if (!payment?.id) {
      return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 3. Idempotência atômica via webhook_events.
    // PAYMENT_CONFIRMED e PAYMENT_RECEIVED representam o MESMO "dinheiro entrou"
    // e o Asaas dispara ambos para um mesmo pagamento. Colapsamos numa chave
    // única (`<id>:paid`) para NÃO processar duas vezes (evita cashback/revenue/
    // comissões em dobro). Os demais eventos mantêm chave por evento.
    const isPositive = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
    const idempotencyKey = isPositive ? `${payment.id}:paid` : `${payment.id}:${event}`;
    const { error: insertError } = await supabase
      .from("webhook_events")
      .insert({ payment_id: idempotencyKey, event });

    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[webhook] Already processed ${idempotencyKey}, skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("[webhook] Failed to record event:", insertError);
      return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
    }

    // 4. Roteamento via externalReference
    const ref = parseExternalReference(payment.externalReference);

    // 5. Eventos não-positivos (overdue, deleted, refunded) tratados antes
    if (event === "PAYMENT_OVERDUE") {
      if (payment.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", payment.customer)
          .single();
        if (profile) {
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
        }
      }
      return NextResponse.json({ received: true });
    }

    if (event === "PAYMENT_DELETED") {
      if (payment.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", payment.customer)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "canceled" })
            .eq("id", profile.id);
        }
      }
      return NextResponse.json({ received: true });
    }

    if (event === "PAYMENT_REFUNDED") {
      // Marcar revenue_stream como refunded (e allocations como failed)
      const { data: _existingStreamRaw } = await supabase
        .from("revenue_streams")
        .select("id, type")
        .eq("asaas_payment_id", payment.id)
        .maybeSingle();
      const existingStream = _existingStreamRaw as unknown as { id: string; type: string } | null;

      if (existingStream) {
        await refundRevenueStream(existingStream.id);
      }

      // Se era mensalidade, downgrade do profile
      if ((!existingStream || existingStream.type === "mensalidade") && payment.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", payment.customer)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({
              plan_tier: "free",
              subscription_status: "canceled",
              asaas_subscription_id: null,
            })
            .eq("id", profile.id);
        }
      }
      return NextResponse.json({ received: true });
    }

    if (event === "PAYMENT_PARTIALLY_REFUNDED") {
      console.warn(`[webhook] Partial refund payment ${payment.id} — manual review recommended`);
      return NextResponse.json({ received: true });
    }

    // 6. PAYMENT_CONFIRMED ou PAYMENT_RECEIVED → fluxo positivo
    if (event !== "PAYMENT_CONFIRMED" && event !== "PAYMENT_RECEIVED") {
      console.log(`[webhook] No handler for event ${event}, skipping`);
      return NextResponse.json({ received: true });
    }

    // Roteamento por externalReference
    if (!ref) {
      console.warn("[webhook] payment without externalReference", { id: payment.id });
      return NextResponse.json({ received: true });
    }

    try {
      if (ref.type === "estetica") {
        await handleEsteticaPayment(supabase, payment, ref.reference_id);
      } else if (ref.type === "loja") {
        await handleLojaPayment(supabase, payment, ref.reference_id);
      } else {
        // mensalidade
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

    return NextResponse.json({ received: true });
  } catch (err) {
    // Em erro: retornar 5xx para Asaas reentregar (idempotência protege contra duplicação)
    return handleApiError(err, "POST /api/webhook/asaas");
  }
}

// ============================================
// Handlers por tipo
// ============================================

type SupabaseAdmin = ReturnType<typeof createAdminSupabaseClient>;

async function handleEsteticaPayment(
  supabase: SupabaseAdmin,
  payment: AsaasWebhookPayload["payment"],
  bookingId: string,
) {
  const { data: _bookingRaw } = await supabase
    .from("estetica_bookings")
    .select(
      "id, user_id, total_cents, prepay_cents, prepay_paid_at, paid_at, cashback_used_cents, service_id, estetica_services(cost_cents)",
    )
    .eq("id", bookingId)
    .single();
  type BookingRow = {
    id: string;
    user_id: string;
    total_cents: number;
    prepay_cents: number | null;
    prepay_paid_at: string | null;
    paid_at: string | null;
    cashback_used_cents: number | null;
    service_id: string;
    estetica_services: { cost_cents: number } | null;
  };
  const booking = _bookingRaw as unknown as BookingRow | null;

  if (!booking) {
    console.error("[webhook] estetica booking not found", { bookingId });
    return;
  }

  // ── Decidir: pagamento de sinal ou pagamento integral? ──
  // Comparamos o valor recebido com o sinal esperado / total esperado.
  // Margem de 1 centavo para arredondamento entre Postgres int e Asaas Decimal.
  const receivedCents = Math.round(payment.value * 100);
  const prepayCents = booking.prepay_cents ?? 0;
  const remainingAfterSignal = booking.total_cents - prepayCents;
  const isSignalPayment =
    prepayCents > 0 &&
    !booking.prepay_paid_at &&
    Math.abs(receivedCents - prepayCents) <= 1 &&
    remainingAfterSignal > 0;

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: "confirmed",
    updated_at: nowIso,
  };
  if (isSignalPayment) {
    // Apenas marca sinal pago — paid_at fica null até admin/quitação total.
    update.prepay_paid_at = nowIso;
  } else {
    // Pagamento integral (ou sinal == total quando prepay_pct = 100).
    update.paid_at = nowIso;
    if (prepayCents > 0 && !booking.prepay_paid_at) update.prepay_paid_at = nowIso;
  }

  await supabase.from("estetica_bookings").update(update).eq("id", bookingId);

  const serviceCost = booking.estetica_services?.cost_cents ?? 0;

  // O revenue stream sempre registra o valor efetivamente pago neste evento
  // (sinal OU total). Quando o restante for quitado presencialmente, o admin
  // pode lançar manualmente — ou cobrir via futura action de "marcar pago".
  await recordRevenueStream({
    type: "estetica",
    category: isSignalPayment ? "signal" : null,
    user_id: booking.user_id,
    reference_type: "booking",
    reference_id: bookingId,
    asaas_payment_id: payment.id,
    // Em pagamento integral via app, somamos cashback ao gross (modelo legacy).
    // Em sinal, gross == valor do sinal — cashback continua refletido no total.
    gross_cents: isSignalPayment
      ? receivedCents
      : receivedCents + (booking.cashback_used_cents ?? 0),
    cost_cents: isSignalPayment ? 0 : serviceCost,
    cashback_used_cents: isSignalPayment ? 0 : booking.cashback_used_cents ?? 0,
    occurred_at: nowIso,
  });

  notifyUser(booking.user_id, {
    title: isSignalPayment ? "Sinal confirmado!" : "Pagamento confirmado!",
    body: isSignalPayment
      ? `Sinal recebido. Restante de R$ ${(remainingAfterSignal / 100).toFixed(2)} na entrega.`
      : "Agendamento da estética confirmado. Até logo!",
    icon: "Check",
    url: "/kath-estetica/meus-agendamentos",
  }).catch(() => {});
}

async function handleLojaPayment(
  supabase: SupabaseAdmin,
  payment: AsaasWebhookPayload["payment"],
  orderId: string,
) {
  const { data: _orderRaw } = await supabase
    .from("orders")
    .select("id, user_id, items, cashback_used_cents")
    .eq("id", orderId)
    .single();
  type OrderItem = { product_id: string; quantity: number; cost_cents?: number; module?: string; price_cents: number };
  type OrderRow = { id: string; user_id: string; items: OrderItem[] | null; cashback_used_cents: number | null };
  const order = _orderRaw as unknown as OrderRow | null;

  if (!order) {
    console.error("[webhook] loja order not found", { orderId });
    return;
  }

  await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), asaas_payment_id: payment.id })
    .eq("id", orderId);

  const items = order.items ?? [];
  const totalCost = items.reduce((sum, it) => sum + (it.cost_cents ?? 0) * it.quantity, 0);
  const dominantModule = computeDominantModule(items);

  await recordRevenueStream({
    type: "loja",
    category: dominantModule,
    user_id: order.user_id,
    reference_type: "order",
    reference_id: orderId,
    asaas_payment_id: payment.id,
    gross_cents: Math.round(payment.value * 100) + (order.cashback_used_cents ?? 0),
    cost_cents: totalCost,
    cashback_used_cents: order.cashback_used_cents ?? 0,
    occurred_at: new Date().toISOString(),
  });

  notifyUser(order.user_id, {
    title: "Pagamento confirmado!",
    body: "Seu pedido na loja foi confirmado.",
    icon: "Check",
    url: "/loja/pedidos",
  }).catch(() => {});
}

async function handleMensalidadePayment(
  supabase: SupabaseAdmin,
  payment: AsaasWebhookPayload["payment"],
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    console.warn("[webhook] mensalidade profile not found", { userId });
    return;
  }

  const newTier = await planTierFromValue(payment.value);
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

  // Revenue stream + commissions
  const stream = await recordRevenueStream({
    type: "mensalidade",
    category: newTier,
    user_id: profile.id,
    reference_type: "subscription",
    reference_id: userId,
    asaas_payment_id: payment.id,
    gross_cents: Math.round(payment.value * 100),
    cost_cents: 0,
    cashback_used_cents: 0,
    occurred_at: new Date().toISOString(),
  });

  // Cashback imediato em mensalidade
  const cashbackPct = await getCashbackPct(newTier);
  const cashbackCents = Math.floor(Math.round(payment.value * 100) * cashbackPct / 100);
  if (cashbackCents > 0) {
    await creditWalletCents({
      userId: profile.id,
      amountCents: cashbackCents,
      sourceStreamId: stream.id,
    });
  }

  // Auto-criar consultoria
  await ensureConsultationForTier(supabase, profile.id, newTier);

  notifyUser(profile.id, {
    title: "Pagamento confirmado!",
    body: `Seu plano ${newTier.toUpperCase()} está ativo. Aproveite!`,
    icon: "Check",
    url: "/dashboard",
  }).catch(() => {});
}

// ============================================
// Helpers
// ============================================

function computeDominantModule(
  items: Array<{ module?: string }>,
): string | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const it of items) {
    const m = it.module ?? "geral";
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let max = 0;
  let dom: string | null = null;
  for (const [k, v] of counts) {
    if (v > max) { max = v; dom = k; }
  }
  return dom;
}

async function ensureConsultationForTier(
  supabase: SupabaseAdmin,
  userId: string,
  tier: PlanTier,
) {
  const tierToPackage: Partial<Record<PlanTier, "mensal" | "premium">> = {
    plano2: "mensal",
    plano3: "mensal",
    atleta: "premium",
  };
  const packageType = tierToPackage[tier];
  if (!packageType) return;

  const { data: existing } = await supabase
    .from("consultations")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["pending", "in_progress"])
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  await supabase.from("consultations").insert({
    user_id: userId,
    package_type: packageType,
    status: "pending",
    valid_until: validUntil.toISOString(),
  });

  notifyUser(userId, {
    title: "Sua consultoria está disponível!",
    body: "Preencha a ficha de anamnese para a Kath montar seu plano personalizado.",
    icon: "ClipboardList",
    url: "/consultoria/anamnese",
  }).catch(() => {});
}
