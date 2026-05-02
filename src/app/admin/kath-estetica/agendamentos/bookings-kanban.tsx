"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { updateBookingStatus } from "../actions";
import { toast } from "sonner";
import { Gift, Car, Phone, Clock, Loader2 } from "lucide-react";
import { formatPrice, formatDateTime } from "@/lib/estetica/types";
import type { BookingRow } from "./page";

type Status = BookingRow["status"];

const columns: { id: Status; label: string }[] = [
  { id: "pending", label: "Aguardando pagto" },
  { id: "confirmed", label: "Confirmado" },
  { id: "in_progress", label: "Em andamento" },
  { id: "done", label: "Concluído" },
  { id: "canceled", label: "Cancelado" },
];

const nextStatusByCurrent: Record<Status, Status[]> = {
  pending: ["confirmed", "canceled"],
  confirmed: ["in_progress", "canceled", "no_show"],
  in_progress: ["done", "canceled"],
  done: [],
  canceled: [],
  no_show: [],
};

export function BookingsKanban({ bookings }: { bookings: BookingRow[] }) {
  const [pending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<Status | "all">("all");

  function handleTransition(id: string, next: Status) {
    startTransition(async () => {
      try {
        await updateBookingStatus(id, next);
        toast.success("Status atualizado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  const filtered =
    activeFilter === "all" ? bookings : bookings.filter((b) => b.status === activeFilter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${
            activeFilter === "all"
              ? "bg-pink text-white"
              : "bg-bg-2 text-gray-2 hover:text-white border border-gray-4"
          }`}
        >
          Todos ({bookings.length})
        </button>
        {columns.map((c) => {
          const count = bookings.filter((b) => b.status === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setActiveFilter(c.id)}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${
                activeFilter === c.id
                  ? "bg-pink text-white"
                  : "bg-bg-2 text-gray-2 hover:text-white border border-gray-4"
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-bg-1 border border-gray-4 rounded-[22px]">
          <p className="text-gray-2">Nenhum agendamento.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-bg-1 border border-gray-4 rounded-[22px] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-xl text-white">
                    {b.estetica_services?.title || "Serviço"}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-3 mt-1">
                    <Clock size={11} />
                    {formatDateTime(b.scheduled_at)}
                  </div>
                </div>
                {b.loyalty_free ? (
                  <Badge variant="pink" className="gap-1">
                    <Gift size={10} /> GRÁTIS
                  </Badge>
                ) : (
                  <div className="font-display text-lg text-pink">
                    {formatPrice(b.total_cents)}
                  </div>
                )}
              </div>

              <div className="text-[12px] text-gray-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Car size={12} className="stroke-gray-3" />
                  {b.vehicle_brand} {b.vehicle_model} · {b.vehicle_plate}
                </div>
                <div>{b.customer_name}</div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="stroke-gray-3" />
                  <a
                    href={`https://wa.me/${b.customer_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener"
                    className="text-pink hover:text-pink-light"
                  >
                    {b.customer_phone}
                  </a>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-3 border-t border-gray-4">
                <Badge variant="white">{b.status}</Badge>
                {nextStatusByCurrent[b.status].map((next) => (
                  <button
                    key={next}
                    onClick={() => handleTransition(b.id, next)}
                    disabled={pending}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-bg-2 border border-gray-4 text-gray-2 hover:text-pink hover:border-pink/40 transition-all"
                  >
                    {pending ? <Loader2 size={10} className="animate-spin inline" /> : "→ "}
                    {next}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
