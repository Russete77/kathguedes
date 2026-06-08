import Link from "next/link";
import { Calendar } from "lucide-react";
import { PushForm } from "./push-form";

export const metadata = { title: "Push Notifications" };

export default function AdminPushPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-white">
            PUSH <span className="text-pink">NOTIFICATIONS</span>
          </h1>
          <p className="text-gray-2 text-sm mt-1">
            Envio único agora. Para pushes recorrentes (diário/horário), use Schedules.
          </p>
        </div>
        <Link
          href="/admin/push/schedules"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-bg-1 border border-gray-4 text-pink hover:border-pink/50 text-sm whitespace-nowrap"
        >
          <Calendar size={16} />
          Schedules
        </Link>
      </div>
      <PushForm />
    </div>
  );
}
