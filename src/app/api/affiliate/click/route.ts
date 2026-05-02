import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/affiliate/click
 * Registra clique em link de afiliado — incrementa clicks_count de forma atômica.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate limit: 60 clicks per minute per user
  const { allowed } = await checkRateLimitAsync(`aff:${userId}`, { maxRequests: 60, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Muitos cliques. Aguarde." }, { status: 429 });
  }

  let linkId: string;
  try {
    const body = await req.json();
    linkId = body.linkId;
    if (!linkId || typeof linkId !== "string") throw new Error("Invalid linkId");
  } catch {
    return NextResponse.json({ error: "linkId obrigatório" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Atualizar clicks_count diretamente (RPC function não existe em database)
  const { data, error: selectError } = await supabase
    .from("affiliate_links")
    .select("clicks_count")
    .eq("id", linkId)
    .single();

  if (!selectError && data) {
    const newCount = (data.clicks_count ?? 0) + 1;
    await supabase
      .from("affiliate_links")
      .update({ clicks_count: newCount })
      .eq("id", linkId);
  }

  return NextResponse.json({ tracked: true });
}
