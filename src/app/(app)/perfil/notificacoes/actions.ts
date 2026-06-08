"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const togglePrefSchema = z.object({
  schedule_id: z.string().uuid(),
  enabled: z.boolean(),
});

/**
 * Persiste o toggle on/off do user para 1 schedule.
 * O conteudo e horarios NAO mexem (admin define em /admin/push/schedules).
 *
 * O server confirma que o schedule existe + esta ativo + e elegivel ao plano
 * do user antes de gravar (defesa em profundidade contra IDOR no schedule_id).
 */
export async function toggleNotificationPref(input: {
  schedule_id: string;
  enabled: boolean;
}): Promise<{ ok: true; enabled: boolean }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Nao autenticado");

  const data = togglePrefSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  const { data: scheduleRaw } = await supabase
    .from("notification_schedules" as never)
    .select("id, eligible_plans, is_active")
    .eq("id" as never, data.schedule_id)
    .single();
  const schedule = scheduleRaw as unknown as
    | { id: string; eligible_plans: string[]; is_active: boolean }
    | null;
  if (!schedule || !schedule.is_active) {
    throw new Error("Schedule nao disponivel.");
  }

  if (schedule.eligible_plans.length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();
    const planTier =
      (profile as { plan_tier: string | null } | null)?.plan_tier ?? null;
    if (!planTier || !schedule.eligible_plans.includes(planTier)) {
      throw new Error("Essa notificacao e exclusiva para outros planos.");
    }
  }

  const { error } = await supabase
    .from("user_notification_prefs" as never)
    .upsert(
      {
        user_id: userId,
        schedule_id: data.schedule_id,
        enabled: data.enabled,
      } as never,
      { onConflict: "user_id,schedule_id" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/perfil/notificacoes");
  return { ok: true, enabled: data.enabled };
}
