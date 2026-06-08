import { NextResponse } from "next/server";
import { expireWalletCredits } from "@/lib/billing/wallet";
import { handleApiError } from "@/lib/api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed: sem CRON_SECRET, nega tudo
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/cron/wallet-expire
 *
 * Cron diário (Vercel Cron — vercel.json: "0 6 * * *"):
 * 1. Marca créditos vencidos como usados (expire_wallet_credits RPC).
 * 2. Notifica push 7 dias antes da expiração.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const expired = await expireWalletCredits();

    const supabase = createAdminSupabaseClient();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400_000).toISOString();
    const eightDaysFromNow = new Date(Date.now() + 8 * 86400_000).toISOString();

    const { data: expiringSoon } = await supabase
      .from("wallet_credits")
      .select("user_id, amount_cents, expires_at")
      .is("used_at", null)
      .gt("expires_at", sevenDaysFromNow)
      .lt("expires_at", eightDaysFromNow)
      .gt("amount_cents", 0);

    const byUser = new Map<string, number>();
    for (const c of expiringSoon ?? []) {
      byUser.set(c.user_id, (byUser.get(c.user_id) ?? 0) + c.amount_cents);
    }

    let notified = 0;
    for (const [userId, totalCents] of byUser) {
      await notifyUser(userId, {
        title: "Cashback expirando",
        body: `Você tem R$ ${(totalCents / 100).toFixed(2)} em cashback expirando em 7 dias.`,
        icon: "Wallet",
        url: "/perfil/cashback",
      });
      notified++;
    }

    return NextResponse.json({ expired_cents: expired, notified });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/wallet-expire");
  }
}
