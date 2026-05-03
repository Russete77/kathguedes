import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

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

  const totalReais = booking.total_cents / 100;

  if (!process.env.ASAAS_API_KEY) {
    return NextResponse.json(
      { error: "Asaas não configurado no servidor. Defina ASAAS_API_KEY." },
      { status: 500 },
    );
  }

  try {
    const { createCustomer, getPaymentPixQrCode } = await import(
      "@/lib/asaas/client"
    );
    const { ASAAS_CONFIG } = await import("@/lib/asaas/config");

    const user = await currentUser();
    const userName = user?.fullName || user?.firstName || "Cliente KathApp";
    const userEmail =
      user?.emailAddresses?.[0]?.emailAddress || "cliente@kathapp.com";

    const { data: profileData } = await supabase
      .from("profiles")
      .select("asaas_customer_id")
      .eq("id", userId)
      .single();

    const profile = profileData as unknown as {
      asaas_customer_id?: string;
    } | null;
    let customerId = profile?.asaas_customer_id;

    if (!customerId) {
      const customer = await createCustomer({ name: userName, email: userEmail });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ asaas_customer_id: customerId })
        .eq("id", userId);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentRes = await fetch(`${ASAAS_CONFIG.baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_CONFIG.apiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: totalReais,
        dueDate: dueDateStr,
        description: `Kath Estética — Agendamento #${booking.id.substring(0, 8).toUpperCase()}`,
        externalReference: `estetica:${booking.id}`,
      }),
    });

    if (!paymentRes.ok) {
      const err = await paymentRes.json().catch(() => ({}));
      throw new Error(`Asaas ${paymentRes.status}: ${JSON.stringify(err)}`);
    }

    const payment = await paymentRes.json();
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
