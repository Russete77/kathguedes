import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type WalletBalance = {
  active_cents: number;
  earned_total_cents: number;
  spent_total_cents: number;
  expired_total_cents: number;
};

const ZERO_BALANCE: WalletBalance = {
  active_cents: 0,
  earned_total_cents: 0,
  spent_total_cents: 0,
  expired_total_cents: 0,
};

export async function getWalletActiveCents(userId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("wallet_active_cents", { p_user_id: userId });
  if (error) throw new Error(`[wallet] active fail: ${error.message}`);
  return Number(data ?? 0);
}

export async function getWalletBalance(userId: string): Promise<WalletBalance> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_balance")
    .select("active_cents,earned_total_cents,spent_total_cents,expired_total_cents")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") {
    throw new Error(`[wallet] balance fail: ${error.message}`);
  }
  return (data as WalletBalance | null) ?? ZERO_BALANCE;
}

export async function spendWalletCents(args: {
  userId: string;
  amountCents: number;
  revenueStreamId?: string;
}): Promise<number> {
  if (args.amountCents <= 0) return 0;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("spend_wallet_cents", {
    p_user_id: args.userId,
    p_amount_cents: args.amountCents,
    p_revenue_stream_id: args.revenueStreamId ?? null,
  });
  if (error) throw new Error(`[wallet] spend fail: ${error.message}`);
  return Number(data ?? 0);
}

export async function creditWalletCents(args: {
  userId: string;
  amountCents: number;
  sourceStreamId: string;
  validityDays?: number;
}): Promise<void> {
  if (args.amountCents <= 0) return;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("credit_wallet_cents", {
    p_user_id: args.userId,
    p_amount_cents: args.amountCents,
    p_source_stream_id: args.sourceStreamId,
    p_validity_days: args.validityDays ?? 120,
  });
  if (error) throw new Error(`[wallet] credit fail: ${error.message}`);
}

export async function expireWalletCredits(): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("expire_wallet_credits");
  if (error) throw new Error(`[wallet] expire fail: ${error.message}`);
  return Number(data ?? 0);
}

/** Lista creditos por user para extrato (pagina /perfil/cashback). */
export async function listWalletCreditsForUser(userId: string, limit = 100) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_credits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[wallet] list fail: ${error.message}`);
  return data ?? [];
}
