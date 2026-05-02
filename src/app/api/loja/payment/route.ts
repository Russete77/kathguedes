import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/loja/payment
 * Cria cobrança Pix via Asaas para um pedido da loja.
 *
 * Body: { orderId: string }
 * Response: { paymentId, pixQrCode, pixPayload, invoiceUrl, expirationDate }
 *
 * Se Asaas não estiver configurado, retorna dados para pagamento manual via Pix.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { orderId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { orderId } = body;
  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Buscar pedido
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (orderErr || !orderData) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Type assertion needed until Supabase types are auto-generated
  const order = orderData as unknown as {
    id: string;
    status: string;
    total_cents: number;
  };

  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "Pedido já processado", status: order.status },
      { status: 400 },
    );
  }

  const totalReais = order.total_cents / 100;

  // Verificar se Asaas está configurado
  const asaasKey = process.env.ASAAS_API_KEY;
  if (!asaasKey) {
    // Retorna dados para pagamento manual via Pix
    return NextResponse.json({
      method: "manual_pix",
      total: totalReais,
      pixKey: process.env.PIX_KEY || null,
      pixName: process.env.PIX_NAME || "KathApp",
      instructions:
        "Faça um Pix no valor acima para a chave indicada e envie o comprovante pelo WhatsApp.",
    });
  }

  // ── Criar cobrança via Asaas ──
  try {
    const { createCustomer, getPaymentPixQrCode } = await import(
      "@/lib/asaas/client"
    );
    const { ASAAS_CONFIG } = await import("@/lib/asaas/config");

    // Buscar ou criar customer no Asaas
    const user = await currentUser();
    const userName = user?.fullName || user?.firstName || "Cliente KathApp";
    const userEmail =
      user?.emailAddresses?.[0]?.emailAddress || "cliente@kathapp.com";

    // Verificar se já tem asaas_customer_id no perfil
    const { data: profileData } = await supabase
      .from("profiles")
      .select("asaas_customer_id")
      .eq("id", userId)
      .single();

    const profile = profileData as unknown as { asaas_customer_id?: string } | null;
    let customerId = profile?.asaas_customer_id;

    if (!customerId) {
      const customer = await createCustomer({
        name: userName,
        email: userEmail,
      });
      customerId = customer.id;

      // Salvar no perfil
      await supabase
        .from("profiles")
        .update({ asaas_customer_id: customerId })
        .eq("id", userId);
    }

    // Criar cobrança Pix avulsa (não assinatura)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Vence amanhã
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentRes = await fetch(
      `${ASAAS_CONFIG.baseUrl}/payments`,
      {
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
          description: `Pedido KathApp Loja #${orderId.substring(0, 8).toUpperCase()}`,
          externalReference: orderId,
        }),
      },
    );

    if (!paymentRes.ok) {
      const err = await paymentRes.json().catch(() => ({}));
      console.error("[loja/payment] Asaas error:", err);
      throw new Error(`Asaas ${paymentRes.status}: ${JSON.stringify(err)}`);
    }

    const payment = await paymentRes.json();

    // Buscar QR code Pix
    const pixData = await getPaymentPixQrCode(payment.id);

    // Salvar payment_id no pedido
    await supabase
      .from("orders")
      .update({
        asaas_payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return NextResponse.json({
      method: "asaas_pix",
      paymentId: payment.id,
      invoiceUrl: payment.invoiceUrl,
      pixQrCode: pixData.encodedImage, // base64
      pixPayload: pixData.payload, // copia e cola
      expirationDate: pixData.expirationDate,
      total: totalReais,
    });
  } catch (err) {
    console.error("[loja/payment] Error:", err);
    // Fallback para Pix manual
    return NextResponse.json({
      method: "manual_pix",
      total: totalReais,
      pixKey: process.env.PIX_KEY || null,
      pixName: process.env.PIX_NAME || "KathApp",
      instructions:
        "Erro ao gerar Pix automático. Faça um Pix manualmente e envie o comprovante.",
    });
  }
}
