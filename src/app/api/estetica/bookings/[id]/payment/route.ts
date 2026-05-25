import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import type { AsaasPayment } from "@/lib/asaas/client";

/**
 * POST /api/estetica/bookings/[id]/payment
 * Gera cobrança Pix via Asaas pro booking.
 * Mesmo padrão de /api/loja/payment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { cpfCnpj?: string } = {};
  try {
    body = (await req.json()) as { cpfCnpj?: string };
  } catch {
    // body opcional — sem cpfCnpj significa "usar o do profile"
  }
  const cpfFromBody = body?.cpfCnpj;

  // F2: rate limit — cria cobrança no Asaas.
  const { allowed } = await checkRateLimitAsync(`estetica-payment:${userId}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 1 minuto." },
      { status: 429 },
    );
  }

  const supabase = createAdminSupabaseClient();

  const { data: bookingRaw } = await supabase
    .from("estetica_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .single();

  if (!bookingRaw) {
    return NextResponse.json(
      { error: "Agendamento não encontrado" },
      { status: 404 },
    );
  }

  const booking = bookingRaw as unknown as {
    id: string;
    status: string;
    total_cents: number;
    prepay_cents: number | null;
    prepay_paid_at: string | null;
    loyalty_free: boolean;
  };

  if (booking.loyalty_free) {
    return NextResponse.json({
      method: "free",
      message: "Agendamento pelo programa fidelidade — nada a pagar.",
    });
  }

  if (booking.total_cents === 0) {
    return NextResponse.json({
      method: "free",
      message: "Nada a pagar (cashback cobriu o valor).",
    });
  }

  if (booking.status !== "pending") {
    return NextResponse.json(
      { error: "Agendamento já processado", status: booking.status },
      { status: 400 },
    );
  }

  // ── Decisão do valor a cobrar via Asaas ──
  // Se prepay_cents > 0 e ainda não pago: cobra só o sinal (resto presencial).
  // Caso contrário: cobra o total (fluxo legacy).
  const prepayCents = booking.prepay_cents ?? 0;
  const isSignalPayment = prepayCents > 0 && !booking.prepay_paid_at;
  const amountCents = isSignalPayment ? prepayCents : booking.total_cents;
  const totalReais = amountCents / 100;

  if (!process.env.ASAAS_API_KEY) {
    return NextResponse.json(
      { error: "Asaas não configurado no servidor. Defina ASAAS_API_KEY." },
      { status: 500 },
    );
  }

  try {
    const { createCustomer, createPayment, getPaymentPixQrCode, AsaasApiError } =
      await import("@/lib/asaas/client");

    const user = await currentUser();
    const userName = user?.fullName || user?.firstName || "Cliente KathApp";
    const userEmail =
      user?.emailAddresses?.[0]?.emailAddress || "cliente@kathapp.com";

    // F1: PIX exige CPF/CNPJ do pagador. Lê do profile e envia ao criar customer;
    // sem documento, falha cedo com mensagem acionável.
    const { data: profileData } = await supabase
      .from("profiles")
      .select("asaas_customer_id, cpf")
      .eq("id", userId)
      .single();

    const profile = profileData as unknown as {
      asaas_customer_id?: string;
      cpf?: string | null;
    } | null;
    let customerId = profile?.asaas_customer_id;

    if (!customerId) {
      const cpfBodyDigits = (cpfFromBody ?? "").replace(/[^0-9]/g, "");
      const cpfProfileDigits = (profile?.cpf ?? "").replace(/[^0-9]/g, "");
      const cpfDigits =
        cpfBodyDigits.length === 11 || cpfBodyDigits.length === 14
          ? cpfBodyDigits
          : cpfProfileDigits;
      if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
        return NextResponse.json(
          {
            error: "cpf_required",
            message:
              "Precisamos do seu CPF/CNPJ para gerar o Pix. Informe abaixo.",
          },
          { status: 422 },
        );
      }
      const customer = await createCustomer({
        name: userName,
        email: userEmail,
        cpfCnpj: cpfDigits,
      });
      customerId = customer.id;
      const updates: { asaas_customer_id: string; cpf?: string } = {
        asaas_customer_id: customerId,
      };
      if (cpfBodyDigits && !cpfProfileDigits) updates.cpf = cpfDigits;
      await supabase.from("profiles").update(updates).eq("id", userId);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    let payment: AsaasPayment;
    try {
      payment = await createPayment({
        customer: customerId,
        billingType: "PIX",
        value: totalReais,
        dueDate: dueDateStr,
        description: isSignalPayment
          ? `Kath Estética — Sinal Agendamento #${booking.id.substring(0, 8).toUpperCase()}`
          : `Kath Estética — Agendamento #${booking.id.substring(0, 8).toUpperCase()}`,
        externalReference: `estetica:${booking.id}`,
      });
    } catch (asaasErr) {
      if (asaasErr instanceof AsaasApiError && asaasErr.status >= 400 && asaasErr.status < 500) {
        console.error("[estetica/payment] Asaas validation error:", asaasErr.body);
        return NextResponse.json(
          {
            error: "payment_validation",
            message:
              asaasErr.description ??
              "Dados de pagamento recusados. Confira o CPF/CNPJ.",
          },
          { status: 422 },
        );
      }
      throw asaasErr;
    }

    const pixData = await getPaymentPixQrCode(payment.id);

    await supabase
      .from("estetica_bookings")
      .update({
        asaas_payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    return NextResponse.json({
      method: "asaas_pix",
      paymentId: payment.id,
      invoiceUrl: payment.invoiceUrl,
      pixQrCode: pixData.encodedImage,
      pixPayload: pixData.payload,
      expirationDate: pixData.expirationDate,
      total: totalReais,
      isSignal: isSignalPayment,
      remainingReais: isSignalPayment
        ? (booking.total_cents - prepayCents) / 100
        : 0,
    });
  } catch (err) {
    console.error("[estetica/payment] Error:", err);
    return NextResponse.json(
      {
        error: "Erro ao gerar cobrança Pix no Asaas",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
