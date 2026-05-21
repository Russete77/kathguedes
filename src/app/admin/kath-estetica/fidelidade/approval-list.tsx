"use client";

import Image from "next/image";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { approveLoyaltyPhoto } from "../actions";
import { toast } from "sonner";
import type { PhotoRow } from "./page";

export function LoyaltyApprovalList({ photos }: { photos: PhotoRow[] }) {
  const [pending, startTransition] = useTransition();

  function handle(id: string, approved: boolean) {
    startTransition(async () => {
      try {
        await approveLoyaltyPhoto(id, approved);
        toast.success(approved ? "Foto aprovada" : "Foto reprovada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  const pendingPhotos = photos.filter((p) => !p.approved);
  const approvedPhotos = photos.filter((p) => p.approved);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl text-white mb-3">
          AGUARDANDO APROVAÇÃO ({pendingPhotos.length})
        </h2>
        {pendingPhotos.length === 0 ? (
          <p className="text-gray-3 text-sm">Nenhuma foto pendente.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingPhotos.map((p) => (
              <PhotoCard key={p.id} photo={p} pending={pending} onAction={handle} />
            ))}
          </div>
        )}
      </section>

      {approvedPhotos.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-white mb-3">
            APROVADAS RECENTES
          </h2>
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {approvedPhotos.slice(0, 10).map((p) => (
              <div
                key={p.id}
                className="relative aspect-square bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden"
              >
                <Image
                  src={p.photo_url}
                  alt="Foto aprovada"
                  fill
                  sizes="20vw"
                  className="object-cover"
                />
                <Badge variant="pink" className="absolute bottom-2 left-2 gap-1">
                  <Check size={10} />
                  OK
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  pending,
  onAction,
}: {
  photo: PhotoRow;
  pending: boolean;
  onAction: (id: string, approved: boolean) => void;
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden">
      <div className="relative aspect-square bg-bg-2">
        <Image
          src={photo.photo_url}
          alt="Foto fidelidade"
          fill
          sizes="33vw"
          className="object-cover"
        />
      </div>
      <div className="p-4 space-y-2">
        <div className="font-semibold text-white text-[14px]">
          {photo.profiles?.full_name || "Cliente"}
        </div>
        {photo.estetica_bookings && (
          <div className="text-[12px] text-gray-3">
            {photo.estetica_bookings.vehicle_brand}{" "}
            {photo.estetica_bookings.vehicle_model} ·{" "}
            {photo.estetica_bookings.vehicle_plate}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => onAction(photo.id, true)}
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />}
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            disabled={pending}
            onClick={() => onAction(photo.id, false)}
          >
            <X size={14} />
            Reprovar
          </Button>
        </div>
      </div>
    </div>
  );
}
