import { getSchedule } from "../actions";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ScheduleManager } from "./schedule-manager";

export const metadata = { title: "Kath Estética · Horários" };

export default async function AdminHorariosPage() {
  const schedule = await getSchedule();
  const supabase = createAdminSupabaseClient();
  const { data: blockedRaw } = await supabase
    .from("estetica_slots_blocked")
    .select("*")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">HORÁRIOS</h1>
        <p className="text-gray-2 text-sm mt-1">
          Configure dias de funcionamento e bloqueie horários específicos (folgas, feriados).
        </p>
      </div>
      <ScheduleManager
        schedule={schedule as unknown as DayRow[]}
        blocked={(blockedRaw || []) as unknown as BlockedRow[]}
      />
    </div>
  );
}

interface DayRow {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  slot_minutes: number;
}

interface BlockedRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export type { DayRow, BlockedRow };
