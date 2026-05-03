import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabaseClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

import {
  spendWalletCents,
  creditWalletCents,
  getWalletActiveCents,
  getWalletBalance,
  expireWalletCredits,
  listWalletCreditsForUser,
} from "./wallet";

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
});

describe("spendWalletCents", () => {
  it("chama RPC com args corretos", async () => {
    mockRpc.mockResolvedValueOnce({ data: 500, error: null });
    const r = await spendWalletCents({ userId: "user_1", amountCents: 1000, revenueStreamId: "rs_1" });
    expect(mockRpc).toHaveBeenCalledWith("spend_wallet_cents", {
      p_user_id: "user_1",
      p_amount_cents: 1000,
      p_revenue_stream_id: "rs_1",
    });
    expect(r).toBe(500);
  });

  it("retorna 0 sem chamar RPC se amountCents <= 0", async () => {
    expect(await spendWalletCents({ userId: "u", amountCents: 0 })).toBe(0);
    expect(await spendWalletCents({ userId: "u", amountCents: -100 })).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("revenueStreamId e null por default", async () => {
    mockRpc.mockResolvedValueOnce({ data: 100, error: null });
    await spendWalletCents({ userId: "user_1", amountCents: 100 });
    expect(mockRpc).toHaveBeenCalledWith("spend_wallet_cents", {
      p_user_id: "user_1",
      p_amount_cents: 100,
      p_revenue_stream_id: null,
    });
  });

  it("propaga erro do RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "db_error" } });
    await expect(spendWalletCents({ userId: "u", amountCents: 100 })).rejects.toThrow(/db_error/);
  });
});

describe("creditWalletCents", () => {
  it("chama RPC com validade default 120 dias", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await creditWalletCents({ userId: "user_1", amountCents: 200, sourceStreamId: "rs_1" });
    expect(mockRpc).toHaveBeenCalledWith("credit_wallet_cents", {
      p_user_id: "user_1",
      p_amount_cents: 200,
      p_source_stream_id: "rs_1",
      p_validity_days: 120,
    });
  });

  it("aceita validade custom", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await creditWalletCents({ userId: "user_1", amountCents: 200, sourceStreamId: "rs_1", validityDays: 30 });
    expect(mockRpc).toHaveBeenCalledWith("credit_wallet_cents", {
      p_user_id: "user_1",
      p_amount_cents: 200,
      p_source_stream_id: "rs_1",
      p_validity_days: 30,
    });
  });

  it("nao chama RPC se amountCents <= 0", async () => {
    await creditWalletCents({ userId: "u", amountCents: 0, sourceStreamId: "rs_1" });
    await creditWalletCents({ userId: "u", amountCents: -50, sourceStreamId: "rs_1" });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("getWalletActiveCents", () => {
  it("retorna saldo via RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: 1500, error: null });
    expect(await getWalletActiveCents("user_1")).toBe(1500);
    expect(mockRpc).toHaveBeenCalledWith("wallet_active_cents", { p_user_id: "user_1" });
  });

  it("retorna 0 se data null", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await getWalletActiveCents("user_1")).toBe(0);
  });
});

describe("expireWalletCredits", () => {
  it("retorna total expirado via RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: 350, error: null });
    expect(await expireWalletCredits()).toBe(350);
    expect(mockRpc).toHaveBeenCalledWith("expire_wallet_credits");
  });
});

describe("getWalletBalance", () => {
  it("le tabela wallet_balance", async () => {
    const single = vi.fn().mockResolvedValue({ data: { active_cents: 100, earned_total_cents: 500, spent_total_cents: 300, expired_total_cents: 100 }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const r = await getWalletBalance("user_1");
    expect(mockFrom).toHaveBeenCalledWith("wallet_balance");
    expect(r.active_cents).toBe(100);
    expect(r.earned_total_cents).toBe(500);
  });

  it("retorna zeros se balance nao existe (PGRST116)", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const r = await getWalletBalance("user_new");
    expect(r).toEqual({ active_cents: 0, earned_total_cents: 0, spent_total_cents: 0, expired_total_cents: 0 });
  });
});

describe("listWalletCreditsForUser", () => {
  it("lista ate 100 por default ordenado por created_at desc", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "c1" }], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const r = await listWalletCreditsForUser("user_1");
    expect(mockFrom).toHaveBeenCalledWith("wallet_credits");
    expect(eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(100);
    expect(r).toHaveLength(1);
  });
});
