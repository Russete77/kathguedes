"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

export type ReviewItem = {
  id: string;
  user_id: string;
  full_name: string;
  package_type: string;
  status: string;
  valid_until: string;
  created_at: string;
  ai_draft_generated_at: string | null;
  flags: string[];
  has_anamnesis: boolean;
};

type RawRow = {
  id: string;
  user_id: string;
  package_type: string;
  status: string;
  valid_until: string;
  created_at: string;
  ai_draft_generated_at: string | null;
  ai_flags: unknown;
  anamnesis: unknown;
  profiles: { full_name: string } | null;
};

/**
 * Fila de revisão: consultorias que aguardam ação da Kath (pendentes de anamnese,
 * em montagem, com rascunho de IA pronto). Entregues ficam de fora. Mais antigas
 * primeiro (SLA).
 */
export async function getReviewQueue(): Promise<ReviewItem[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("consultations")
    .select(
      "id, user_id, package_type, status, valid_until, created_at, ai_draft_generated_at, ai_flags, anamnesis, profiles!inner(full_name)",
    )
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawRow[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    full_name: r.profiles?.full_name ?? "—",
    package_type: r.package_type,
    status: r.status,
    valid_until: r.valid_until,
    created_at: r.created_at,
    ai_draft_generated_at: r.ai_draft_generated_at,
    flags: Array.isArray(r.ai_flags) ? (r.ai_flags as string[]) : [],
    has_anamnesis: r.anamnesis != null,
  }));
}

const deliverSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Entrega (status='delivered') uma ou várias consultorias e notifica os alunos.
 * Usada para aprovar em lote os rascunhos já revisados.
 */
export async function deliverConsultationsBatch(input: {
  ids: string[];
}): Promise<{ ok: true; delivered: number }> {
  await requireAdmin();
  const { ids } = deliverSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  const { data: rows, error } = await supabase
    .from("consultations")
    .update({ status: "delivered" })
    .in("id", ids)
    .select("user_id");
  if (error) throw new Error(error.message);

  for (const r of (rows ?? []) as { user_id: string }[]) {
    notifyUser(r.user_id, {
      title: "Seu plano está pronto!",
      body: "Sua consultoria foi liberada. Abra o app e confira seu treino e dieta.",
      icon: "Crown",
      url: "/consultoria",
    }).catch(() => {});
  }

  revalidatePath("/admin/consultorias/inbox");
  revalidatePath("/admin/consultorias");
  return { ok: true, delivered: (rows ?? []).length };
}
