import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getStoreDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents, spendWalletCents } from "@/lib/billing/wallet";
import { clampCashbackCents, computeAmountPaidCash } from "@/lib/billing/cashback-utils";
import { handleApiError } from "@/lib/api-error";
import { getShippingOptions } from "@/lib/shipping";
import type { PlanTier } from "@/lib/supabase/types";

const itemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20),
  variant: z.string().nullable().optional(),
});

const shippingInfoSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  zip: z.string().min(8).max(9),
  phone: z.string().min(8).max(20),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  shipping_info: shippingInfoSchema,
  // Cap de sanity: R$1000 max. Idealmente deveria re-quote Melhor Envio
  // server-side antes de aceitar; por enquanto valida só o range pra impedir
  // manipulação grosseira (negativo ou valor abusivo).
  shipping_cost_cents: z.coerce.number().int().min(0).max(100_000).default(0),
  shipping_method: z.string().nullable().optional(),
  estimated_delivery: z.string().nullable().optional(),
  use_cashback_cents: z.coerce.number().int().min(0).default(0),
});

/**
 * POST /api/loja/checkout
 *
 * Cria pedido com itens, recalcula preço (desconto via `plans` table),
 * aplica cashback (clamp 50% + saldo), decrementa estoque atômico, salva order.
 * O pagamento Asaas é gerado em /api/loja/payment com value=total_cents.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimitAsync(`checkout:${userId}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde 1 minuto." }, { status: 429 });
    }

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const supabase = createAdminSupabaseClient();

    // plan_tier autoritativo
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();
    const planTier = (profile?.plan_tier as PlanTier | undefined) ?? "start";

    // Produtos reais + cost_cents + module
    const productIds = body.items.map(i => i.product_id);
    const { data: productsRaw } = await supabase
      .from("products")
      .select(
        "id, title, stock, price_cents, cost_cents, compare_price, module, weight_kg, height_cm, width_cm, length_cm",
      )
      .in("id", productIds)
      .eq("is_active", true);

    const products = (productsRaw ?? []) as Array<{
      id: string;
      title: string;
      stock: number;
      price_cents: number;
      cost_cents: number;
      compare_price: number | null;
      module: string;
      weight_kg: number | null;
      height_cm: number | null;
      width_cm: number | null;
      length_cm: number | null;
    }>;

    if (products.length !== body.items.length) {
      return NextResponse.json(
        { error: "Um ou mais produtos não estão disponíveis" },
        { status: 400 },
      );
    }

    const discountPct = await getStoreDiscountPct(planTier);

    type ValidatedItem = {
      product_id: string;
      title: string;
      variant: string | null;
      quantity: number;
      price_cents: number;
      cost_cents: number;
      module: string;
    };

    const validatedItems: ValidatedItem[] = [];
    let subtotalCents = 0;
    let discountCents = 0;

    for (const item of body.items) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) {
        return NextResponse.json(
          { error: `Produto ${item.product_id} não encontrado` },
          { status: 400 },
        );
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `"${product.title}" tem apenas ${product.stock} unidade(s) em estoque` },
          { status: 400 },
        );
      }

      const finalPrice = Math.round(product.price_cents * (100 - discountPct) / 100);
      subtotalCents += product.price_cents * item.quantity;
      discountCents += (product.price_cents - finalPrice) * item.quantity;

      validatedItems.push({
        product_id: product.id,
        title: product.title,
        variant: item.variant ?? null,
        quantity: item.quantity,
        price_cents: finalPrice,
        cost_cents: product.cost_cents,
        module: product.module,
      });
    }

    // Frete: o produto já é recalculado do DB, mas o frete vinha confiável do
    // cliente (poderia ser forjado para 0). Re-cotamos no servidor e validamos
    // o valor enviado contra as cotações reais. Se o provedor estiver fora do ar
    // ou o CEP sem cobertura, não bloqueamos a compra (mantemos o valor + cap).
    const shippingCents = Math.max(0, body.shipping_cost_cents);
    try {
      const pkg = {
        weight_kg: validatedItems.reduce((s, it) => {
          const p = products.find((pp) => pp.id === it.product_id);
          return s + (p?.weight_kg ?? 0.5) * it.quantity;
        }, 0),
        height_cm: Math.max(...products.map((p) => p.height_cm ?? 10)),
        width_cm: Math.max(...products.map((p) => p.width_cm ?? 20)),
        length_cm: Math.max(...products.map((p) => p.length_cm ?? 30)),
      };
      const zip = body.shipping_info.zip.replace(/\D/g, "");
      const quotes = await getShippingOptions(zip, pkg);
      if (quotes.length > 0) {
        // tolerância de R$1 para arredondamentos entre client e servidor.
        const match = quotes.some(
          (q) => Math.abs(q.price_cents - shippingCents) <= 100,
        );
        if (!match) {
          return NextResponse.json(
            {
              error: "Frete inválido. Recalcule o frete e tente novamente.",
              code: "shipping_mismatch",
            },
            { status: 400 },
          );
        }
      }
    } catch (err) {
      console.warn(
        "[loja/checkout] re-cotação de frete falhou, mantendo valor do cliente:",
        err,
      );
    }
    const grossCents = subtotalCents - discountCents + shippingCents;

    // Cashback
    const activeBalance = await getWalletActiveCents(userId);
    const cashbackUsedCents = clampCashbackCents({
      requested: body.use_cashback_cents,
      gross: grossCents,
      activeBalance,
    });
    const totalCents = computeAmountPaidCash({ gross: grossCents, cashbackUsed: cashbackUsedCents });

    // Decrementar estoque (RPC batch atômica preferida; fallback item-a-item)
    const stockPayload = body.items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
    const { error: batchErr } = await supabase.rpc("decrement_stock_batch", { p_items: stockPayload });
    if (batchErr) {
      // Fallback: item-a-item com rollback (compatibilidade com ambientes sem o RPC novo)
      for (let i = 0; i < body.items.length; i++) {
        const it = body.items[i];
        const { error: itemErr } = await supabase.rpc("decrement_stock", {
          p_product_id: it.product_id,
          p_quantity: it.quantity,
        });
        if (itemErr) {
          for (let j = 0; j < i; j++) {
            await supabase.rpc("increment_stock", {
              p_product_id: body.items[j].product_id,
              p_quantity: body.items[j].quantity,
            });
          }
          return NextResponse.json({ error: "Estoque insuficiente" }, { status: 400 });
        }
      }
    }

    // Criar pedido
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        items: validatedItems,
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        shipping_cost_cents: shippingCents,
        shipping_method: body.shipping_method ?? null,
        estimated_delivery: body.estimated_delivery ?? null,
        cashback_used_cents: cashbackUsedCents,
        total_cents: totalCents,
        shipping_info: body.shipping_info,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      // Rollback estoque
      await supabase.rpc("increment_stock_batch", { p_items: stockPayload }).then(({ error }) => {
        if (error) {
          for (const it of body.items) {
            supabase.rpc("increment_stock", { p_product_id: it.product_id, p_quantity: it.quantity }).then(() => {});
          }
        }
      });
      return NextResponse.json({ error: orderErr?.message ?? "order_create_fail" }, { status: 500 });
    }

    // C3: o pedido nasce `pending`; um PIX abandonado nunca seria pago, e gastar
    // o saldo agora o queimaria para sempre sem estorno. O `cashback_used_cents`
    // (saldo ja validado/clampado acima) e debitado em handleLojaPayment, na
    // confirmacao do pagamento, idempotente (vinculado ao revenue_stream).
    // EXCECAO: quando o cashback cobre 100% (totalCents === 0) nao havera PIX nem
    // webhook, entao debitamos agora (com rollback de estoque/pedido em falha).
    if (cashbackUsedCents > 0 && totalCents === 0) {
      try {
        await spendWalletCents({ userId, amountCents: cashbackUsedCents });
        // Cashback cobre 100%: não haverá cobrança Asaas nem webhook, confirmar aqui.
        await supabase
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", order.id);
      } catch (walletErr) {
        console.error("[loja/checkout] wallet spend failed; rolling back order", walletErr);
        await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
        await supabase.rpc("increment_stock_batch", { p_items: stockPayload });
        return NextResponse.json({ error: "wallet_spend_failed" }, { status: 500 });
      }
    }

    return NextResponse.json({
      orderId: order.id,
      total_cents: totalCents,
      cashback_used_cents: cashbackUsedCents,
    });
  } catch (err) {
    return handleApiError(err, "POST /api/loja/checkout");
  }
}
