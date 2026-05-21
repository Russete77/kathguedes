import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type RevenueStreamType = "mensalidade" | "loja" | "estetica" | "afiliado_externo";
export type RevenueReferenceType = "subscription" | "order" | "booking" | "affiliate_payout";

export type RecordRevenueInput = {
  type: RevenueStreamType;
  category: string | null;
  user_id: string | null;
  reference_type: RevenueReferenceType;
  reference_id: string;
  asaas_payment_id: string | null;
  gross_cents: number;
  cost_cents: number;
  cashback_used_cents: number;
  occurred_at: string;
};

export type RevenueStream = RecordRevenueInput & {
  id: string;
  net_cents: number;
  status: "pending" | "confirmed" | "refunded";
  created_at: string;
};

/**
 * Insere revenue_stream confirmado e dispara compute_commissions.
 * Chamado pelo webhook Asaas em PAYMENT_CONFIRMED/PAYMENT_RECEIVED
 * e pelas server actions markOrderDelivered/markBookingDone para creditar cashback.
 */
export async function recordRevenueStream(input: RecordRevenueInput): Promise<RevenueStream> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("revenue_streams")
    .insert({ ...input, status: "confirmed" })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`[revenue] insert fail: ${error?.message ?? "no data"}`);
  }

  const { error: rpcErr } = await supabase.rpc("compute_commissions", {
    p_revenue_stream_id: data.id,
  });
  if (rpcErr) throw new Error(`[revenue] commissions fail: ${rpcErr.message}`);

  return data as RevenueStream;
}

/**
 * Marca revenue_stream como refunded e suas allocations (draft|approved) como failed.
 * Chamado em PAYMENT_REFUNDED ou cancel manual.
 */
export async function refundRevenueStream(streamId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("revenue_streams")
    .update({ status: "refunded" })
    .eq("id", streamId);
  if (error) throw new Error(`[revenue] refund fail: ${error.message}`);

  const { error: allocErr } = await supabase
    .from("commission_allocations")
    .update({ status: "failed" })
    .eq("revenue_stream_id", streamId)
    .in("status", ["draft", "approved"]);
  if (allocErr) throw new Error(`[revenue] alloc update fail: ${allocErr.message}`);
}
