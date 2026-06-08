"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type TrainingSplit = {
  frequency: number;
  slots: string[];
  label: string | null;
  updated_at: string;
};

export async function getTrainingSplits(): Promise<TrainingSplit[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("training_splits")
    .select("frequency, slots, label, updated_at")
    .order("frequency", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingSplit[];
}

const saveSchema = z.object({
  frequency: z.coerce.number().int().min(1).max(7),
  // slots: lista separada por vírgula → array de slugs
  slots: z
    .string()
    .max(400)
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  label: z.string().max(80).optional(),
});

export async function saveTrainingSplit(input: {
  frequency: number;
  slots: string;
  label?: string;
}): Promise<{ ok: true }> {
  await requireAdmin();
  const data = saveSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("training_splits")
    .upsert(
      {
        frequency: data.frequency,
        slots: data.slots,
        label: data.label || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "frequency" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/consultorias/splits");
  return { ok: true };
}
