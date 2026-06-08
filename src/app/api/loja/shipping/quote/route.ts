import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getShippingOptions } from "@/lib/shipping";
import type { ShippingPackage } from "@/lib/shipping/types";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/loja/shipping/quote
 * Retorna cotações de frete para o CEP informado.
 *
 * Body: { zip: string, items?: { weight_kg: number; width_cm: number; height_cm: number; length_cm: number }[] }
 * Response: { quotes: ShippingQuote[] }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate limit: 10 cotações por minuto
  const { allowed } = await checkRateLimitAsync(`shipping:${userId}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em 1 minuto." }, { status: 429 });
  }

  let body: { zip: string; items?: Partial<ShippingPackage>[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { zip } = body;
  if (!zip || typeof zip !== "string") {
    return NextResponse.json({ error: "CEP é obrigatório" }, { status: 400 });
  }

  const cleanZip = zip.replace(/\D/g, "");
  if (cleanZip.length !== 8) {
    return NextResponse.json({ error: "CEP deve ter 8 dígitos" }, { status: 400 });
  }

  // Calcular pacote agregado se itens forem passados
  let pkg: ShippingPackage | undefined;
  if (body.items && body.items.length > 0) {
    pkg = {
      weight_kg: body.items.reduce((s, i) => s + (i.weight_kg || 0.5), 0),
      height_cm: Math.max(...body.items.map((i) => i.height_cm || 10)),
      width_cm: Math.max(...body.items.map((i) => i.width_cm || 20)),
      length_cm: Math.max(...body.items.map((i) => i.length_cm || 30)),
    };
  }

  try {
    const quotes = await getShippingOptions(cleanZip, pkg);

    console.log(`[shipping/quote] CEP ${cleanZip} → ${quotes.length} opções`);

    return NextResponse.json({ quotes });
  } catch (err) {
    console.error("[shipping/quote] Error:", err);
    return NextResponse.json(
      { error: "Erro ao calcular frete. Tente novamente." },
      { status: 500 },
    );
  }
}
