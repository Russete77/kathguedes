"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { _resetPlanCache } from "@/lib/billing/plans";
import type { Json } from "@/lib/supabase/database.types";

const planUpdateSchema = z.object({
  slug: z.enum(["free", "acesso", "plano1", "plano2", "plano3", "atleta"]),
  name: z.string().min(1).max(120),
  price_cents: z.coerce.number().int().min(0),
  asaas_value: z.coerce.number().min(0),
  asaas_description: z.string().max(200),
  cashback_pct: z.coerce.number().min(0).max(100),
  store_discount_pct: z.coerce.number().int().min(0).max(100),
  estetica_discount_pct: z.coerce.number().int().min(0).max(100),
  features_json: z.string().refine(
    s => {
      try {
        const parsed = JSON.parse(s);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
      } catch {
        return false;
      }
    },
    "JSON invalido — use {} para vazio"
  ),
  is_active: z.coerce.boolean().default(true),
});

export async function updatePlan(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  if (!("is_active" in raw)) raw.is_active = "false";
  const parsed = planUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("invalid_input: " + parsed.error.flatten().formErrors.join(", "));
  }

  const features = JSON.parse(parsed.data.features_json) as Json;

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: parsed.data.name,
      price_cents: parsed.data.price_cents,
      asaas_value: parsed.data.asaas_value,
      asaas_description: parsed.data.asaas_description,
      cashback_pct: parsed.data.cashback_pct,
      store_discount_pct: parsed.data.store_discount_pct,
      estetica_discount_pct: parsed.data.estetica_discount_pct,
      features,
      is_active: parsed.data.is_active,
    })
    .eq("slug", parsed.data.slug);

  if (error) throw new Error(error.message);

  // Invalidate cache for next reads
  _resetPlanCache();

  revalidatePath("/admin/plans");
  revalidatePath("/planos");
}
