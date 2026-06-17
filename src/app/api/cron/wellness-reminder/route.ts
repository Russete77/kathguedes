import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/cron/wellness-reminder  (roda 1× por HORA — vercel.json: "0 * * * *")
 *
 * SENDER dos pushes recorrentes definidos pela EQUIPE em `notification_schedules`
 * (admin define conteúdo + horários; o user só liga/desliga em /perfil/notificacoes).
 *
 * Para cada schedule ATIVO cujo horário cai na janela da hora atual:
 *   • Envia para todos os usuários COM push inscrito, elegíveis pelo plano,
 *     que não desligaram a notificação (user_notification_prefs; default vem do
 *     próprio schedule).
 *   • Regras por categoria:
 *       - "hidratacao": só assinatura ativa (active/past_due).
 *       - "motivacional": só 2x/semana (segunda e sexta) e usa o VÍDEO DO DIA
 *         (link in-app /motivacional/<id>), rotacionado deterministicamente.
 *
 * Janela: o horário do schedule casa com [hora atual, +60min). Como o cron roda
 * 1×/h (Vercel Pro), cada horário dispara num único run (anti-spam natural).
 * Segurança: Authorization: Bearer ${CRON_SECRET}.
 */

const TIMEZONE = "America/Sao_Paulo";

// Cadência do motivacional (sem ser incisivo): 2x/semana de manhã.
const MOTIVATIONAL_WEEKDAYS = ["Mon", "Fri"];

interface ScheduleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  icon: string | null;
  url: string;
  times: string[]; // "HH:MM" ou "HH:MM:SS"
  eligible_plans: string[];
  default_enabled: boolean;
  category: string;
}

interface MotivationalVideo {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function isPaidActive(tier: string | null, status: string | null): boolean {
  // No modelo de 4 tiers todos são pagos; mas 'canceled' não paga ativamente.
  if (!tier) return false;
  return status === "active" || status === "past_due";
}

function pickVideoForDay(videos: MotivationalVideo[]): MotivationalVideo | null {
  if (videos.length === 0) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return videos[dayOfYear % videos.length];
}

function isHydration(s: ScheduleRow): boolean {
  return s.category === "hidratacao" || s.slug.includes("hidrat");
}
function isMotivational(s: ScheduleRow): boolean {
  return s.category === "motivacional" || s.slug.includes("motivac");
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hora atual em São Paulo
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const nowMinutes = hour * 60 + minute;
    const windowStart = nowMinutes;
    const windowEnd = nowMinutes + 60;

    const weekdayShort = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
    }).format(new Date()); // "Mon", "Tue", ...

    const supabase = createAdminSupabaseClient();

    // 1. Schedules ativos cujo horário cai na janela atual.
    const { data: schedulesRaw, error: schErr } = await supabase
      .from("notification_schedules" as never)
      .select(
        "id, slug, title, body, icon, url, times, eligible_plans, default_enabled, category",
      )
      .eq("is_active" as never, true);
    if (schErr) throw new Error(`select schedules: ${schErr.message}`);

    const schedules = (schedulesRaw ?? []) as unknown as ScheduleRow[];
    const due = schedules.filter((s) => {
      const slotMatch = (s.times ?? []).some((t) => {
        const m = timeStrToMinutes(t);
        return m >= windowStart && m < windowEnd;
      });
      if (!slotMatch) return false;
      // Motivacional só dispara 2x/semana (seg/sex).
      if (isMotivational(s) && !MOTIVATIONAL_WEEKDAYS.includes(weekdayShort)) {
        return false;
      }
      return true;
    });

    if (due.length === 0) {
      return NextResponse.json({
        ok: true,
        window: `${hour}:${String(minute).padStart(2, "0")} ${TIMEZONE}`,
        due: 0,
        sent: 0,
      });
    }

    // 2. Vídeo motivacional do dia (se algum schedule motivacional está due).
    let todaysVideo: MotivationalVideo | null = null;
    if (due.some(isMotivational)) {
      const { data: videosRaw } = await supabase
        .from("motivational_videos" as never)
        .select("id, title, body, youtube_id")
        .eq("is_active" as never, true)
        .order("sort_order" as never, { ascending: true });
      todaysVideo = pickVideoForDay((videosRaw ?? []) as unknown as MotivationalVideo[]);
    }

    // 3. Candidatos = usuários com push inscrito.
    const { data: subsRaw } = await supabase
      .from("push_subscriptions")
      .select("user_id");
    const userIds = Array.from(
      new Set(((subsRaw ?? []) as { user_id: string }[]).map((s) => s.user_id)),
    );
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, due: due.length, sent: 0, candidates: 0 });
    }

    // 4. Perfis (plano + status) dos candidatos.
    const { data: profilesRaw } = await supabase
      .from("profiles")
      .select("id, plan_tier, subscription_status")
      .in("id", userIds);
    const profileMap = new Map(
      ((profilesRaw ?? []) as {
        id: string;
        plan_tier: string | null;
        subscription_status: string | null;
      }[]).map((p) => [p.id, p]),
    );

    // 5. Preferências explícitas (liga/desliga) para os schedules due.
    const dueIds = due.map((s) => s.id);
    const { data: prefsRaw } = await supabase
      .from("user_notification_prefs" as never)
      .select("user_id, schedule_id, enabled")
      .in("schedule_id" as never, dueIds);
    const prefMap = new Map(
      ((prefsRaw ?? []) as { user_id: string; schedule_id: string; enabled: boolean }[]).map(
        (p) => [`${p.user_id}|${p.schedule_id}`, p.enabled],
      ),
    );

    // 6. Dispara.
    let sent = 0;
    for (const s of due) {
      const hydration = isHydration(s);
      const motivational = isMotivational(s);
      if (motivational && !todaysVideo) continue; // sem vídeo, não manda

      const recipients = userIds.filter((uid) => {
        const prof = profileMap.get(uid);
        if (!prof) return false;
        // Elegibilidade por plano (vazio = todos)
        if (
          s.eligible_plans.length > 0 &&
          (!prof.plan_tier || !s.eligible_plans.includes(prof.plan_tier))
        ) {
          return false;
        }
        // Hidratação: só assinatura ativa
        if (hydration && !isPaidActive(prof.plan_tier, prof.subscription_status)) {
          return false;
        }
        // Liga/desliga do usuário (default = do schedule)
        const enabled = prefMap.get(`${uid}|${s.id}`) ?? s.default_enabled;
        return enabled;
      });

      const payload = motivational
        ? {
            title: todaysVideo!.title,
            body: todaysVideo!.body ?? "Toque para assistir o vídeo do dia.",
            icon: "PlayCircle",
            url: `/motivacional/${todaysVideo!.id}`,
          }
        : {
            title: s.title,
            body: s.body,
            icon: s.icon ?? undefined,
            url: s.url,
          };

      const results = await Promise.allSettled(
        recipients.map((uid) => notifyUser(uid, payload)),
      );
      sent += results.filter((r) => r.status === "fulfilled").length;
    }

    return NextResponse.json({
      ok: true,
      window: `${hour}:${String(minute).padStart(2, "0")} ${TIMEZONE}`,
      weekday: weekdayShort,
      due: due.length,
      candidates: userIds.length,
      sent,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/wellness-reminder");
  }
}
