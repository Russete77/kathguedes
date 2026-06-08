"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";

export interface ScheduleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  icon: string | null;
  url: string;
  times: string[];
  eligible_plans: string[];
  default_enabled: boolean;
  category: string;
  sort_order: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:\d{2})?$/;

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug: minusculas, 0-9, -"),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  icon: z.string().max(60).optional().nullable(),
  url: z.string().min(1).max(200),
  times_csv: z
    .string()
    .min(1, "informe pelo menos 1 horario")
    .transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean))
    .refine(
      (arr) => arr.every((t) => timeRegex.test(t)),
      "horarios em HH:MM separados por virgula",
    ),
  eligible_plans_csv: z
    .string()
    .optional()
    .nullable()
    .transform((s) =>
      (s ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  default_enabled: z.coerce.boolean().default(true),
  category: z.string().min(1).max(40),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
  description: z.string().max(500).optional().nullable(),
});

export async function listSchedules(): Promise<ScheduleRow[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("notification_schedules" as never)
    .select("*")
    .order("sort_order" as never, { ascending: true });
  if (error) throw new Error(error.message);
  // Postgres time[] vem como strings HH:MM:SS — normaliza pra HH:MM na UI.
  return ((data ?? []) as unknown as ScheduleRow[]).map((r) => ({
    ...r,
    times: (r.times ?? []).map((t) => (t.length >= 5 ? t.slice(0, 5) : t)),
  }));
}

export async function upsertSchedule(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  if (!("is_active" in raw)) raw.is_active = "false";
  if (!("default_enabled" in raw)) raw.default_enabled = "false";

  const parsed = scheduleSchema.safeParse({
    ...raw,
    icon: raw.icon || null,
    description: raw.description || null,
  });
  if (!parsed.success) {
    throw new Error("invalid_input: " + parsed.error.flatten().formErrors.join(", "));
  }

  const supabase = createAdminSupabaseClient();
  const { id, times_csv, eligible_plans_csv, ...rest } = parsed.data;
  const payload: Record<string, unknown> = {
    ...rest,
    times: times_csv.map((t) => (t.length === 5 ? `${t}:00` : t)),
    eligible_plans: eligible_plans_csv,
  };

  if (id) {
    const { error } = await supabase
      .from("notification_schedules" as never)
      .update(payload as never)
      .eq("id" as never, id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("notification_schedules" as never)
      .insert(payload as never);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/push/schedules");
  revalidatePath("/perfil/notificacoes");
}

export async function toggleScheduleActive(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("notification_schedules" as never)
    .update({ is_active: active } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/push/schedules");
  revalidatePath("/perfil/notificacoes");
}

export async function deleteSchedule(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("notification_schedules" as never)
    .delete()
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/push/schedules");
}
