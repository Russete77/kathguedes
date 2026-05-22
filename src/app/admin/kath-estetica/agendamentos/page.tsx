import { getBookings, getPricingMatrixData } from "../actions";
import { BookingsViewSwitcher } from "./bookings-view-switcher";
import { NewBookingButton } from "./new-booking-modal";

export const metadata = { title: "Kath Estética · Agendamentos" };

export default async function AdminEsteticaBookingsPage() {
  const [bookings, pricingData] = await Promise.all([
    getBookings(),
    getPricingMatrixData(),
  ]);

  // Bookable = ativo + aceita agendamento + tem matriz de preços cadastrada.
  // Lavagem Simples (requires_booking=false) é excluída — só via walk-in.
  const bookableServices = pricingData.services
    .filter((s) => s.is_active && s.requires_booking)
    .map((s) => ({
      id: s.id,
      title: s.title,
      duration_min: s.duration_min,
      pricing: pricingData.pricingByService[s.id],
    }))
    .filter((s) => s.pricing && s.pricing.options.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
            AGENDAMENTOS
          </h1>
          <p className="text-gray-2 text-xs sm:text-sm mt-1">
            Gerencie o status dos serviços e crie novos agendamentos pela loja.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <NewBookingButton services={bookableServices} />
        </div>
      </div>
      <BookingsViewSwitcher bookings={bookings as unknown as BookingRow[]} />
    </div>
  );
}

interface BookingRow {
  id: string;
  user_id: string | null;
  created_by_admin: string | null;
  scheduled_at: string;
  status: "pending" | "confirmed" | "in_progress" | "done" | "canceled" | "no_show";
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  customer_name: string;
  customer_phone: string;
  total_cents: number;
  prepay_cents: number | null;
  prepay_paid_at: string | null;
  paid_at: string | null;
  remaining_cents: number | null;
  loyalty_free: boolean;
  estetica_services: { title: string; cost_cents: number } | null;
}

export type { BookingRow };
