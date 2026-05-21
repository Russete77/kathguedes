import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/cron/booking-reminder
 *
 * Cron diário (9h da manhã) — busca bookings da estética com status
 * `pending` ou `confirmed` que acontecem nas próximas 24-48h e notifica o user.
 *
 * Configurar no `vercel.json`:
 *   { "path": "/api/cron/booking-reminder", "schedule": "0 12 * * *" }
 *   (12h UTC = 9h Brasília — confirmar se Vercel cron usa UTC; sim, usa)
 *
 * Segurança: protegido por header `Authorization: Bearer <CRON_SECRET>`
 * (Vercel envia automaticamente em cronjobs configurados em vercel.json).
 */
export async function GET(req: NextRequest) {
  try {
    // Validação Vercel Cron — todo cron route deve ser autenticado
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();

    // Janela: do início de amanhã (~24h adiante) até o fim de amanhã (~48h adiante).
    // Cron roda diariamente — então em qualquer dia D, ele notifica bookings de D+1.
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);

    const { data: bookings, error } = await supabase
      .from("estetica_bookings")
      .select("id, user_id, scheduled_at, vehicle_brand, vehicle_model, service_id, estetica_services(title)")
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", tomorrow.toISOString())
      .lt("scheduled_at", dayAfter.toISOString());

    if (error) {
      throw new Error(`select bookings fail: ${error.message}`);
    }

    type BookingRow = {
      id: string;
      user_id: string;
      scheduled_at: string;
      vehicle_brand: string;
      vehicle_model: string;
      estetica_services: { title: string } | null;
    };
    const rows = (bookings ?? []) as unknown as BookingRow[];

    let sent = 0;
    for (const b of rows) {
      const time = new Date(b.scheduled_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const serviceTitle = b.estetica_services?.title ?? "Serviço de estética";

      try {
        await notifyUser(b.user_id, {
          title: "Lembrete: agendamento amanhã",
          body: `${serviceTitle} às ${time} — ${b.vehicle_brand} ${b.vehicle_model}.`,
          icon: "Clock",
          url: "/kath-estetica/meus-agendamentos",
        });
        sent += 1;
      } catch (notifyErr) {
        console.error("[booking-reminder] notify fail for", b.id, notifyErr);
        // continua mesmo se uma falha; cron não deve travar
      }
    }

    return NextResponse.json({
      ok: true,
      window: { from: tomorrow.toISOString(), to: dayAfter.toISOString() },
      bookings_found: rows.length,
      notifications_sent: sent,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/booking-reminder");
  }
}
