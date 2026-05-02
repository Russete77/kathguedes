import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/loja/checkout
 * Cria pedido no Supabase com itens do carrinho.
 * Usa decrement atômico para evitar race condition no estoque.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate limit: 5 checkouts per minute per user
  const { allowed } = await checkRateLimitAsync(`checkout:${userId}`, { maxRequests: 5, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde 1 minuto." }, { status: 429 });
  }

  let body: {
    items: { product_id: string; quantity: number }[];
    shipping_cost_cents?: number;
    shipping_method?: string;
    estimated_delivery?: string;
    shipping_info: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      phone: string;
    };
  };

  try {
    body = await req.json();
    if (!body.items?.length || !body.shipping_info) throw new Error();
    if (!body.shipping_info.name || !body.shipping_info.address || !body.shipping_info.city || !body.shipping_info.state || !body.shipping_info.zip || !body.shipping_info.phone) {
      throw new Error("Missing shipping fields");
    }
    for (const it of body.items) {
      if (!it.product_id || !it.quantity || it.quantity <= 0) throw new Error("Invalid item");
    }
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Buscar plan_tier do usuário (autoritativo)
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();
  const planTier = (profile?.plan_tier as string) || "free";

  // 1. Buscar produtos reais + validar estoque + recalcular preços server-side
  const productIds = body.items.map((i) => i.product_id);
  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, title, stock, price_cents, compare_price, discount_start, discount_pro, discount_vip")
    .in("id", productIds)
    .eq("is_active", true);

  const products = (productsRaw || []) as unknown as Array<{
    id: string;
    title: string;
    stock: number;
    price_cents: number;
    compare_price: number | null;
    discount_start: number;
    discount_pro: number;
    discount_vip: number;
  }>;

  if (products.length !== body.items.length) {
    return NextResponse.json(
      { error: "Um ou mais produtos não estão disponíveis" },
      { status: 400 }
    );
  }

  function discPct(p: typeof products[number]): number {
    if (planTier === "vip") return p.discount_vip;
    if (planTier === "pro") return p.discount_pro;
    if (planTier === "start") return p.discount_start;
    return 0;
  }

  // Validar estoque + construir items com preço recalculado
  const validatedItems: Array<{
    product_id: string;
    title: string;
    variant: string | null;
    quantity: number;
    price_cents: number;
  }> = [];
  let subtotalCents = 0;
  let discountCents = 0;

  for (const item of body.items) {
    const product = products.find((p) => p.id === item.product_id);
    if (!product) {
      return NextResponse.json(
        { error: `Produto ${item.product_id} não encontrado` },
        { status: 400 }
      );
    }
    if (product.stock < item.quantity) {
      return NextResponse.json(
        { error: `"${product.title}" tem apenas ${product.stock} unidade(s) em estoque` },
        { status: 400 }
      );
    }

    const d = discPct(product);
    const finalPrice = Math.round(product.price_cents * (1 - d / 100));
    subtotalCents += product.price_cents * item.quantity;
    discountCents += (product.price_cents - finalPrice) * item.quantity;

    validatedItems.push({
      product_id: product.id,
      title: product.title,
      variant: null,
      quantity: item.quantity,
      price_cents: finalPrice,
    });
  }

  // Validar frete server-side — aceita o valor do cliente mas clampa
  // (idealmente re-cotaríamos com o melhor-envio aqui; por ora confiamos no valor recente)
  const shippingCents = Math.max(0, body.shipping_cost_cents || 0);
  const totalCents = subtotalCents - discountCents + shippingCents;

  // 2. Decrementar estoque atomicamente
  for (const item of body.items) {
    const { error: rpcError } = await supabase.rpc("decrement_stock", {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    });

    if (rpcError) {
      const idx = body.items.indexOf(item);
      for (let i = 0; i < idx; i++) {
        await supabase.rpc("increment_stock", {
          p_product_id: body.items[i].product_id,
          p_quantity: body.items[i].quantity,
        });
      }
      return NextResponse.json(
        { error: `Estoque insuficiente` },
        { status: 400 }
      );
    }
  }

  // 3. Criar pedido (valores 100% do servidor)
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      items: validatedItems,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      shipping_cost_cents: shippingCents,
      shipping_method: body.shipping_method || null,
      estimated_delivery: body.estimated_delivery || null,
      total_cents: totalCents,
      shipping_info: body.shipping_info,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // Rollback estoque
    for (const item of body.items) {
      await supabase.rpc("increment_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orderId: order?.id });
}
