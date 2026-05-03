import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

import { computeCommissions, listAllocations, approveAllocations, markAllocationsPaid, pendingPayoutsByMember } from "./commissions";

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
});

describe("computeCommissions", () => {
  it("delega à RPC compute_commissions", async () => {
    mockRpc.mockResolvedValueOnce({ data: 3, error: null });
    const r = await computeCommissions("rs_1");
    expect(mockRpc).toHaveBeenCalledWith("compute_commissions", { p_revenue_stream_id: "rs_1" });
    expect(r).toBe(3);
  });

  it("retorna 0 se data null", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await computeCommissions("rs_1")).toBe(0);
  });

  it("propaga erro do RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "rpc_fail" } });
    await expect(computeCommissions("rs_1")).rejects.toThrow(/rpc_fail/);
  });
});

describe("listAllocations", () => {
  function setupQueryChain(returnData: unknown[]) {
    const order = vi.fn().mockResolvedValue({ data: returnData, error: null });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte, order });
    // Use let so eq2 can reference itself (self-referential mock chain)
    let eq2: ReturnType<typeof vi.fn>;
    eq2 = vi.fn().mockReturnValue({ gte, lte, order, eq: (...a: unknown[]) => eq2(...a) });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2, gte, lte, order });
    const select = vi.fn().mockReturnValue({ eq: eq1, gte, lte, order });
    mockFrom.mockReturnValue({ select });
    return { select, eq1, eq2, gte, lte, order };
  }

  it("filtra por status", async () => {
    const chain = setupQueryChain([{ id: "a1" }]);
    await listAllocations({ status: "draft" });
    expect(mockFrom).toHaveBeenCalledWith("commission_allocations");
    expect(chain.eq1).toHaveBeenCalledWith("status", "draft");
  });

  it("sem filtros chama .order direto", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ order });
    mockFrom.mockReturnValue({ select });

    const r = await listAllocations({});
    expect(r).toEqual([]);
  });
});

describe("approveAllocations", () => {
  it("retorna 0 se ids vazio sem chamar Supabase", async () => {
    const r = await approveAllocations([]);
    expect(r).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("UPDATE com .in(ids) + .eq(status, draft)", async () => {
    const eq = vi.fn().mockResolvedValue({ count: 2, error: null });
    const inFn = vi.fn().mockReturnValue({ eq });
    const update = vi.fn().mockReturnValue({ in: inFn });
    mockFrom.mockReturnValue({ update });

    const r = await approveAllocations(["a1", "a2"]);
    expect(mockFrom).toHaveBeenCalledWith("commission_allocations");
    expect(update).toHaveBeenCalledWith({ status: "approved" });
    expect(inFn).toHaveBeenCalledWith("id", ["a1", "a2"]);
    expect(eq).toHaveBeenCalledWith("status", "draft");
    expect(r).toBe(2);
  });
});

describe("markAllocationsPaid", () => {
  it("retorna 0 se ids vazio", async () => {
    expect(await markAllocationsPaid([], "ref-1")).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("UPDATE com paid_at + payout_reference", async () => {
    const eq = vi.fn().mockResolvedValue({ count: 1, error: null });
    const inFn = vi.fn().mockReturnValue({ eq });
    const update = vi.fn().mockReturnValue({ in: inFn });
    mockFrom.mockReturnValue({ update });

    const r = await markAllocationsPaid(["a1"], "PIX-2026-05-01");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "paid",
      payout_reference: "PIX-2026-05-01",
    }));
    expect(inFn).toHaveBeenCalledWith("id", ["a1"]);
    expect(eq).toHaveBeenCalledWith("status", "approved");
    expect(r).toBe(1);
  });
});

describe("pendingPayoutsByMember", () => {
  it("agrupa por team_member_id", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [
      { team_member_id: "m1", amount_cents: 1000, team_members: { full_name: "Russo", pix_key: "russo@x" } },
      { team_member_id: "m1", amount_cents: 2500, team_members: { full_name: "Russo", pix_key: "russo@x" } },
      { team_member_id: "m2", amount_cents: 500,  team_members: { full_name: "Sidney", pix_key: null } },
    ], error: null });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const r = await pendingPayoutsByMember();
    expect(eq).toHaveBeenCalledWith("status", "approved");
    expect(r).toHaveLength(2);
    const russo = r.find(x => x.team_member_id === "m1");
    const sidney = r.find(x => x.team_member_id === "m2");
    expect(russo?.total_cents).toBe(3500);
    expect(russo?.name).toBe("Russo");
    expect(russo?.pix_key).toBe("russo@x");
    expect(sidney?.total_cents).toBe(500);
    expect(sidney?.pix_key).toBeNull();
  });

  it("retorna [] se sem allocations approved", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    expect(await pendingPayoutsByMember()).toEqual([]);
  });
});
