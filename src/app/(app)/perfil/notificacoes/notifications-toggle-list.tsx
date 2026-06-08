"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Droplets, Flame, PlayCircle, Heart } from "lucide-react";
import { toggleNotificationPref } from "./actions";

export interface ScheduleView {
  id: string;
  slug: string;
  title: string;
  body: string;
  icon: string | null;
  times: string[];
  category: string;
  enabled: boolean;
}

function pickIcon(name: string | null) {
  switch ((name ?? "").toLowerCase()) {
    case "droplets":
      return Droplets;
    case "flame":
      return Flame;
    case "playcircle":
      return PlayCircle;
    case "heart":
      return Heart;
    default:
      return Bell;
  }
}

export function NotificationsToggleList({
  schedules,
}: {
  schedules: ScheduleView[];
}) {
  // Estado local pra UI otimista — persiste a escolha mesmo em revalidate.
  const [state, setState] = useState<Record<string, boolean>>(() =>
    schedules.reduce((acc, s) => {
      acc[s.id] = s.enabled;
      return acc;
    }, {} as Record<string, boolean>),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleToggle(id: string) {
    const next = !state[id];
    setState((s) => ({ ...s, [id]: next }));
    setBusyId(id);
    try {
      await toggleNotificationPref({ schedule_id: id, enabled: next });
      startTransition(() => {
        // sem-op — só pra hint do React que terminou
      });
    } catch (e) {
      // Rollback
      setState((s) => ({ ...s, [id]: !next }));
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {schedules.map((s) => {
        const Icon = pickIcon(s.icon);
        const on = state[s.id];
        return (
          <div
            key={s.id}
            className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 flex items-start gap-4"
          >
            <div
              className={`shrink-0 p-2.5 rounded-[10px] ${
                on ? "bg-pink/15 text-pink" : "bg-bg-2 text-gray-3"
              }`}
            >
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold leading-tight">
                {s.title}
              </h3>
              <p className="text-gray-2 text-sm mt-1">{s.body}</p>
              <div className="text-[11px] font-mono text-gray-3 mt-2 uppercase tracking-wider">
                Horários: {s.times.join(", ")}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? "Desativar" : "Ativar"} ${s.title}`}
              onClick={() => handleToggle(s.id)}
              disabled={busyId === s.id}
              className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
                on ? "bg-pink" : "bg-gray-4"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  on ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
