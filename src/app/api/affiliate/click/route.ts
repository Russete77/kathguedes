import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { getPlan } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

const bodySchema = z.object({
  linkId: z.string().uuid("linkId precisa ser UUID válido"),
});

function currentYearMonth(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/**
 * POST /api/affiliate/click
 *
 * 1. Rate limit (60/min/user).
 * 2. Lê plan_tier do user; se o plano tiver `affiliate_clicks_per_month` numérico
 *    (hoje só FREE = 3), tenta incrementar via RPC `try_increment_affiliate_click`
 *    (atômico, com lock). Se passou do limite → 429.
 * 3. Incrementa `affiliate_links.clicks_count` via RPC existente.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed: rateOk } = await checkRateLimitAsync(`aff:${userId}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateOk) {
      return NextResponse.json({ error: "Muitos cliques. Aguarde." }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { linkId } = parsed.data;

    const supabase = createAdminSupabaseClient();

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();
    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const tier = (profile.plan_tier as PlanTier) ?? "free";
    const plan = await getPlan(tier);
    const limitRaw = plan?.features?.affiliate_clicks_per_month;
    const monthlyLimit: number | null =
      typeof limitRaw === "number" ? limitRaw : null;

    const { data: gate, error: gateErr } = await supabase
      .rpc("try_increment_affiliate_click", {
        p_user_id: userId,
        p_year_month: currentYearMonth(),
        p_limit: monthlyLimit,
      })
      .single();

    if (gateErr) {
      throw new Error(`rpc try_increment_affiliate_click fail: ${gateErr.message}`);
    }

    const gateRow = gate as { allowed: boolean; new_count: number } | null;
    if (!gateRow?.allowed) {
      return NextResponse.json(
        {
          error: `Limite mensal de cliques atingido (${monthlyLimit}/mês no plano ${plan?.name ?? tier}). Faça upgrade para liberar.`,
          code: "monthly_limit_reached",
          limit: monthlyLimit,
          used: gateRow?.new_count ?? null,
        },
        { status: 429 }
      );
    }

    const { error: incErr } = await supabase.rpc("increment_affiliate_clicks", { link_id: linkId });
    if (incErr) throw new Error(`rpc increment_affiliate_clicks fail: ${incErr.message}`);

    return NextResponse.json({
      tracked: true,
      used: gateRow.new_count,
      limit: monthlyLimit,
    });
  } catch (err) {
    return handleApiError(err, "POST /api/affiliate/click");
  }
}
