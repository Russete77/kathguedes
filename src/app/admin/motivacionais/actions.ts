"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { extractYoutubeId } from "@/lib/youtube/embed";

const videoSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  body: z.string().max(1000).nullable().optional(),
  youtube_id: z.string().min(1, "Link do YouTube obrigatório").max(500),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
});

export type MotivationalVideoInput = z.infer<typeof videoSchema>;

interface VideoRow {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export async function getMotivationalVideos(): Promise<VideoRow[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("motivational_videos" as never)
    .select("id, title, body, youtube_id, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VideoRow[];
}

export async function createMotivationalVideo(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    raw[key] = value === "" ? null : value;
  });
  // Checkbox unchecked não vem no FormData
  raw.is_active = formData.get("is_active") === "on" || formData.get("is_active") === "true";
  const data = videoSchema.parse(raw);

  const youtubeId = extractYoutubeId(data.youtube_id);
  if (!youtubeId) throw new Error("Link do YouTube inválido");

  const { error } = await supabase.from("motivational_videos" as never).insert({
    title: data.title,
    body: data.body ?? null,
    youtube_id: youtubeId,
    sort_order: data.sort_order,
    is_active: data.is_active,
  } as never);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/motivacionais");
}

export async function updateMotivationalVideo(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    raw[key] = value === "" ? null : value;
  });
  raw.is_active = formData.get("is_active") === "on" || formData.get("is_active") === "true";
  const data = videoSchema.parse(raw);

  const youtubeId = extractYoutubeId(data.youtube_id);
  if (!youtubeId) throw new Error("Link do YouTube inválido");

  const { error } = await supabase
    .from("motivational_videos" as never)
    .update({
      title: data.title,
      body: data.body ?? null,
      youtube_id: youtubeId,
      sort_order: data.sort_order,
      is_active: data.is_active,
    } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/motivacionais");
}

export async function toggleMotivationalVideoActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("motivational_videos" as never)
    .update({ is_active: active } as never)
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/motivacionais");
}

export async function deleteMotivationalVideo(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("motivational_videos" as never)
    .delete()
    .eq("id" as never, id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/motivacionais");
}
