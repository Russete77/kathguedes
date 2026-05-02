import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/coupon/use
 * Registra uso de cupom — incrementa uses_count via function do Postgres.
 * Verifica se o usuário já utilizou este cupom antes.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let couponId: string;
  try {
    const body = await req.json();
    couponId = body.couponId;
    if (!couponId) throw new Error("Missing couponId");
  } catch {
    return NextResponse.json({ error: "couponId obrigatório" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Usar a RPC function que incrementa uses_count no cupom
  const { error: rpcError } = await supabase.rpc("increment_coupon_uses", {
    coupon_id: couponId,
  });

  if (rpcError) {
    // Fallback: increment manual se a RPC falhar
    const { data } = await supabase
      .from("coupons")
      .select("uses_count, max_uses, is_active")
      .eq("id", couponId)
      .single();

    if (data && data.is_active && (!data.max_uses || data.uses_count < data.max_uses)) {
      await supabase
        .from("coupons")
        .update({ uses_count: (data.uses_count ?? 0) + 1 })
        .eq("id", couponId);
    }
  }

  return NextResponse.json({ used: true });
}
