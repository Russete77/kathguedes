import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import {
  verifyWebhookToken,
  type AsaasWebhookPayload,
} from "@/lib/asaas/webhook";
import { parseExternalReference, type ParsedExternalReference } from "@/lib/asaas/external-reference";
import { getPlan, getCashbackPct, CYCLE_MONTHS, type BillingCycle } from "@/lib/billing/plans";
import { recordRevenueStream, refundRevenueStream } from "@/lib/billing/revenue";
import {
  creditWalletCents,
  spendWalletCents,
  revokeWalletCreditsBySource,
  unspendWalletCredits,
} from "@/lib/billing/wallet";
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

    const { event, payment, subscription } = payload;
    // Eventos de SUBSCRIPTION_* nao tem payment, so subscription. Tratar separado.
    if (!payment?.id && !subscription?.id) {
      return NextResponse.json({ error: "Missing payment/subscription id" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 3. Idempotência atômica via webhook_events.
    // PAYMENT_CONFIRMED e PAYMENT_RECEIVED representam o MESMO "dinheiro entrou"
    // e o Asaas dispara ambos para um mesmo pagamento. Colapsamos numa chave
    // única (`<id>:paid`) para NÃO processar duas vezes (evita cashback/revenue/
    // comissões em dobro). Os demais eventos mantêm chave por evento.
    const isPositive = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
    // Subscription events usam subscription.id como chave; payment events usam payment.id.
    const resourceId = payment?.id ?? subscription?.id ?? "unknown";
    const idempotencyKey = isPositive ? `${resourceId}:paid` : `${resourceId}:${event}`;
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

    // 3.5 Subscription events — handle antes do roteamento por payment.
    if (
      event === "SUBSCRIPTION_INACTIVATED" ||
      event === "SUBSCRIPTION_DELETED"
    ) {
      const subId = subscription?.id;
      if (subId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_subscription_id", subId)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({
              subscription_status: "canceled",
              // NÃO mexer em plan_tier — user mantém acesso até subscription_ends_at.
              // Downgrade efetivo so quando expira (via UI ou cron futuro).
            })
            .eq("id", profile.id);
          notifyUser(profile.id, {
            title: "Assinatura cancelada",
            body: "Sua assinatura foi cancelada no provedor. Voce mantem acesso ate o fim do periodo ja pago.",
            icon: "AlertTriangle",
            url: "/planos",
          }).catch(() => {});
        }
      }
      return NextResponse.json({ received: true });
    }

    if (event === "SUBSCRIPTION_CREATED" || event === "SUBSCRIPTION_UPDATED") {
      // Aceitamos mas nao processamos — a criacao/atualizacao ja vem do nosso lado
      // (processCheckout cria a subscription). Webhook serve so para reconciliacao
      // no futuro caso haja edicao manual no painel Asaas.
      console.log(`[webhook] ${event} subscription=${subscription?.id}`);
      return NextResponse.json({ received: true });
    }

    if (event === "SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK") {
      console.error(`[webhook] Split divergence block on subscription=${subscription?.id} — manual review`);
      return NextResponse.json({ received: true });
    }

    // 4. A partir daqui sao payment events. Garantir que temos payment.
    if (!payment?.id) {
      console.log(`[webhook] Event ${event} sem payment, skipping`);
      return NextResponse.json({ received: true });
    }
    // Type narrow: a partir daqui o TS sabe que payment existe
    const p = payment as NonNullable<typeof payment>;

    // 4.1 Roteamento via externalReference
    const ref = parseExternalReference(p.externalReference);

    // 5. Eventos não-positivos (overdue, deleted, refunded) tratados antes
    if (event === "PAYMENT_OVERDUE") {
      if (p.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", p.customer)
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
      if (p.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", p.customer)
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
      // Busca o stream original
      const { data: _existingStreamRaw } = await supabase
        .from("revenue_streams")
        .select("id, type, reference_id, user_id")
        .eq("asaas_payment_id", p.id)
        .maybeSingle();
      const existingStream = _existingStreamRaw as unknown as {
        id: string;
        type: string;
        reference_id: string;
        user_id: string | null;
      } | null;

      if (existingStream) {
        // 1. Marca revenue_stream como refunded + allocations (draft/approved) como failed
        await refundRevenueStream(existingStream.id);

        // 2. Detecta allocations já PAID (payout manual ja foi feito) — log pra ação manual
        const { data: paidAllocs } = await supabase
          .from("commission_allocations")
          .select("id, team_member_id, amount_cents, payout_reference")
          .eq("revenue_stream_id", existingStream.id)
          .eq("status", "paid");
        if (paidAllocs && paidAllocs.length > 0) {
          console.error(
            `[webhook] REFUND com allocations já pagas — payout reversal manual necessário`,
            {
              stream_id: existingStream.id,
              payment_id: p.id,
              paid_allocations: paidAllocs,
            },
          );
        }

        // 3. Revoga cashback GANHO neste stream (créditos não-usados são zerados)
        try {
          await revokeWalletCreditsBySource(existingStream.id);
        } catch (e) {
          console.error("[webhook] revoke cashback fail", { stream: existingStream.id, e });
        }

        // 4. Trata específico por tipo de stream
        if (existingStream.type === "loja") {
          // 4a. Devolve cashback GASTO neste pedido (volta pro saldo ativo)
          try {
            await unspendWalletCredits(existingStream.id);
          } catch (e) {
            console.error("[webhook] unspend cashback fail", { stream: existingStream.id, e });
          }

          // 4b. Restaura estoque do pedido
          try {
            const { data: orderRaw } = await supabase
              .from("orders")
              .select("id, items")
              .eq("id", existingStream.reference_id)
              .single();
            const order = orderRaw as unknown as {
              id: string;
              items: Array<{ product_id: string; quantity: number }> | null;
            } | null;
            if (order?.items && order.items.length > 0) {
              await supabase.rpc("increment_stock_batch", {
                p_items: order.items.map((i) => ({
                  product_id: i.product_id,
                  quantity: i.quantity,
                })),
              });
            }
            // Marca order como cancelado
            await supabase
              .from("orders")
              .update({ status: "canceled" })
              .eq("id", existingStream.reference_id);
          } catch (e) {
            console.error("[webhook] order refund fail", { stream: existingStream.id, e });
          }

          // 4c. Notifica user
          if (existingStream.user_id) {
            notifyUser(existingStream.user_id, {
              title: "Pedido reembolsado",
              body: "Seu pedido foi reembolsado. O cashback usado voltou pro seu saldo.",
              icon: "RefreshCcw",
              url: "/loja/pedidos",
            }).catch(() => {});
          }
        }
      }

      // 5. Se era mensalidade (ou sem stream identificado), downgrade do profile
      if ((!existingStream || existingStream.type === "mensalidade") && p.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", p.customer)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({
              plan_tier: "start",
              subscription_status: "canceled",
              // Reembolso revoga o acesso IMEDIATAMENTE: zera ends_at para agora,
              // senão hasActiveAccess() liberaria enquanto ends_at antigo (futuro)
              // ainda valesse, mesmo com status 'canceled'.
              subscription_ends_at: new Date().toISOString(),
              asaas_subscription_id: null,
            })
            .eq("id", profile.id);

          notifyUser(profile.id, {
            title: "Assinatura reembolsada",
            body: "Sua assinatura foi reembolsada e cancelada. Cashback ganho foi revogado.",
            icon: "AlertTriangle",
            url: "/planos",
          }).catch(() => {});
        }
      }
      return NextResponse.json({ received: true });
    }

    if (event === "PAYMENT_PARTIALLY_REFUNDED") {
      console.warn(`[webhook] Partial refund payment ${p.id} — manual review recommended`);
      return NextResponse.json({ received: true });
    }

    // CHARGEBACK — usuario abriu disputa no cartao. Cobrir ANTES de refund acontecer
    // para flagar prejuizo potencial e bloquear o user (defesa contra fraude).
    // Doc: https://docs.asaas.com/docs/chargeback
    if (
      event === "PAYMENT_CHARGEBACK_REQUESTED" ||
      event === "PAYMENT_CHARGEBACK_DISPUTE"
    ) {
      if (p.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("asaas_customer_id", p.customer)
          .single();
        if (profile) {
          // Suspende acesso enquanto a disputa esta aberta. NAO downgrade definitivo
          // (chargeback pode ser revertido — AWAITING_CHARGEBACK_REVERSAL).
          await supabase
            .from("profiles")
            .update({ subscription_status: "past_due" })
            .eq("id", profile.id);
        }
        console.error(`[webhook] CHARGEBACK ${event} payment=${p.id} customer=${p.customer}`, {
          chargeback: p.chargeback,
        });
      }
      return NextResponse.json({ received: true });
    }

    // Chargeback revertido — restaurar acesso (se ainda nao foi PAYMENT_REFUNDED).
    if (event === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL") {
      if (p.customer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("asaas_customer_id", p.customer)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "active" })
            .eq("id", profile.id);
        }
      }
      return NextResponse.json({ received: true });
    }

    // Dunning (cobranca terceirizada) e ainda flow eventos informacionais — so log.
    if (
      event === "PAYMENT_DUNNING_RECEIVED" ||
      event === "PAYMENT_DUNNING_REQUESTED" ||
      event === "PAYMENT_BANK_SLIP_VIEWED" ||
      event === "PAYMENT_CHECKOUT_VIEWED" ||
      event === "PAYMENT_AUTHORIZED" ||
      event === "PAYMENT_ANTICIPATED" ||
      event === "PAYMENT_AWAITING_RISK_ANALYSIS" ||
      event === "PAYMENT_APPROVED_BY_RISK_ANALYSIS" ||
      event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS" ||
      event === "PAYMENT_REFUND_IN_PROGRESS" ||
      event === "PAYMENT_RESTORED" ||
      event === "PAYMENT_CREATED" ||
      event === "PAYMENT_UPDATED"
    ) {
      // Informacional — registrado em webhook_events (idempotencia) mas sem efeito.
      // Se PAYMENT_REPROVED_BY_RISK_ANALYSIS chegar, o pagamento sera estornado
      // separadamente (PAYMENT_DELETED ou PAYMENT_REFUNDED).
      return NextResponse.json({ received: true });
    }

    // 6. PAYMENT_CONFIRMED ou PAYMENT_RECEIVED → fluxo positivo
    if (event !== "PAYMENT_CONFIRMED" && event !== "PAYMENT_RECEIVED") {
      console.log(`[webhook] No handler for event ${event}, skipping`);
      return NextResponse.json({ received: true });
    }

    // Roteamento por externalReference
    if (!ref) {
      console.warn("[webhook] payment without externalReference", { id: p.id });
      return NextResponse.json({ received: true });
    }

    try {
      if (ref.type === "loja") {
        await handleLojaPayment(supabase, payment, ref.reference_id);
      } else {
        // mensalidade — ref carrega plano+ciclo (modelo semestral/anual)
        await handleMensalidadePayment(supabase, payment, ref);
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

async function handleLojaPayment(
  supabase: SupabaseAdmin,
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
  orderId: string,
) {
  const { data: _orderRaw } = await supabase
    .from("orders")
    .select("id, user_id, status, items, cashback_used_cents")
    .eq("id", orderId)
    .single();
  type OrderItem = { product_id: string; quantity: number; cost_cents?: number; module?: string; price_cents: number };
  type OrderRow = { id: string; user_id: string; status: string | null; items: OrderItem[] | null; cashback_used_cents: number | null };
  const order = _orderRaw as unknown as OrderRow | null;

  if (!order) {
    console.error("[webhook] loja order not found", { orderId });
    return;
  }

  // C3 (auditoria 2026-06-16): pedido já CANCELADO (ex.: timeout de PIX que
  // devolveu estoque e re-creditou o cashback) NÃO pode ser pago tardiamente —
  // marcaria como pago sem estoque e debitaria o cashback de novo. Ignora.
  if (order.status === "canceled") {
    console.error("[webhook] loja pagamento de pedido CANCELADO — ignorando", {
      orderId,
      paymentId: payment.id,
    });
    return;
  }

  await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), asaas_payment_id: payment.id })
    .eq("id", orderId);

  const items = order.items ?? [];
  const totalCost = items.reduce((sum, it) => sum + (it.cost_cents ?? 0) * it.quantity, 0);
  const dominantModule = computeDominantModule(items);

  const stream = await recordRevenueStream({
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

  // C3: o cashback so e debitado AGORA, na confirmacao do pagamento — nunca na
  // criacao do pedido `pending`. Idempotente: vinculado ao stream (estavel em
  // reprocessamento), spendWalletCents pula se ja gastou para este stream.
  if ((order.cashback_used_cents ?? 0) > 0) {
    await spendWalletCents({
      userId: order.user_id,
      amountCents: order.cashback_used_cents ?? 0,
      revenueStreamId: stream.id,
    });
  }

  notifyUser(order.user_id, {
    title: "Pagamento confirmado!",
    body: "Seu pedido na loja foi confirmado.",
    icon: "Check",
    url: "/loja/pedidos",
  }).catch(() => {});
}

async function handleMensalidadePayment(
  supabase: SupabaseAdmin,
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
  ref: Extract<ParsedExternalReference, { type: "mensalidade" }>,
) {
  const userId = ref.reference_id;

  // Guard: value positivo.
  if (!payment.value || payment.value <= 0) {
    console.error("[webhook] mensalidade com payment.value invalido", {
      paymentId: payment.id,
      value: payment.value,
    });
    return;
  }

  // ── Resolução do tier pela REFERÊNCIA (não pelo valor pago) ──
  // No modelo semestral/anual o valor cobrado é o total à vista; mapear valor→
  // tier daria o tier errado. O plano vem cravado no externalReference.
  const tier = ref.plan as PlanTier | undefined;
  if (!tier) {
    console.error("[webhook] mensalidade sem plano na referencia — abortando", {
      paymentId: payment.id,
      reference: userId,
    });
    return;
  }
  const planRow = await getPlan(tier);
  if (!planRow) {
    console.error("[webhook] mensalidade com plano inexistente", { tier, paymentId: payment.id });
    return;
  }
  const cycle = (
    ref.cycle === "anual" ? "anual" : ref.cycle === "mensal" ? "mensal" : "semestral"
  ) as BillingCycle;
  const periodMonths = CYCLE_MONTHS[cycle];

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("id, subscription_status, subscription_ends_at")
    .eq("id", userId)
    .single();
  const profile = profileRaw as {
    id: string;
    subscription_status: string | null;
    subscription_ends_at: string | null;
  } | null;

  if (!profile) {
    console.warn("[webhook] mensalidade profile not found", { userId });
    return;
  }

  const now = new Date();
  const isRecurring = !!payment.subscription;
  const currentEndsAt = profile.subscription_ends_at
    ? new Date(profile.subscription_ends_at)
    : null;
  const isActiveFuture =
    profile.subscription_status === "active" &&
    currentEndsAt !== null &&
    currentEndsAt.getTime() > now.getTime();

  // ── Cálculo do fim do acesso ──
  // Recorrente PIX/BOLETO (SEMIANNUALLY/YEARLY): cada cobrança do ciclo estende
  //   pelo período total (6 ou 12 meses).
  // Recorrente CREDIT_CARD (MONTHLY + maxPayments): cada parcela mensal estende
  //   1 mês — a subscription não compromete o limite total do cartão.
  // Parcelado legado (cartão sem subscription): ativa-uma-vez.
  const extensionMonths =
    isRecurring && payment.billingType === "CREDIT_CARD" ? 1 : periodMonths;

  let grantAccess = true;
  let newEndsAt: Date;
  if (isRecurring) {
    const anchor = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
    newEndsAt = new Date(anchor);
    newEndsAt.setMonth(newEndsAt.getMonth() + extensionMonths);
  } else {
    // Parcelado legado: ativa-uma-vez. Se já está ativo no futuro, não re-estende.
    if (isActiveFuture) {
      grantAccess = false;
      newEndsAt = currentEndsAt!;
    } else {
      newEndsAt = new Date(now);
      newEndsAt.setMonth(newEndsAt.getMonth() + periodMonths);
    }
  }

  if (grantAccess) {
    const profileUpdate: Record<string, unknown> = {
      plan_tier: tier,
      subscription_status: "active",
      subscription_ends_at: newEndsAt.toISOString(),
      billing_cycle: cycle,
    };
    // Só grava asaas_subscription_id no fluxo recorrente (parcelado vem null).
    if (payment.subscription) {
      profileUpdate.asaas_subscription_id = payment.subscription;
    }
    await supabase.from("profiles").update(profileUpdate).eq("id", profile.id);
  }

  // ── Receita + comissões (sempre, idempotente por asaas_payment_id) ──
  const stream = await recordRevenueStream({
    type: "mensalidade",
    category: tier,
    user_id: profile.id,
    reference_type: "subscription",
    reference_id: userId,
    asaas_payment_id: payment.id,
    gross_cents: Math.round(payment.value * 100),
    cost_cents: 0,
    cashback_used_cents: 0,
    occurred_at: now.toISOString(),
  });

  // Cashback sobre o valor efetivamente recebido neste pagamento.
  const cashbackPct = await getCashbackPct(tier);
  const cashbackCents = Math.floor((Math.round(payment.value * 100) * cashbackPct) / 100);
  if (cashbackCents > 0) {
    await creditWalletCents({
      userId: profile.id,
      amountCents: cashbackCents,
      sourceStreamId: stream.id,
    });
  }

  // Consultoria — só na ativação (não a cada parcela).
  if (grantAccess) {
    await ensureConsultationForTier(supabase, profile.id, tier, periodMonths);
  }

  notifyUser(profile.id, {
    title: "Pagamento confirmado!",
    body: `Seu plano ${planRow.name} (${cycle}) está ativo. Aproveite!`,
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
  periodMonths: number,
) {
  const tierToPackage: Partial<Record<PlanTier, "mensal" | "premium">> = {
    evolucao: "mensal",
    saude_completa: "mensal",
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

  // Validade acompanha o ciclo pago (6 ou 12 meses).
  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + periodMonths);

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
