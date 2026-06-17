import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const clickSchema = z.object({
  partner_store_id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
  price_cents: z.number().int().nonnegative().optional(),
});

/**
 * POST /api/loja/whatsapp-click
 *
 * Registra um clique no botão "Comprar pelo WhatsApp" da loja.
 * O frontend dispara este endpoint via `navigator.sendBeacon` (ou fetch
 * keepalive) ANTES de o usuário sair da página para o wa.me — por isso a
 * resposta é leve (204) e o erro não bloqueia o fluxo.
 *
 * Não autenticado também é permitido (loja pode ter modos públicos no futuro),
 * mas se houver Clerk session, registramos o user_id para segmentação.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  // Rate limit por usuário OU por IP (fallback). Evita inflar a contagem
  // com cliques duplicados / scripts.
  const rateKey = userId
    ? `wa-click:${userId}`
    : `wa-click:ip:${req.headers.get("x-forwarded-for") ?? "unknown"}`;
  const { allowed } = await checkRateLimitAsync(rateKey, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    // Falha silenciosa — não queremos quebrar UX por rate limit em telemetria.
    return new NextResponse(null, { status: 204 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = clickSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido" },
      { status: 400 },
    );
  }
  const { partner_store_id, product_id, price_cents } = parsed.data;

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("partner_store_whatsapp_clicks" as never)
    .insert({
      partner_store_id,
      product_id: product_id ?? null,
      user_id: userId ?? null,
      price_cents: price_cents ?? null,
    } as never);

  if (error) {
    console.error("[whatsapp-click] insert error", error);
    // Telemetria não deve quebrar UX
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 204 });
}
