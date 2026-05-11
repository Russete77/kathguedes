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
 * Registra clique em link de afiliado — incrementa clicks_count de forma atômica.
 * Usa RPC `increment_affiliate_clicks` (definida em schema.sql) — sem SELECT-then-UPDATE.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimitAsync(`aff:${userId}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!allowed) {
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
    const { error } = await supabase.rpc("increment_affiliate_clicks", { link_id: linkId });
    if (error) throw new Error(`rpc increment_affiliate_clicks fail: ${error.message}`);

    return NextResponse.json({ tracked: true });
  } catch (err) {
    return handleApiError(err, "POST /api/affiliate/click");
  }
}
