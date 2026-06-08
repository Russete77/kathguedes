"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Edit2, Power, Trash2 } from "lucide-react";
import {
  toggleScheduleActive,
  deleteSchedule,
  type ScheduleRow,
} from "./actions";
import { ScheduleForm } from "./schedule-form";

const PLAN_LABEL: Record<string, string> = {
  start: "Treino",
  evolucao: "Evolução",
  saude_completa: "Saúde",
  atleta: "Atleta",
};

export function ScheduleList({ schedules }: { schedules: ScheduleRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (schedules.length === 0) {
    return (
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-10 text-center">
        <p className="text-gray-2">
          Nenhum schedule cadastrado. Clique em <span className="text-pink">Novo schedule</span>.
        </p>
      </div>
    );
  }

  async function handleToggle(id: string, current: boolean) {
    setBusyId(id);
    try {
      await toggleScheduleActive(id, !current);
      toast.success(current ? "Schedule desativado" : "Schedule ativo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esse schedule? Os toggles dos users também serão removidos.")) return;
    setBusyId(id);
    try {
      await deleteSchedule(id);
      toast.success("Schedule excluído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {schedules.map((s) => (
        <div
          key={s.id}
          className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 flex flex-col lg:flex-row gap-4"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-[11px] text-gray-3 uppercase tracking-wider px-2 py-0.5 bg-bg-2 rounded">
                {s.category}
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                  s.is_active ? "bg-green-400/20 text-green-400" : "bg-gray-4 text-gray-2"
                }`}
              >
                {s.is_active ? "ON" : "OFF"}
              </span>
              {s.default_enabled && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-pink/20 text-pink">
                  default ON
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold">{s.title}</h3>
            <p className="text-gray-2 text-sm mt-0.5">{s.body}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-3">
              <span>
                <strong className="text-gray-2">Horários:</strong> {s.times.join(", ")}
              </span>
              <span>
                <strong className="text-gray-2">Planos:</strong>{" "}
                {s.eligible_plans.length === 0
                  ? "todos"
                  : s.eligible_plans.map((p) => PLAN_LABEL[p] ?? p).join(", ")}
              </span>
              <span>
                <strong className="text-gray-2">URL:</strong> {s.url}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:flex-col lg:items-end">
            <ScheduleForm schedule={s}>
              <button
                type="button"
                className="p-2 text-gray-2 hover:text-pink rounded"
                title="Editar"
              >
                <Edit2 size={16} />
              </button>
            </ScheduleForm>
            <button
              type="button"
              onClick={() => handleToggle(s.id, s.is_active)}
              disabled={busyId === s.id}
              className="p-2 text-gray-2 hover:text-pink rounded disabled:opacity-40"
              title={s.is_active ? "Desativar" : "Reativar"}
            >
              <Power size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              disabled={busyId === s.id}
              className="p-2 text-gray-2 hover:text-red-500 rounded disabled:opacity-40"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
