import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { creditWalletCents } from "@/lib/billing/wallet";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

const TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/order-timeout
 *
 * Cron horário (Vercel Cron — vercel.json: "0 * * * *"):
 * Cancela orders/bookings 'pending' há >24h e reverte estoque + cashback.
 * Cashback revertido tem validade curta (30d) para evitar ressuscitar saldo expirado.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const cutoff = new Date(Date.now() - TIMEOUT_MS).toISOString();

    // Orders pending > 24h
    const { data: orders } = await supabase
      .from("orders")
      .select("id, user_id, items, cashback_used_cents")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    let canceledOrders = 0;
    for (const order of orders ?? []) {
      const items = (order.items ?? []) as Array<{ product_id: string; quantity: number }>;
      // Restaurar estoque (best-effort)
      if (items.length > 0) {
        await supabase
          .rpc("increment_stock_batch", {
            p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          })
          .then(({ error }) => {
            if (error)
              console.error("[cron/order-timeout] stock restore failed", { orderId: order.id, error });
          });
      }

      // Reverter cashback consumido (criar credit positivo, validade 30d)
      if ((order.cashback_used_cents ?? 0) > 0) {
        try {
          await creditWalletCents({
            userId: order.user_id as string,
            amountCents: order.cashback_used_cents as number,
            sourceStreamId: order.id,
            validityDays: 30,
          });
        } catch (e) {
          console.error("[cron/order-timeout] cashback revert failed", { orderId: order.id, e });
        }
      }

      await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
      canceledOrders++;
    }

    // Bookings pending > 24h
    const { data: bookings } = await supabase
      .from("estetica_bookings")
      .select("id, user_id, cashback_used_cents")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    let canceledBookings = 0;
    for (const b of bookings ?? []) {
      if ((b.cashback_used_cents ?? 0) > 0) {
        try {
          await creditWalletCents({
            userId: b.user_id as string,
            amountCents: b.cashback_used_cents as number,
            sourceStreamId: b.id,
            validityDays: 30,
          });
        } catch (e) {
          console.error("[cron/order-timeout] booking cashback revert failed", { bookingId: b.id, e });
        }
      }

      await supabase.from("estetica_bookings").update({ status: "canceled" }).eq("id", b.id);
      canceledBookings++;
    }

    return NextResponse.json({ canceled_orders: canceledOrders, canceled_bookings: canceledBookings });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/order-timeout");
  }
}
