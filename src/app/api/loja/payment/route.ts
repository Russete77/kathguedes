import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import type { AsaasPayment } from "@/lib/asaas/client";

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

  // F2: rate limit — esta rota cria cobrança no Asaas e deve ser protegida.
  const { allowed } = await checkRateLimitAsync(`loja-payment:${userId}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 1 minuto." },
      { status: 429 },
    );
  }

  let body: { orderId: string; cpfCnpj?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { orderId, cpfCnpj: cpfFromBody } = body;
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
  // Em produção, PIX manual fallback é INACEITÁVEL — esconde falha de
  // configuração/integração. Retornar 503 para alertar e abrir incidente.
  // Em preview/dev, mantém fallback para permitir UX testing sem Asaas key.
  const isProd =
    process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

  if (!asaasKey) {
    if (isProd) {
      console.error("[loja/payment] ASAAS_API_KEY missing in production", { orderId });
      return NextResponse.json(
        {
          error: "payment_provider_unavailable",
          message:
            "O processador de pagamento está temporariamente indisponível. Tente novamente em alguns minutos.",
        },
        { status: 503 },
      );
    }
    // Dev / preview: retornar dados para pagamento manual via Pix
    return NextResponse.json({
      method: "manual_pix",
      total: totalReais,
      pixKey: process.env.PIX_KEY || null,
      pixName: process.env.PIX_NAME || "KathApp",
      instructions:
        "[DEV] Faça um Pix no valor acima para a chave indicada e envie o comprovante pelo WhatsApp.",
    });
  }

  // ── Criar cobrança via Asaas ──
  try {
    const { createCustomer, createPayment, getPaymentPixQrCode, AsaasApiError } =
      await import("@/lib/asaas/client");

    // Buscar ou criar customer no Asaas
    const user = await currentUser();
    const userName = user?.fullName || user?.firstName || "Cliente KathApp";
    const userEmail =
      user?.emailAddresses?.[0]?.emailAddress || "cliente@kathapp.com";

    // F1: o Asaas exige CPF/CNPJ do pagador para gerar PIX. Lemos o cpf do
    // profile e o enviamos ao criar o customer; sem ele, falhar cedo com
    // mensagem acionável em vez de deixar o Asaas recusar de forma opaca.
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
      // CPF: prioridade body (coletado inline pelo usuário) > profile > vazio
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

      // Salvar no perfil — customer_id sempre; cpf se veio do body e profile não tinha.
      const updates: { asaas_customer_id: string; cpf?: string } = {
        asaas_customer_id: customerId,
      };
      if (cpfBodyDigits && !cpfProfileDigits) updates.cpf = cpfDigits;
      await supabase.from("profiles").update(updates).eq("id", userId);
    }

    // Criar cobrança Pix avulsa (não assinatura)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Vence amanhã
    const dueDateStr = dueDate.toISOString().split("T")[0];

    let payment: AsaasPayment;
    try {
      payment = await createPayment({
        customer: customerId,
        billingType: "PIX",
        value: totalReais,
        dueDate: dueDateStr,
        description: `Pedido KathApp Loja #${orderId.substring(0, 8).toUpperCase()}`,
        externalReference: orderId,
      });
    } catch (asaasErr) {
      // 4xx do Asaas (ex.: CPF inválido) = causa acionável → 422 com a descrição.
      if (asaasErr instanceof AsaasApiError && asaasErr.status >= 400 && asaasErr.status < 500) {
        console.error("[loja/payment] Asaas validation error:", asaasErr.body);
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
      throw asaasErr; // 5xx/rede → tratado no catch externo (503/manual)
    }

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
    // Em produção: 503 explícito (Asaas falhou após config ok); o usuário
    // tenta de novo e o admin recebe o sinal pra abrir incidente.
    if (isProd) {
      return NextResponse.json(
        {
          error: "payment_provider_error",
          message:
            "Não foi possível gerar a cobrança Pix neste momento. Por favor tente novamente em alguns minutos.",
        },
        { status: 503 },
      );
    }
    // Dev / preview: Pix manual permitido como fallback
    return NextResponse.json({
      method: "manual_pix",
      total: totalReais,
      pixKey: process.env.PIX_KEY || null,
      pixName: process.env.PIX_NAME || "KathApp",
      instructions:
        "[DEV] Erro ao gerar Pix automático. Faça um Pix manualmente e envie o comprovante.",
    });
  }
}
