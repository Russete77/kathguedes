import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listSchedules } from "./actions";
import { ScheduleList } from "./schedule-list";
import { ScheduleForm } from "./schedule-form";

export const metadata = { title: "Schedules de Notificação" };
export const dynamic = "force-dynamic";

export default async function AdminSchedulesPage() {
  const schedules = await listSchedules();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Link
        href="/admin/push"
        className="inline-flex items-center gap-2 text-pink text-[13px] font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={14} />
        Voltar para Push
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-white">SCHEDULES</h1>
          <p className="text-gray-2 text-sm mt-1">
            Pushes recorrentes programados. O admin define horários e conteúdo;
            o user só liga/desliga no perfil.
          </p>
        </div>
        <ScheduleForm />
      </div>

      <ScheduleList schedules={schedules} />
    </div>
  );
}
