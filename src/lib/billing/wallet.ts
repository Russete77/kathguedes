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

  // Idempotencia: nao gastar duas vezes para o mesmo revenue_stream. O webhook
  // pode reprocessar um pagamento (R-A libera o claim em erro transitorio);
  // spend_wallet_cents marca wallet_credits.spent_on_revenue_stream_id, entao
  // a presenca de um gasto ja vinculado a este stream encerra cedo.
  if (args.revenueStreamId) {
    const { data: already } = await supabase
      .from("wallet_credits")
      .select("id")
      .eq("spent_on_revenue_stream_id", args.revenueStreamId)
      .limit(1)
      .maybeSingle();
    if (already) return 0;
  }

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

  // Idempotência (R-A): não creditar duas vezes o mesmo revenue_stream — protege
  // contra reprocessamento do webhook após falha transitória.
  const { data: existing } = await supabase
    .from("wallet_credits")
    .select("id")
    .eq("source_revenue_stream_id", args.sourceStreamId)
    .gt("amount_cents", 0)
    .limit(1)
    .maybeSingle();
  if (existing) return;

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

/**
 * Revoga créditos GANHOS por um revenue_stream (usado em PAYMENT_REFUNDED).
 *
 * Lógica:
 * - Só revoga créditos AINDA NÃO GASTOS (used_at IS NULL).
 * - Marca como expirados (não deleta — mantém histórico/audit).
 * - Se user já gastou parte do cashback, esse gasto fica registrado mas o
 *   restante não-usado é zerado. Tradeoff: empresa absorve o que ja foi
 *   gasto, mas evita saldo negativo.
 *
 * Retorna a soma de cents revogados.
 */
export async function revokeWalletCreditsBySource(streamId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_credits")
    .update({
      expires_at: new Date(0).toISOString(), // expira no passado
      amount_cents: 0,
    })
    .eq("source_revenue_stream_id", streamId)
    .is("used_at", null)
    .select("amount_cents");
  if (error) throw new Error(`[wallet] revoke source fail: ${error.message}`);
  return (data ?? []).reduce((sum, c) => sum + (c.amount_cents || 0), 0);
}

/**
 * Reverte um GASTO de cashback vinculado a um revenue_stream (usado em
 * PAYMENT_REFUNDED de loja). Diferente de revoke: aqui o crédito ainda
 * existe — o user gastou, mas como o pagamento foi refundado, devolvemos.
 *
 * Limpa os campos `spent_on_revenue_stream_id` e `used_at`, fazendo o
 * crédito voltar pro saldo ativo (se ainda não expirou).
 *
 * Retorna quantos cents foram devolvidos ao saldo.
 */
export async function unspendWalletCredits(streamId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_credits")
    .update({
      spent_on_revenue_stream_id: null,
      used_at: null,
    })
    .eq("spent_on_revenue_stream_id", streamId)
    .select("amount_cents");
  if (error) throw new Error(`[wallet] unspend fail: ${error.message}`);
  return (data ?? []).reduce((sum, c) => sum + (c.amount_cents || 0), 0);
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
