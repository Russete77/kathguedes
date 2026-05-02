import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Calendar, Car, ArrowLeft, Gift, Clock } from "lucide-react";
import {
  type EsteticaBooking,
  type EsteticaBookingStatus,
  formatPrice,
  formatDateTime,
} from "@/lib/estetica/types";
import { BookingActions } from "./booking-actions";

export const metadata: Metadata = { title: "Meus Agendamentos — Estética" };

const statusLabel: Record<EsteticaBookingStatus, string> = {
  pending: "Aguardando pagamento",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  done: "Concluído",
  canceled: "Cancelado",
  no_show: "Não compareceu",
};

const statusColor: Record<EsteticaBookingStatus, "pink" | "yellow" | "white" | "dark"> = {
  pending: "yellow",
  confirmed: "pink",
  in_progress: "pink",
  done: "white",
  canceled: "dark",
  no_show: "dark",
};

export default async function MeusAgendamentosPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const { data: bookingsRaw } = await supabase
    .from("estetica_bookings")
    .select("*, estetica_services(title, category)")
    .eq("user_id", userId!)
    .order("scheduled_at", { ascending: false });

  const bookings = (bookingsRaw || []) as unknown as (EsteticaBooking & {
    estetica_services: { title: string; category: string } | null;
  })[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/kath-estetica"
        className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div>
        <h1 className="font-display text-4xl text-white">
          MEUS <span className="text-pink">AGENDAMENTOS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Histórico de serviços na Kath Guedes Estética.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 bg-bg-1 border border-gray-4 rounded-[22px]">
          <Calendar size={48} className="stroke-gray-3 mx-auto mb-4" />
          <p className="text-gray-2 mb-4">Você ainda não tem agendamentos.</p>
          <Link
            href="/kath-estetica/servicos"
            className="inline-flex items-center gap-2 font-body font-semibold text-sm px-6 py-3 bg-pink text-white rounded-full hover:bg-pink-light"
          >
            Ver serviços
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-bg-1 border border-gray-4 rounded-[22px] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant={statusColor[b.status]}>
                    {statusLabel[b.status]}
                  </Badge>
                  <h3 className="font-display text-xl text-white mt-2">
                    {b.estetica_services?.title?.toUpperCase() || "SERVIÇO"}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-[12px] text-gray-3">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDateTime(b.scheduled_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Car size={12} />
                      {b.vehicle_brand} {b.vehicle_model} · {b.vehicle_plate}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {b.loyalty_free ? (
                    <Badge variant="pink" className="gap-1">
                      <Gift size={10} />
                      GRÁTIS
                    </Badge>
                  ) : (
                    <div className="font-display text-[22px] leading-none text-pink">
                      {formatPrice(b.total_cents)}
                    </div>
                  )}
                </div>
              </div>

              <BookingActions booking={b} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
