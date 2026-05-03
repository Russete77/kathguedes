import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdateIn = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

import { recordRevenueStream, refundRevenueStream } from "./revenue";

beforeEach(() => {
  mockSingle.mockReset();
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockUpdateEq.mockReset();
  mockUpdateIn.mockReset();
  mockUpdate.mockReset();
  mockEq.mockReset();
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe("recordRevenueStream", () => {
  it("insere e dispara compute_commissions", async () => {
    mockSingle.mockResolvedValue({ data: { id: "rs_1", net_cents: 9990, status: "confirmed", created_at: "2026-05-02T00:00:00Z" }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockRpc.mockResolvedValue({ data: 3, error: null });

    const r = await recordRevenueStream({
      type: "mensalidade",
      category: "plano3",
      user_id: "user_1",
      reference_type: "subscription",
      reference_id: "user_1",
      asaas_payment_id: "pay_1",
      gross_cents: 9990,
      cost_cents: 0,
      cashback_used_cents: 0,
      occurred_at: new Date("2026-05-02").toISOString(),
    });

    expect(mockFrom).toHaveBeenCalledWith("revenue_streams");
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      type: "mensalidade",
      category: "plano3",
      user_id: "user_1",
      gross_cents: 9990,
      status: "confirmed",
    }));
    expect(mockRpc).toHaveBeenCalledWith("compute_commissions", { p_revenue_stream_id: "rs_1" });
    expect(r.id).toBe("rs_1");
  });

  it("propaga erro do insert", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "constraint_violation" } });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await expect(recordRevenueStream({
      type: "loja",
      category: "fitness",
      user_id: "u1",
      reference_type: "order",
      reference_id: "ord_1",
      asaas_payment_id: "pay_2",
      gross_cents: 5000,
      cost_cents: 2000,
      cashback_used_cents: 0,
      occurred_at: new Date().toISOString(),
    })).rejects.toThrow(/constraint_violation/);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("propaga erro de compute_commissions", async () => {
    mockSingle.mockResolvedValue({ data: { id: "rs_2" }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockRpc.mockResolvedValue({ data: null, error: { message: "rpc_fail" } });

    await expect(recordRevenueStream({
      type: "estetica",
      category: null,
      user_id: "u1",
      reference_type: "booking",
      reference_id: "bkg_1",
      asaas_payment_id: "pay_3",
      gross_cents: 8000,
      cost_cents: 1000,
      cashback_used_cents: 0,
      occurred_at: new Date().toISOString(),
    })).rejects.toThrow(/rpc_fail/);
  });
});

describe("refundRevenueStream", () => {
  it("marca stream como refunded e allocations como failed", async () => {
    // Setup: 2 chains diferentes (1 update revenue_streams, 1 update commission_allocations)
    const updateEqRev = vi.fn().mockResolvedValue({ error: null });
    const updateRev = vi.fn().mockReturnValue({ eq: updateEqRev });

    const updateInAlloc = vi.fn().mockResolvedValue({ error: null });
    const updateAllocEq = vi.fn().mockReturnValue({ in: updateInAlloc });
    const updateAlloc = vi.fn().mockReturnValue({ eq: updateAllocEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === "revenue_streams") return { update: updateRev };
      if (table === "commission_allocations") return { update: updateAlloc };
      throw new Error("unexpected table " + table);
    });

    await refundRevenueStream("rs_1");

    expect(updateRev).toHaveBeenCalledWith({ status: "refunded" });
    expect(updateEqRev).toHaveBeenCalledWith("id", "rs_1");

    expect(updateAlloc).toHaveBeenCalledWith({ status: "failed" });
    expect(updateAllocEq).toHaveBeenCalledWith("revenue_stream_id", "rs_1");
    expect(updateInAlloc).toHaveBeenCalledWith("status", ["draft", "approved"]);
  });

  it("propaga erro do update revenue_streams", async () => {
    const updateEqRev = vi.fn().mockResolvedValue({ error: { message: "stream_update_fail" } });
    const updateRev = vi.fn().mockReturnValue({ eq: updateEqRev });
    mockFrom.mockReturnValue({ update: updateRev });

    await expect(refundRevenueStream("rs_x")).rejects.toThrow(/stream_update_fail/);
  });
});
