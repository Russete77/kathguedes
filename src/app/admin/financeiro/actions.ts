"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import {
  approveAllocations as approveAllocationsLib,
  markAllocationsPaid as markPaidLib,
} from "@/lib/billing/commissions";
import { recordRevenueStream } from "@/lib/billing/revenue";

export async function approveAllocations(ids: string[]): Promise<number> {
  await requireAdmin();
  if (ids.length === 0) return 0;
  const n = await approveAllocationsLib(ids);
  revalidatePath("/admin/financeiro/comissoes");
  return n;
}

export async function markAllocationsPaid(formData: FormData): Promise<number> {
  await requireAdmin();
  const ids = formData.getAll("ids[]").map(String).filter(Boolean);
  const reference = String(formData.get("reference") ?? "").trim();
  if (ids.length === 0 || !reference) return 0;
  const n = await markPaidLib(ids, reference);
  revalidatePath("/admin/financeiro/comissoes");
  return n;
}

const payoutSchema = z.object({
  platform: z.enum(["amazon", "mercadolivre", "shopee", "direto"]),
  year_month: z.string().regex(/^\d{4}-\d{2}$/, "formato YYYY-MM"),
  amount_cents: z.coerce.number().int().min(1),
  fitness_pct: z.coerce.number().min(0).max(100),
  moto_pct: z.coerce.number().min(0).max(100),
  geral_pct: z.coerce.number().min(0).max(100),
});

export async function recordAffiliatePayout(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = payoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("invalid_input: " + parsed.error.flatten().formErrors.join(", "));
  }
  const { platform, year_month, amount_cents, fitness_pct, moto_pct, geral_pct } = parsed.data;
  const sumPct = fitness_pct + moto_pct + geral_pct;
  if (Math.abs(sumPct - 100) > 0.01) {
    throw new Error(`pct_must_sum_100 (atual=${sumPct})`);
  }

  const occurredAt = new Date(`${year_month}-15T12:00:00Z`).toISOString();
  const slices: Array<{ category: string; pct: number }> = [
    { category: "fitness", pct: fitness_pct },
    { category: "moto", pct: moto_pct },
    { category: "geral", pct: geral_pct },
  ];

  for (const s of slices) {
    if (s.pct === 0) continue;
    const cents = Math.round((amount_cents * s.pct) / 100);
    await recordRevenueStream({
      type: "afiliado_externo",
      category: s.category,
      user_id: null,
      reference_type: "affiliate_payout",
      reference_id: `${platform}-${year_month}-${s.category}`,
      asaas_payment_id: null,
      gross_cents: cents,
      cost_cents: 0,
      cashback_used_cents: 0,
      occurred_at: occurredAt,
    });
  }
  revalidatePath("/admin/financeiro/afiliado-externo");
  revalidatePath("/admin/financeiro");
}
