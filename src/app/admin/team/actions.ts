"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const memberSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  full_name: z.string().min(1).max(120),
  role: z.enum(["owner", "partner", "consultant"]),
  pix_key: z.string().max(120).nullable().optional(),
  is_active: z.coerce.boolean().default(true),
});

export async function upsertTeamMember(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  // is_active checkbox: presença significa true; ausência → false
  if (!("is_active" in raw)) raw.is_active = "false";
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("invalid_input: " + parsed.error.flatten().formErrors.join(", "));
  }
  const supabase = createAdminSupabaseClient();
  const { id, ...data } = parsed.data;

  if (id) {
    const { error } = await supabase.from("team_members").update(data).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("team_members").insert(data);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/team");
  revalidatePath("/admin/team/regras");
}

export async function deactivateTeamMember(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
}

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  team_member_id: z.string().uuid(),
  applies_to_type: z
    .enum(["mensalidade", "loja", "estetica", "afiliado_externo"])
    .nullable()
    .optional(),
  applies_to_category: z.string().max(80).nullable().optional(),
  pct: z.coerce.number().min(0).max(100),
  is_active: z.coerce.boolean().default(true),
});

export async function upsertCommissionRule(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  if (!("is_active" in raw)) raw.is_active = "false";
  // Empty string → null para applies_to_type/category
  const cleaned = {
    ...raw,
    applies_to_type: raw.applies_to_type === "" ? null : raw.applies_to_type,
    applies_to_category: raw.applies_to_category === "" ? null : raw.applies_to_category,
  };
  const parsed = ruleSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error("invalid_input: " + parsed.error.flatten().formErrors.join(", "));
  }

  const supabase = createAdminSupabaseClient();
  const { id, ...data } = parsed.data;

  if (id) {
    const { error } = await supabase.from("commission_rules").update(data).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("commission_rules").insert(data);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/team/regras");
}

export async function deactivateCommissionRule(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("commission_rules")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team/regras");
}
