import { getBookings } from "../actions";
import { BookingsKanban } from "./bookings-kanban";

export const metadata = { title: "Kath Estética · Agendamentos" };

export default async function AdminEsteticaBookingsPage() {
  const bookings = await getBookings();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">AGENDAMENTOS</h1>
        <p className="text-gray-2 text-sm mt-1">
          Gerencie o status dos serviços da estética.
        </p>
      </div>
      <BookingsKanban bookings={bookings as unknown as BookingRow[]} />
    </div>
  );
}

interface BookingRow {
  id: string;
  user_id: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "in_progress" | "done" | "canceled" | "no_show";
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  customer_name: string;
  customer_phone: string;
  total_cents: number;
  loyalty_free: boolean;
  estetica_services: { title: string } | null;
}

export type { BookingRow };
