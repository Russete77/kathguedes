"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";

export interface PromoCodeRow {
  id: string;
  slug: string;
  plan_tier: string;
  promo_value_cents: number;
  discount_cents: number;
  max_uses: number;
  uses_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const promoSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2, "slug minimo 2 chars")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "slug uppercase: A-Z 0-9 _ -")
    .transform((v) => v.toUpperCase()),
  plan_tier: z.enum(["start", "evolucao", "saude_completa", "atleta"]),
  promo_value_cents: z.coerce.number().int().min(1),
  discount_cents: z.coerce.number().int().min(0).default(0),
  max_uses: z.coerce.number().int().min(1).max(10_000),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  is_active: z.coerce.boolean().default(true),
});

export async function listPromoCodes(): Promise<PromoCodeRow[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("promo_codes" as never)
    .select("*")
    .order("slug", { ascending: true })
    .order("plan_tier", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PromoCodeRow[];
}

export async function upsertPromoCode(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  if (!("is_active" in raw)) raw.is_active = "false";
  const cleaned = {
    ...raw,
    starts_at: raw.starts_at || null,
    ends_at: raw.ends_at || null,
    description: raw.description || null,
  };
  const parsed = promoSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error("invalid_input: " + parsed.error.flatten().formErrors.join(", "));
  }

  const supabase = createAdminSupabaseClient();
  const { id, ...data } = parsed.data;

  if (id) {
    const { error } = await supabase
      .from("promo_codes" as never)
      .update(data as never)
      .eq("id" as never, id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("promo_codes" as never).insert(data as never);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/promocoes");
  revalidatePath("/");
}

export async function togglePromoActive(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("promo_codes" as never)
    .update({ is_active: active } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/promocoes");
}

export async function resetPromoCounter(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("promo_codes" as never)
    .update({ uses_count: 0 } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/promocoes");
}
