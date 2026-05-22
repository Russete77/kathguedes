"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Store, Trash2, Loader2 } from "lucide-react";
import { deleteBooking } from "../actions";
import type { BookingRow } from "./page";

type Status = BookingRow["status"];

// Mesmas cores do kanban — coerência visual
const STATUS_COLOR: Record<Status, string> = {
  pending: "bg-pink/20 text-pink border-pink/40",
  confirmed: "bg-green-500/20 text-green-300 border-green-500/40",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  done: "bg-gray-4/40 text-gray-2 border-gray-4",
  canceled: "bg-bg-2 text-gray-3 border-gray-4 line-through",
  no_show: "bg-bg-2 text-gray-3 border-gray-4 line-through",
};

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function BookingsCalendar({ bookings }: { bookings: BookingRow[] }) {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(b: BookingRow) {
    const isPaid = !!b.paid_at;
    const isSignalPaid = !!b.prepay_paid_at;
    const warning = isPaid
      ? "ATENÇÃO: este agendamento já foi pago. O dinheiro permanece em revenue_streams, mas o booking some.\n\n"
      : isSignalPaid
        ? "ATENÇÃO: este agendamento tem sinal pago. O dinheiro permanece em revenue_streams, mas o booking some.\n\n"
        : "";
    const msg = `${warning}Excluir agendamento de ${b.customer_name} (${b.vehicle_plate})?`;
    if (!confirm(msg)) return;
    setDeletingId(b.id);
    startTransition(async () => {
      try {
        await deleteBooking(b.id);
        toast.success("Agendamento excluído");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir");
      } finally {
        setDeletingId(null);
      }
    });
  }

  // Bucket: agrupa bookings por dia (key = yyyy-MM-dd em hora local)
  const byDay = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const d = new Date(b.scheduled_at);
      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    // Ordena por horário dentro de cada dia
    for (const [k, arr] of map) {
      arr.sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      );
      map.set(k, arr);
    }
    return map;
  }, [bookings]);

  // Grid: do início da semana do mês até fim da semana do mês (6 semanas × 7 dias = 42 células)
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  function handleDayClick(day: Date) {
    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-bg-1 border border-gray-4 rounded-[14px] p-3">
        <button
          onClick={() => setCursor(addMonths(cursor, -1))}
          aria-label="Mês anterior"
          className="p-2 rounded-md text-gray-2 hover:text-pink hover:bg-bg-2"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="font-display text-lg sm:text-xl text-white capitalize">
            {format(cursor, "MMMM", { locale: ptBR })}
          </div>
          <div className="text-[11px] text-gray-3 font-mono">
            {format(cursor, "yyyy")}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date())}
            className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1.5 rounded-md text-gray-2 hover:text-pink hover:bg-bg-2"
          >
            Hoje
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Próximo mês"
            className="p-2 rounded-md text-gray-2 hover:text-pink hover:bg-bg-2"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Grid mensal */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
        {/* Header de dias da semana */}
        <div className="grid grid-cols-7 border-b border-gray-4 bg-bg-2">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-1 py-2 text-[10px] sm:text-[11px] font-mono text-gray-3 tracking-wider text-center"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Células */}
        <div className="grid grid-cols-7">
          {monthDays.map((day, idx) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const events = byDay.get(dayKey) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const isCurrentDay = isToday(day);
            const isSelected = selectedDay && isSameDay(selectedDay, day);

            return (
              <button
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`min-h-[68px] sm:min-h-[96px] p-1 sm:p-1.5 text-left border-r border-b border-gray-4 last:border-r-0 transition-colors relative ${
                  inMonth ? "bg-transparent hover:bg-bg-2" : "bg-bg-2/40 opacity-40"
                } ${isSelected ? "bg-pink/10" : ""}`}
              >
                <div className="flex items-center justify-end">
                  <span
                    className={`inline-flex items-center justify-center text-[11px] sm:text-[13px] ${
                      isCurrentDay
                        ? "bg-pink text-white w-6 h-6 rounded-full font-semibold"
                        : isSelected
                          ? "text-pink font-semibold"
                          : inMonth
                            ? "text-white"
                            : "text-gray-3"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Lista compacta de eventos */}
                <div className="mt-1 space-y-0.5">
                  {events.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded border truncate flex items-center gap-1 ${STATUS_COLOR[e.status]}`}
                      title={`${format(new Date(e.scheduled_at), "HH:mm")} · ${e.customer_name} · ${e.estetica_services?.title ?? ""}`}
                    >
                      {e.created_by_admin && (
                        <Store size={8} className="shrink-0 opacity-70" />
                      )}
                      <span className="truncate">
                        <span className="font-mono">
                          {format(new Date(e.scheduled_at), "HH:mm")}
                        </span>{" "}
                        {e.customer_name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[9px] sm:text-[10px] text-gray-3 px-1">
                      +{events.length - 2}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do dia selecionado */}
      {selectedDay && (
        <div className="bg-bg-1 border border-pink/40 rounded-[14px] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base sm:text-lg text-white capitalize">
              {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-[11px] text-gray-3 hover:text-pink"
            >
              fechar
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-gray-3 text-sm">Nenhum agendamento neste dia.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li
                  key={e.id}
                  className={`p-3 rounded-[10px] border ${STATUS_COLOR[e.status]} flex items-start justify-between gap-3`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm">
                        {format(new Date(e.scheduled_at), "HH:mm")}
                      </span>
                      <span className="text-sm font-semibold">
                        {e.estetica_services?.title ?? "Serviço"}
                      </span>
                      {e.created_by_admin && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider border border-current/40 rounded-full px-1.5 py-0.5">
                          <Store size={9} /> Loja
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] mt-1 opacity-80">
                      {e.customer_name} ·{" "}
                      <a
                        href={`https://wa.me/${e.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener"
                        className="underline"
                      >
                        {e.customer_phone}
                      </a>
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5">
                      {e.vehicle_brand} {e.vehicle_model} · {e.vehicle_plate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] uppercase tracking-wider border border-current/40 rounded-full px-2 py-0.5">
                      {e.status}
                    </span>
                    <button
                      onClick={() => handleDelete(e)}
                      disabled={pending && deletingId === e.id}
                      aria-label="Excluir"
                      className="p-1.5 rounded-md text-current/60 hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                    >
                      {pending && deletingId === e.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
