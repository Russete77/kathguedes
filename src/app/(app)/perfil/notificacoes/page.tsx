import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { NotificationsToggleList, type ScheduleView } from "./notifications-toggle-list";

export const metadata: Metadata = { title: "Notificacoes - KathApp" };

interface ScheduleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  icon: string | null;
  times: string[];
  eligible_plans: string[];
  default_enabled: boolean;
  category: string;
  sort_order: number;
  is_active: boolean;
  description: string | null;
}

interface PrefRow {
  schedule_id: string;
  enabled: boolean;
}

export default async function NotificacoesPage() {
  const { userId } = await auth();
  // Admin client porque RLS ainda depende do claim role:"authenticated"
  // chegando ao Supabase. Filtro explicito por user_id mantem o IDOR fora.
  const supabase = createAdminSupabaseClient();

  const [{ data: profileRaw }, { data: schedulesRaw }, { data: prefsRaw }] =
    await Promise.all([
      supabase.from("profiles").select("plan_tier").eq("id", userId!).single(),
      supabase
        .from("notification_schedules" as never)
        .select(
          "id, slug, title, body, icon, times, eligible_plans, default_enabled, category, sort_order, is_active, description",
        )
        .eq("is_active" as never, true)
        .order("sort_order" as never, { ascending: true }),
      supabase
        .from("user_notification_prefs" as never)
        .select("schedule_id, enabled")
        .eq("user_id" as never, userId!),
    ]);

  const planTier =
    ((profileRaw as { plan_tier: string | null } | null)?.plan_tier) ?? "start";

  const allSchedules = (schedulesRaw ?? []) as unknown as ScheduleRow[];
  const prefs = ((prefsRaw ?? []) as unknown as PrefRow[]).reduce(
    (acc, p) => {
      acc[p.schedule_id] = p.enabled;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  // Filtra por plano (eligible_plans vazio = todos)
  const visibleSchedules: ScheduleView[] = allSchedules
    .filter(
      (s) =>
        s.eligible_plans.length === 0 || s.eligible_plans.includes(planTier),
    )
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      body: s.body,
      icon: s.icon,
      times: (s.times ?? []).map((t) => (t.length >= 5 ? t.slice(0, 5) : t)),
      category: s.category,
      // Se nunca interagiu, usa default_enabled do schedule
      enabled: prefs[s.id] ?? s.default_enabled,
    }));

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
          NOTIFICACOES
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          A Kath programa o conteudo e os horarios. Voce decide o que quer receber.
        </p>
      </div>

      {visibleSchedules.length === 0 ? (
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-8 text-center">
          <p className="text-gray-2 text-sm">
            Nenhuma notificacao programada para o seu plano no momento.
          </p>
        </div>
      ) : (
        <NotificationsToggleList schedules={visibleSchedules} />
      )}
    </div>
  );
}
