import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { WellnessForm } from "./wellness-form";

export const metadata: Metadata = { title: "Notificações — KathApp" };

interface ReminderRow {
  daily_video_enabled: boolean;
  daily_video_time: string;
  hydration_enabled: boolean;
  hydration_times: string[];
}

const DEFAULT_HYDRATION = ["09:00", "12:00", "15:00", "18:00"];

export default async function NotificacoesPage() {
  const { userId } = await auth();
  // Admin + filtro user_id (RLS bloqueava ler proprio profile/reminder em dev).
  const supabase = createAdminSupabaseClient();

  const [{ data: profileRaw }, { data: reminderRaw }] = await Promise.all([
    supabase.from("profiles").select("plan_tier").eq("id", userId!).single(),
    supabase
      .from("wellness_reminders" as never)
      .select("daily_video_enabled, daily_video_time, hydration_enabled, hydration_times")
      .eq("user_id" as never, userId!)
      .maybeSingle(),
  ]);

  const planTier = ((profileRaw as { plan_tier: string | null } | null)?.plan_tier) ?? "free";
  const isPaid = planTier !== "free";

  const reminder = reminderRaw as unknown as ReminderRow | null;
  const initial = {
    daily_video_enabled: reminder?.daily_video_enabled ?? true,
    // backend grava HH:MM:SS; UI usa HH:MM
    daily_video_time: (reminder?.daily_video_time ?? "08:00:00").slice(0, 5),
    hydration_enabled: reminder?.hydration_enabled ?? false,
    hydration_times: (reminder?.hydration_times ?? DEFAULT_HYDRATION).map((t) => t.slice(0, 5)),
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6 space-y-5 pb-24 lg:pb-6">
      <Link
        href="/perfil"
        className="inline-flex items-center gap-2 text-pink text-[13px] font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-white leading-tight">
          NOTIFICAÇÕES
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Configure os lembretes que você quer receber no seu app.
        </p>
      </div>

      <WellnessForm initial={initial} isPaid={isPaid} planTier={planTier} />
    </div>
  );
}
