import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/cron/wellness-reminder
 *
 * Roda 1× por hora. Para cada user com preferências em wellness_reminders:
 *   • HIDRATAÇÃO (plano pago): se `hour:minute` da timezone do servidor
 *     bater com algum slot em `hydration_times`, envia push.
 *   • VÍDEO MOTIVACIONAL (todos): se `hour:minute` == `daily_video_time`,
 *     envia push com um vídeo escolhido determinísticamente pelo dia do ano
 *     (todos os users veem o mesmo vídeo no mesmo dia, mas rotaciona).
 *
 * Janela de tolerância: o cron compara apenas a HORA (minute precision a partir
 * do minuto do agendamento, com janela de 1h). Schedule recomendado em
 * vercel.json: `0 * * * *` (de hora em hora, no minuto 0).
 *
 * Segurança: Authorization: Bearer ${CRON_SECRET} (mesmo padrão dos outros
 * crons em src/app/api/cron/*).
 *
 * Anti-spam: grava last_hydration_sent / last_video_sent. Se já enviou
 * dentro da janela de 50 min anteriores, pula — protege contra reentregas
 * de cron (Vercel pode disparar duplicado em raras condições).
 */

const TIMEZONE = "America/Sao_Paulo";
const HYDRATION_NOTES = [
  "Hora de beber água! Manter hidratação ajuda a recuperar o músculo.",
  "Um copo agora vale ouro. Hidratar = performar.",
  "Beba água. Seu corpo e seus treinos agradecem.",
  "Lembrete da Kath: hidratação é parte do treino.",
];

interface Reminder {
  user_id: string;
  hydration_enabled: boolean;
  hydration_times: string[]; // "HH:MM:SS"
  daily_video_enabled: boolean;
  daily_video_time: string; // "HH:MM:SS"
  last_hydration_sent: string | null;
  last_video_sent: string | null;
  plan_tier: string | null;
}

interface MotivationalVideo {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
}

function timeStrToMinutes(t: string): number {
  // Aceita "HH:MM" ou "HH:MM:SS"
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function isPaidTier(tier: string | null): boolean {
  // Tiers pagos: tudo que não é null/free
  return !!tier && tier !== "free";
}

function pickVideoForDay(videos: MotivationalVideo[]): MotivationalVideo | null {
  if (videos.length === 0) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return videos[dayOfYear % videos.length];
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hora atual em São Paulo, em minutos desde meia-noite
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const nowMinutes = hour * 60 + minute;
    const windowStart = nowMinutes;
    const windowEnd = nowMinutes + 60; // janela de 1h a partir da hora atual

    const supabase = createAdminSupabaseClient();

    // Join wellness_reminders + profiles para gating de plano
    const { data: remindersRaw, error: remErr } = await supabase
      .from("wellness_reminders" as never)
      .select(
        "user_id, hydration_enabled, hydration_times, daily_video_enabled, daily_video_time, last_hydration_sent, last_video_sent, profiles!inner(plan_tier)",
      )
      .or("hydration_enabled.eq.true,daily_video_enabled.eq.true");
    if (remErr) throw new Error(`select reminders: ${remErr.message}`);

    const reminders = ((remindersRaw ?? []) as unknown as Array<
      Omit<Reminder, "plan_tier"> & { profiles: { plan_tier: string | null } }
    >).map((r) => ({
      user_id: r.user_id,
      hydration_enabled: r.hydration_enabled,
      hydration_times: r.hydration_times ?? [],
      daily_video_enabled: r.daily_video_enabled,
      daily_video_time: r.daily_video_time,
      last_hydration_sent: r.last_hydration_sent,
      last_video_sent: r.last_video_sent,
      plan_tier: r.profiles?.plan_tier ?? null,
    })) as Reminder[];

    // Carrega biblioteca de vídeos uma vez
    const { data: videosRaw } = await supabase
      .from("motivational_videos" as never)
      .select("id, title, body, youtube_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const videos = (videosRaw ?? []) as unknown as MotivationalVideo[];
    const todaysVideo = pickVideoForDay(videos);

    const nowIso = new Date().toISOString();
    let hydrationSent = 0;
    let videosSent = 0;
    const skipped: { user_id: string; reason: string }[] = [];

    for (const r of reminders) {
      // ── 1. HIDRATAÇÃO (somente planos pagos) ──
      if (r.hydration_enabled) {
        if (!isPaidTier(r.plan_tier)) {
          skipped.push({ user_id: r.user_id, reason: "hydration_requires_paid_plan" });
        } else {
          const matchesSlot = r.hydration_times.some((t) => {
            const slot = timeStrToMinutes(t);
            return slot >= windowStart && slot < windowEnd;
          });
          // Anti-spam: 50 min de cooldown
          const tooRecent =
            r.last_hydration_sent &&
            Date.now() - new Date(r.last_hydration_sent).getTime() < 50 * 60 * 1000;

          if (matchesSlot && !tooRecent) {
            const body = HYDRATION_NOTES[Math.floor(Math.random() * HYDRATION_NOTES.length)];
            await notifyUser(r.user_id, {
              title: "Hora de hidratar",
              body,
              icon: "Droplets",
              url: "/perfil",
            });
            await supabase
              .from("wellness_reminders" as never)
              .update({ last_hydration_sent: nowIso } as never)
              .eq("user_id" as never, r.user_id);
            hydrationSent++;
          }
        }
      }

      // ── 2. VÍDEO MOTIVACIONAL DIÁRIO (todos os planos) ──
      if (r.daily_video_enabled && todaysVideo) {
        const slot = timeStrToMinutes(r.daily_video_time);
        const matchesSlot = slot >= windowStart && slot < windowEnd;
        // 20h de cooldown — diário mas evita reentregar no dia seguinte se cron atrasar
        const tooRecent =
          r.last_video_sent &&
          Date.now() - new Date(r.last_video_sent).getTime() < 20 * 60 * 60 * 1000;

        if (matchesSlot && !tooRecent) {
          await notifyUser(r.user_id, {
            title: todaysVideo.title,
            body: todaysVideo.body ?? "Toque para assistir o vídeo do dia.",
            icon: "PlayCircle",
            // Abre IN-APP no player vertical (Shorts-style) — antes mandava direto
            // pro YouTube externo e quebrava a experiencia.
            url: `/motivacional/${todaysVideo.id}`,
          });
          await supabase
            .from("wellness_reminders" as never)
            .update({ last_video_sent: nowIso } as never)
            .eq("user_id" as never, r.user_id);
          videosSent++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      window: `${hour}:${String(minute).padStart(2, "0")} ${TIMEZONE}`,
      candidates: reminders.length,
      hydrationSent,
      videosSent,
      skipped: skipped.length,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/wellness-reminder");
  }
}
