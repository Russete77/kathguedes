import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type AllocationStatus = "draft" | "approved" | "paid" | "failed";

export type CommissionAllocation = {
  id: string;
  revenue_stream_id: string;
  team_member_id: string;
  pct: number;
  amount_cents: number;
  status: AllocationStatus;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
};

export async function computeCommissions(revenueStreamId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("compute_commissions", {
    p_revenue_stream_id: revenueStreamId,
  });
  if (error) throw new Error(`[commissions] compute fail: ${error.message}`);
  return Number(data ?? 0);
}

export type ListAllocationsFilter = {
  status?: AllocationStatus;
  teamMemberId?: string;
  fromDate?: string;
  toDate?: string;
};

export async function listAllocations(filter: ListAllocationsFilter) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("commission_allocations")
    .select("*, team_members(*), revenue_streams(*)");
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.teamMemberId) query = query.eq("team_member_id", filter.teamMemberId);
  if (filter.fromDate) query = query.gte("created_at", filter.fromDate);
  if (filter.toDate) query = query.lte("created_at", filter.toDate);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`[commissions] list fail: ${error.message}`);
  return data ?? [];
}

export async function approveAllocations(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createAdminSupabaseClient();
  const { error, count } = await supabase
    .from("commission_allocations")
    .update({ status: "approved" })
    .in("id", ids)
    .eq("status", "draft");
  if (error) throw new Error(`[commissions] approve fail: ${error.message}`);
  return count ?? 0;
}

export async function markAllocationsPaid(ids: string[], reference: string): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createAdminSupabaseClient();
  const { error, count } = await supabase
    .from("commission_allocations")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payout_reference: reference,
    })
    .in("id", ids)
    .eq("status", "approved");
  if (error) throw new Error(`[commissions] paid fail: ${error.message}`);
  return count ?? 0;
}

export type PendingPayout = {
  team_member_id: string;
  name: string;
  pix_key: string | null;
  total_cents: number;
};

/** Total a pagar por socio (allocations approved). */
export async function pendingPayoutsByMember(): Promise<PendingPayout[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("commission_allocations")
    .select("team_member_id, amount_cents, team_members(full_name, pix_key)")
    .eq("status", "approved");
  if (error) throw new Error(`[commissions] payouts fail: ${error.message}`);

  const grouped = new Map<string, PendingPayout>();
  for (const row of data ?? []) {
    const tm = (row as unknown as {
      team_members: { full_name: string; pix_key: string | null };
    }).team_members;
    const cur = grouped.get(row.team_member_id) ?? {
      team_member_id: row.team_member_id,
      name: tm.full_name,
      pix_key: tm.pix_key,
      total_cents: 0,
    };
    cur.total_cents += row.amount_cents;
    grouped.set(row.team_member_id, cur);
  }
  return Array.from(grouped.values());
}
