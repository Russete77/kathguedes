import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { type EsteticaService, finalPriceCents } from "@/lib/estetica/types";
import { getEsteticaDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents, spendWalletCents } from "@/lib/billing/wallet";
import { clampCashbackCents, computeAmountPaidCash } from "@/lib/billing/cashback-utils";
import { notifyAdmins } from "@/lib/notifications";
import type { PlanTier } from "@/lib/supabase/types";
import { getServicePricing } from "@/lib/estetica/pricing";

const bookingSchema = z.object({
  service_id: z.string().uuid(),
  // tipo de moto: obrigatório para serviços com matriz, opcional para legacy
  vehicle_type_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().min(10),
  vehicle_brand: z.string().min(1).max(80),
  vehicle_model: z.string().min(1).max(120),
  vehicle_plate: z.string().min(4).max(15),
  vehicle_color: z.string().max(40).nullable().optional(),
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().min(8).max(20),
  use_loyalty: z.coerce.boolean().default(false),
  use_cashback_cents: z.coerce.number().int().min(0).default(0),
});

/**
 * POST /api/estetica/bookings
 *
 * Cria agendamento. Recalcula preço server-side via `plans` table,
 * aplica cashback (clamp 50% + saldo), valida slot via RPC.
 * Cashback é gasto após insert; webhook PAYMENT_CONFIRMED creditará novo
 * cashback APÓS booking.status='done' (Task 14).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimitAsync(`estetica-booking:${userId}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde 1 minuto." },
        { status: 429 },
      );
    }

    const parsed = bookingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const supabase = createAdminSupabaseClient();

    // Servico
    const { data: serviceRaw } = await supabase
      .from("estetica_services")
      .select("*")
      .eq("id", body.service_id)
      .eq("is_active", true)
      .single();

    if (!serviceRaw) {
      return NextResponse.json({ error: "Servico nao encontrado" }, { status: 404 });
    }
    const service = serviceRaw as unknown as EsteticaService;

    // Bloquear bookings para serviços walk-in only (lavagem simples).
    if (service.requires_booking === false) {
      return NextResponse.json(
        { error: "Este servico nao aceita agendamento. Passe na loja." },
        { status: 400 },
      );
    }

    // Profile + tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();
    const planTier = (profile?.plan_tier as PlanTier | undefined) ?? "free";

    // Gating: requires_paid_plan
    if (service.requires_paid_plan && planTier === "free") {
      return NextResponse.json(
        { error: "Este servico exige um plano pago. Veja /planos." },
        { status: 403 },
      );
    }

    // Slot disponivel (RPC)
    const dateStr = body.scheduled_at.slice(0, 10);
    const { data: availableSlots } = await supabase.rpc("get_available_slots", {
      p_date: dateStr,
      p_duration_min: service.duration_min,
    });
    const slotsArr = (availableSlots || []) as string[];
    const requestedMs = new Date(body.scheduled_at).getTime();
    const slotAvailable = slotsArr.some(s => new Date(s).getTime() === requestedMs);
    if (!slotAvailable) {
      return NextResponse.json(
        { error: "Horario nao esta mais disponivel" },
        { status: 409 },
      );
    }

    // Loyalty
    let loyaltyFree = false;
    if (body.use_loyalty && service.eligible_for_loyalty) {
      const { data: eligible } = await supabase.rpc("check_loyalty_eligibility", {
        p_user_id: userId,
      });
      if (eligible === true) {
        loyaltyFree = true;
      } else {
        return NextResponse.json(
          { error: "Beneficio fidelidade nao disponivel" },
          { status: 400 },
        );
      }
    }

    // ── Resolver preço base via matriz quando vehicle_type_id vier ──
    // Se não vier (compat com clients antigos), cai no service.price_cents.
    // A matriz é a fonte oficial quando há row em estetica_service_prices.
    const pricing = await getServicePricing(service.id);
    const pricingOption = body.vehicle_type_id
      ? pricing.options.find((o) => o.vehicle_type.id === body.vehicle_type_id)
      : null;

    // Se o serviço tem matriz mas o cliente não escolheu tipo: rejeitar.
    // Mantemos fallback apenas para serviços que ainda não foram migrados.
    if (pricing.options.length > 0 && !pricingOption) {
      return NextResponse.json(
        { error: "Selecione o tipo da sua moto para este serviço." },
        { status: 400 },
      );
    }

    const basePriceCents = pricingOption?.price_cents ?? service.price_cents;
    const baseServiceForDiscount = { price_cents: basePriceCents };

    // Recalcular preco aplicando desconto do plano sobre o preço da matriz
    const discountPct = await getEsteticaDiscountPct(planTier);
    const finalCents = finalPriceCents(baseServiceForDiscount, discountPct);
    const planDiscountCents = basePriceCents - finalCents;
    const grossCents = loyaltyFree ? 0 : finalCents;

    // Cashback
    let cashbackUsedCents = 0;
    if (!loyaltyFree && grossCents > 0 && body.use_cashback_cents > 0) {
      const activeBalance = await getWalletActiveCents(userId);
      cashbackUsedCents = clampCashbackCents({
        requested: body.use_cashback_cents,
        gross: grossCents,
        activeBalance,
      });
    }
    const totalCents = computeAmountPaidCash({ gross: grossCents, cashbackUsed: cashbackUsedCents });

    // ── Sinal (prepay) baseado na payment_rule ──
    // Aplica apenas quando há valor a pagar (totalCents > 0). Vitrificação:
    // prepay_pct = 50; demais serviços: prepay_pct = 0 (pago presencial).
    const rule = pricing.payment_rule;
    let prepayCents = 0;
    if (totalCents > 0 && rule && rule.require_app_prepay && rule.prepay_pct > 0) {
      const pct = Math.min(100, Math.max(0, rule.prepay_pct));
      prepayCents = Math.min(totalCents, Math.round((totalCents * pct) / 100));
    }
    const remainingCents = totalCents - prepayCents;

    // Insert booking
    const { data: booking, error } = await supabase
      .from("estetica_bookings")
      .insert({
        user_id: userId,
        service_id: service.id,
        vehicle_type_id: body.vehicle_type_id ?? null,
        scheduled_at: body.scheduled_at,
        duration_min: service.duration_min,
        vehicle_brand: body.vehicle_brand,
        vehicle_model: body.vehicle_model,
        vehicle_plate: body.vehicle_plate,
        vehicle_color: body.vehicle_color ?? null,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        status: totalCents === 0 ? "confirmed" : "pending",
        price_cents: basePriceCents,
        plan_discount_cents: planDiscountCents,
        loyalty_free: loyaltyFree,
        cashback_used_cents: cashbackUsedCents,
        total_cents: totalCents,
        prepay_cents: prepayCents,
        remaining_cents: remainingCents,
        paid_at: totalCents === 0 ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !booking) {
      // EXCLUDE constraint (no_overlapping_bookings): outra reserva concorrente
      // levou o slot entre o get_available_slots e o insert. O DB e a fonte de
      // verdade contra double-booking, nao o check de leitura acima.
      if (error?.code === "23P01") {
        return NextResponse.json(
          { error: "Horario nao esta mais disponivel" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error?.message ?? "create_fail" }, { status: 500 });
    }

    // C3: o cashback de um booking `pending` (aguardando sinal/pagamento) e
    // debitado so na confirmacao do pagamento (handleEsteticaPayment), de forma
    // idempotente — adiar evita queimar o saldo de um sinal nunca pago.
    // EXCECAO: quando o cashback cobre 100% (totalCents === 0) o booking ja nasce
    // confirmado/pago e NAO havera webhook, entao debitamos agora.
    if (totalCents === 0 && cashbackUsedCents > 0) {
      try {
        await spendWalletCents({ userId, amountCents: cashbackUsedCents });
      } catch (walletErr) {
        console.error("[estetica/bookings] wallet spend failed; rolling back booking", walletErr);
        await supabase.from("estetica_bookings").update({ status: "canceled" }).eq("id", booking.id);
        return NextResponse.json({ error: "wallet_spend_failed" }, { status: 500 });
      }
    }

    // Notificar admins (fire-and-forget — não bloqueia a resposta ao cliente).
    const scheduledLabel = new Date(body.scheduled_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const bookingStatusLabel =
      totalCents === 0 ? "(grátis, já confirmado)" : "(aguardando pagamento)";
    notifyAdmins({
      title: "Novo agendamento na estética",
      body: `${service.title} — ${body.customer_name} em ${scheduledLabel} ${bookingStatusLabel}`,
      icon: "Calendar",
      url: "/admin/kath-estetica/agendamentos",
    }).catch((err) => {
      console.error("[estetica/bookings] notifyAdmins failed", err);
    });

    return NextResponse.json({
      ok: true,
      booking_id: booking.id,
      status: totalCents === 0 ? "confirmed" : "pending",
      total_cents: totalCents,
      prepay_cents: prepayCents,
      remaining_cents: remainingCents,
      requires_prepay: prepayCents > 0,
    });
  } catch (err) {
    return handleApiError(err, "POST /api/estetica/bookings");
  }
}
