"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { updateScheduleDay, blockSlot, unblockSlot } from "../actions";
import type { DayRow, BlockedRow } from "./page";

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function ScheduleManager({
  schedule,
  blocked,
}: {
  schedule: DayRow[];
  blocked: BlockedRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ starts_at: "", ends_at: "", reason: "" });

  function handleDaySave(day: DayRow, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const opensAt = (fd.get("opens_at") as string) || null;
    const closesAt = (fd.get("closes_at") as string) || null;
    const isClosed = fd.get("is_closed") === "on";
    const slotMinutes = Number(fd.get("slot_minutes"));

    startTransition(async () => {
      try {
        await updateScheduleDay(day.day_of_week, opensAt, closesAt, isClosed, slotMinutes);
        toast.success(`${dayNames[day.day_of_week]} atualizado`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  function handleBlock() {
    if (!form.starts_at || !form.ends_at) return;
    startTransition(async () => {
      try {
        await blockSlot(form.starts_at, form.ends_at, form.reason);
        toast.success("Slot bloqueado");
        setForm({ starts_at: "", ends_at: "", reason: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  function handleUnblock(id: string) {
    startTransition(async () => {
      try {
        await unblockSlot(id);
        toast.success("Bloqueio removido");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl text-white mb-3">DIAS DA SEMANA</h2>
        <div className="space-y-2">
          {schedule.map((day) => (
            <form
              key={day.day_of_week}
              onSubmit={(e) => handleDaySave(day, e)}
              className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 flex flex-wrap items-center gap-3"
            >
              <div className="font-display text-lg text-white w-24">
                {dayNames[day.day_of_week]}
              </div>
              <label className="flex items-center gap-2 text-[12px] text-gray-2">
                <input
                  type="checkbox"
                  name="is_closed"
                  defaultChecked={day.is_closed}
                  className="w-4 h-4 accent-pink"
                />
                Fechado
              </label>
              <input
                type="time"
                name="opens_at"
                defaultValue={day.opens_at || "08:00"}
                className="bg-bg-2 border border-gray-4 rounded-[8px] text-white px-3 py-2 text-sm outline-none focus:border-pink"
              />
              <span className="text-gray-3">—</span>
              <input
                type="time"
                name="closes_at"
                defaultValue={day.closes_at || "18:00"}
                className="bg-bg-2 border border-gray-4 rounded-[8px] text-white px-3 py-2 text-sm outline-none focus:border-pink"
              />
              <label className="flex items-center gap-2 text-[12px] text-gray-2">
                Slot:
                <input
                  type="number"
                  name="slot_minutes"
                  defaultValue={day.slot_minutes}
                  className="bg-bg-2 border border-gray-4 rounded-[8px] text-white px-2 py-2 text-sm w-16 outline-none focus:border-pink"
                />
                min
              </label>
              <Button type="submit" size="sm" disabled={pending} className="ml-auto">
                {pending && <Loader2 size={12} className="animate-spin" />}
                Salvar
              </Button>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-white mb-3">BLOQUEIO DE HORÁRIOS</h2>
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white px-3 py-2 text-sm outline-none focus:border-pink"
            />
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white px-3 py-2 text-sm outline-none focus:border-pink"
            />
            <input
              placeholder="Motivo"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white px-3 py-2 text-sm outline-none focus:border-pink placeholder:text-gray-3"
            />
          </div>
          <Button onClick={handleBlock} disabled={pending || !form.starts_at || !form.ends_at}>
            <Plus size={14} />
            Bloquear
          </Button>
        </div>

        {blocked.length > 0 && (
          <div className="mt-4 space-y-2">
            {blocked.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between bg-bg-1 border border-gray-4 rounded-[14px] p-3"
              >
                <div className="flex items-center gap-3">
                  <Lock size={14} className="stroke-yellow" />
                  <div className="text-[13px]">
                    <div className="text-white">
                      {new Date(b.starts_at).toLocaleString("pt-BR")} →{" "}
                      {new Date(b.ends_at).toLocaleString("pt-BR")}
                    </div>
                    {b.reason && <div className="text-gray-3 text-[11px]">{b.reason}</div>}
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(b.id)}
                  disabled={pending}
                  className="text-gray-2 hover:text-danger p-2"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
