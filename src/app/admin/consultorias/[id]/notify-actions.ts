"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import { runConsultationDraft, type DraftResult } from "@/lib/consultoria/draft";

/**
 * Notifica o assinante (push) para preencher a ficha de anamnese.
 * Só admin. No-op seguro se o user não tiver push inscrito.
 */
export async function notifyAnamnesePending(consultationId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("consultations")
    .select("user_id, anamnesis")
    .eq("id", consultationId)
    .single();
  const consult = data as { user_id: string; anamnesis: unknown } | null;
  if (!consult) throw new Error("Consultoria não encontrada");
  if (consult.anamnesis) throw new Error("Anamnese já foi preenchida");

  await notifyUser(consult.user_id, {
    title: "Preencha sua ficha de anamnese",
    body: "A Kath precisa dos seus dados pra montar seu plano personalizado. Leva 2 minutos!",
    icon: "ClipboardList",
    url: "/consultoria/anamnese",
  });
}

/**
 * Gera (ou regenera) o rascunho da consultoria com IA. Só admin.
 * O rascunho cai no workout_plan/diet_plan/macros para a Kath revisar e editar.
 */
export async function generateConsultationDraftAction(
  consultationId: string,
): Promise<DraftResult> {
  await requireAdmin();
  const result = await runConsultationDraft(consultationId);
  revalidatePath(`/admin/consultorias/${consultationId}`);
  revalidatePath("/admin/consultorias");
  return result;
}
