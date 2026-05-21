import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateFullLabel } from "@/lib/shipping/melhor-envio";
import { getOriginAddress, DEFAULT_PACKAGE } from "@/lib/shipping/types";

/**
 * POST /api/admin/loja/shipping/label
 * Gera etiqueta de envio via Melhor Envio para um pedido.
 * Apenas admin.
 *
 * Body: { orderId: string, serviceId?: number }
 *
 * Fluxo: carrinho → checkout → gerar → imprimir → rastreio
 */
export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: { orderId: string; serviceId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { orderId, serviceId } = body;
  if (!orderId) {
    return NextResponse.json({ error: "orderId é obrigatório" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Buscar pedido
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !orderData) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const order = orderData as unknown as {
    id: string;
    status: string;
    items: Array<{ title: string; quantity: number; price_cents: number }>;
    shipping_info: {
      name: string;
      phone: string;
      address: string;
      number?: string;
      complement?: string;
      district?: string;
      city: string;
      state: string;
      zip: string;
    } | null;
  };

  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Pedido precisa estar com status 'paid' para gerar etiqueta" },
      { status: 400 },
    );
  }

  const shippingInfo = order.shipping_info;

  if (!shippingInfo?.zip) {
    return NextResponse.json({ error: "Pedido sem dados de envio" }, { status: 400 });
  }

  const origin = getOriginAddress();
  const items = order.items || [];

  try {
    const { tracking_code, label_url, cart_id } = await generateFullLabel({
      serviceId: serviceId || 1, // Default SEDEX; idealmente salvar o service_id escolhido no pedido
      from: {
        name: "KathApp Loja",
        phone: process.env.SHIPPING_CONTACT_PHONE || "",
        email: "contato@kathapp.com",
        address: origin.address,
        number: "S/N",
        district: "",
        city: origin.city,
        state_abbr: origin.state,
        postal_code: origin.zip,
      },
      to: {
        name: shippingInfo.name,
        phone: shippingInfo.phone || "",
        address: shippingInfo.address,
        number: shippingInfo.number || "S/N",
        complement: shippingInfo.complement || "",
        district: shippingInfo.district || "",
        city: shippingInfo.city,
        state_abbr: shippingInfo.state,
        postal_code: shippingInfo.zip,
      },
      products: items.map((i) => ({
        name: i.title,
        quantity: i.quantity,
        unitary_value: i.price_cents / 100,
      })),
      volumes: [
        {
          height: DEFAULT_PACKAGE.height_cm,
          width: DEFAULT_PACKAGE.width_cm,
          length: DEFAULT_PACKAGE.length_cm,
          weight: DEFAULT_PACKAGE.weight_kg,
        },
      ],
      options: {
        insurance_value: 0,
        receipt: false,
        own_hand: false,
        non_commercial: true,
      },
      tag: orderId,
    });

    // Atualizar pedido com tracking e label
    await supabase
      .from("orders")
      .update({
        tracking_code,
        shipping_label_url: label_url,
        melhor_envio_order_id: cart_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    console.log(`[admin/shipping/label] Order ${orderId} → tracking: ${tracking_code}, label: ${label_url}`);

    return NextResponse.json({ tracking_code, label_url });
  } catch (err) {
    console.error("[admin/shipping/label] Error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      {
        error: "Erro ao gerar etiqueta",
        details: message,
      },
      { status: 500 },
    );
  }
}
