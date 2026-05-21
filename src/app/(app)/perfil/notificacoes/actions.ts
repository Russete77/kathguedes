"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h

const prefsSchema = z.object({
  daily_video_enabled: z.boolean(),
  daily_video_time: z.string().regex(timeRegex, "Horário inválido (use HH:MM)"),
  hydration_enabled: z.boolean(),
  hydration_times: z
    .array(z.string().regex(timeRegex, "Horário inválido"))
    .max(8, "Máximo 8 lembretes por dia")
    .default([]),
});

export type WellnessPrefsInput = z.infer<typeof prefsSchema>;

function isPaidTier(tier: string | null | undefined): boolean {
  return !!tier && tier !== "free";
}

export async function saveWellnessPrefs(input: WellnessPrefsInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");

  const data = prefsSchema.parse(input);

  const supabase = createAdminSupabaseClient();

  // Gate de plano: hidratação só pra plano pago. Defesa em profundidade.
  if (data.hydration_enabled) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .single();
    const planTier = (profile as { plan_tier: string | null } | null)?.plan_tier ?? null;
    if (!isPaidTier(planTier)) {
      throw new Error(
        "Lembretes de hidratação são exclusivos para planos pagos. Conheça os planos.",
      );
    }
  }

  // Normalizar horários para HH:MM:SS (Postgres time)
  const hydrationTimes = data.hydration_times.map((t) =>
    t.length === 5 ? `${t}:00` : t,
  );
  const dailyVideoTime =
    data.daily_video_time.length === 5 ? `${data.daily_video_time}:00` : data.daily_video_time;

  const { error } = await supabase
    .from("wellness_reminders" as never)
    .upsert(
      {
        user_id: userId,
        daily_video_enabled: data.daily_video_enabled,
        daily_video_time: dailyVideoTime,
        hydration_enabled: data.hydration_enabled,
        hydration_times: hydrationTimes,
      } as never,
      { onConflict: "user_id" },
    );

  if (error) throw new Error(error.message);

  revalidatePath("/perfil/notificacoes");
  return { ok: true };
}
