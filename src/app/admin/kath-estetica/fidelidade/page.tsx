import { getPendingLoyaltyPhotos } from "../actions";
import { LoyaltyApprovalList } from "./approval-list";

export const metadata = { title: "Kath Estética · Fidelidade" };

export default async function AdminEsteticaLoyaltyPage() {
  const photos = await getPendingLoyaltyPhotos();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">FIDELIDADE</h1>
        <p className="text-gray-2 text-sm mt-1">
          Aprove as fotos que contam no programa 4 → 5ª lavagem grátis.
        </p>
      </div>
      <LoyaltyApprovalList photos={photos as unknown as PhotoRow[]} />
    </div>
  );
}

interface PhotoRow {
  id: string;
  user_id: string;
  booking_id: string;
  photo_url: string;
  month: string;
  approved: boolean;
  created_at: string;
  profiles: { full_name: string } | null;
  estetica_bookings: {
    vehicle_plate: string;
    vehicle_brand: string;
    vehicle_model: string;
  } | null;
}

export type { PhotoRow };
