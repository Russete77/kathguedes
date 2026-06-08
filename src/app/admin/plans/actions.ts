"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { _resetPlanCache } from "@/lib/billing/plans";
import type { Json } from "@/lib/supabase/database.types";

const planUpdateSchema = z.object({
  slug: z.enum(["start", "evolucao", "saude_completa", "atleta"]),
  name: z.string().min(1).max(120),
  // Preços por ciclo (modelo semestral/anual). /mês em centavos (display) e
  // total à vista em reais (valor cobrado no Asaas).
  monthly_semestral_cents: z.coerce.number().int().min(0),
  asaas_value_semestral: z.coerce.number().min(0),
  monthly_anual_cents: z.coerce.number().int().min(0),
  asaas_value_anual: z.coerce.number().min(0),
  asaas_description: z.string().max(200),
  cashback_pct: z.coerce.number().min(0).max(100),
  store_discount_pct: z.coerce.number().int().min(0).max(100),
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
  const d = parsed.data;

  // Totais à vista em centavos derivados do valor em reais.
  const totalSemestralCents = Math.round(d.asaas_value_semestral * 100);
  const totalAnualCents = Math.round(d.asaas_value_anual * 100);

  // database.types.ts ainda não tem as colunas de ciclo (migration 43) — usa
  // Record + cast, mesmo padrão do resto do projeto enquanto os types não são
  // regenerados (ver nota em admin/treinos/page.tsx sobre is_free_preview).
  const updatePayload: Record<string, unknown> = {
    name: d.name,
    asaas_description: d.asaas_description,
    cashback_pct: d.cashback_pct,
    store_discount_pct: d.store_discount_pct,
    features,
    is_active: d.is_active,
    // Ciclos
    monthly_semestral_cents: d.monthly_semestral_cents,
    total_semestral_cents: totalSemestralCents,
    asaas_value_semestral: d.asaas_value_semestral,
    monthly_anual_cents: d.monthly_anual_cents,
    total_anual_cents: totalAnualCents,
    asaas_value_anual: d.asaas_value_anual,
    // "A partir de" (display/SEO) = /mês no anual.
    price_cents: d.monthly_anual_cents,
    asaas_value: d.monthly_anual_cents / 100,
  };

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("plans")
    .update(updatePayload as never)
    .eq("slug", d.slug);

  if (error) throw new Error(error.message);

  // Invalidate cache for next reads
  _resetPlanCache();

  revalidatePath("/admin/plans");
  revalidatePath("/planos");
}
