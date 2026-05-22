"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { updateBookingStatus, markBookingRemainderPaid, deleteBooking } from "../actions";
import { toast } from "sonner";
import { Gift, Car, Phone, Clock, Loader2, CheckCircle2, Store, Trash2 } from "lucide-react";
import { formatPrice, formatDateTime } from "@/lib/estetica/types";
import type { BookingRow } from "./page";

type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_debito"
  | "cartao_credito"
  | "transferencia"
  | "outro";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Débito",
  cartao_credito: "Crédito",
  transferencia: "Transferência",
  outro: "Outro",
};

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
  const [methodById, setMethodById] = useState<Record<string, PaymentMethod>>({});

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

  function handleRemainderPaid(id: string) {
    const method = methodById[id] ?? "pix";
    startTransition(async () => {
      try {
        await markBookingRemainderPaid(id, method);
        toast.success(`Restante quitado · ${PAYMENT_METHOD_LABEL[method]}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  function handleDelete(b: BookingRow) {
    const isPaid = !!b.paid_at;
    const isSignalPaid = !!b.prepay_paid_at;
    const warning = isPaid
      ? "ATENÇÃO: este agendamento já foi pago. O dinheiro permanece em revenue_streams, mas o booking some.\n\n"
      : isSignalPaid
        ? "ATENÇÃO: este agendamento tem sinal pago. O dinheiro permanece em revenue_streams, mas o booking some.\n\n"
        : "";
    const msg = `${warning}Excluir agendamento de ${b.customer_name} (${b.vehicle_plate})?\n\nPara cancelar SEM apagar, use o botão "→ canceled".`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteBooking(b.id);
        toast.success("Agendamento excluído");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir");
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display text-xl text-white">
                      {b.estetica_services?.title || "Serviço"}
                    </div>
                    {b.created_by_admin && (
                      <Badge variant="white" className="gap-1 text-[10px]">
                        <Store size={10} /> LOJA
                      </Badge>
                    )}
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
                  <div className="text-right">
                    <div className="font-display text-lg text-pink">
                      {formatPrice(b.total_cents)}
                    </div>
                    {(b.prepay_cents ?? 0) > 0 && b.paid_at == null && (
                      <div className="text-[10px] text-gray-3 leading-tight mt-0.5">
                        {b.prepay_paid_at ? (
                          <>
                            <span className="text-success">
                              sinal {formatPrice(b.prepay_cents ?? 0)} pago
                            </span>
                            <br />
                            <span className="text-yellow">
                              resta {formatPrice(b.remaining_cents ?? 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow">
                            aguardando sinal de {formatPrice(b.prepay_cents ?? 0)}
                          </span>
                        )}
                      </div>
                    )}
                    {b.paid_at && (
                      <div className="text-[10px] text-success leading-tight mt-0.5 flex items-center gap-1 justify-end">
                        <CheckCircle2 size={10} /> quitado
                      </div>
                    )}
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

              <div className="flex gap-2 flex-wrap pt-3 border-t border-gray-4 items-center">
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
                <button
                  onClick={() => handleDelete(b)}
                  disabled={pending}
                  aria-label="Excluir agendamento"
                  title="Excluir agendamento"
                  className="ml-auto p-1.5 rounded-full text-gray-3 hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Quitação presencial: aparece quando sinal pago + restante > 0 */}
              {b.paid_at == null && (b.remaining_cents ?? 0) > 0 && b.prepay_paid_at && (
                <div className="pt-3 border-t border-gray-4 space-y-2">
                  <div className="text-[11px] text-gray-2 uppercase tracking-wider">
                    Quitar restante presencialmente
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={methodById[b.id] ?? "pix"}
                      onChange={(e) =>
                        setMethodById((prev) => ({
                          ...prev,
                          [b.id]: e.target.value as PaymentMethod,
                        }))
                      }
                      className="flex-1 bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[12px] px-3 py-2 outline-none focus:border-pink"
                    >
                      {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemainderPaid(b.id)}
                      disabled={pending}
                      className="px-4 py-2 rounded-[8px] text-[12px] font-semibold bg-pink text-white hover:bg-pink-light disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
                    >
                      {pending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      Quitar {formatPrice(b.remaining_cents ?? 0)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
