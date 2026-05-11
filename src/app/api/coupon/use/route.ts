import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({
  couponId: z.string().uuid("couponId precisa ser UUID válido"),
});

/**
 * POST /api/coupon/use
 * Registra uso de cupom pelo usuário.
 *
 * Fluxo:
 *  1. Tenta inserir em coupon_uses (UNIQUE(coupon_id, user_id) bloqueia duplicata).
 *  2. Se conseguiu inserir, chama RPC increment_coupon_uses para contador atômico.
 *  3. Se já usou (23505), retorna 409.
 *  4. Se o cupom expirou/foi desativado/atingiu max_uses, a RPC silenciosamente
 *     não incrementa — o uso ainda fica registrado em coupon_uses (auditoria),
 *     mas devolvemos um aviso.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimitAsync(`coupon-use:${userId}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde 1 minuto." }, { status: 429 });
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
    const { couponId } = parsed.data;

    const supabase = createAdminSupabaseClient();

    // 1. Validar cupom (ativo, não expirado, ainda dentro de max_uses)
    const { data: coupon, error: couponErr } = await supabase
      .from("coupons")
      .select("id, is_active, max_uses, uses_count, valid_until")
      .eq("id", couponId)
      .single();

    if (couponErr || !coupon) {
      return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
    }
    if (!coupon.is_active) {
      return NextResponse.json({ error: "Cupom inativo" }, { status: 410 });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return NextResponse.json({ error: "Cupom expirado" }, { status: 410 });
    }
    if (coupon.max_uses != null && coupon.uses_count >= coupon.max_uses) {
      return NextResponse.json({ error: "Cupom esgotado" }, { status: 410 });
    }

    // 2. Registrar uso por user (UNIQUE bloqueia duplicata)
    const { error: insertErr } = await supabase
      .from("coupon_uses")
      .insert({ coupon_id: couponId, user_id: userId });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "Você já usou este cupom" }, { status: 409 });
      }
      throw new Error(`coupon_uses insert fail: ${insertErr.message}`);
    }

    // 3. Incrementar contador atomicamente
    const { error: rpcErr } = await supabase.rpc("increment_coupon_uses", {
      coupon_id: couponId,
    });
    if (rpcErr) {
      // Log mas não falha — o registro em coupon_uses já garante auditoria
      console.error("[coupon/use] rpc increment_coupon_uses failed:", rpcErr.message);
    }

    return NextResponse.json({ used: true });
  } catch (err) {
    return handleApiError(err, "POST /api/coupon/use");
  }
}
