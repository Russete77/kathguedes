import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({
  linkId: z.string().uuid("linkId precisa ser UUID válido"),
});

/**
 * POST /api/affiliate/click
 *
 * 1. Auth + rate limit (60/min/user).
 * 2. Incrementa `affiliate_links.clicks_count` via RPC.
 *
 * No modelo de 4 tiers todos os usuários têm cliques ilimitados — o gate mensal
 * que existia no plano FREE (3/mês) foi removido na migration 31 junto com a
 * função `try_increment_affiliate_click` e a tabela `monthly_usage`.
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
    const { error: incErr } = await supabase.rpc("increment_affiliate_clicks", { link_id: linkId });
    if (incErr) throw new Error(`rpc increment_affiliate_clicks fail: ${incErr.message}`);

    return NextResponse.json({ tracked: true });
  } catch (err) {
    return handleApiError(err, "POST /api/affiliate/click");
  }
}
