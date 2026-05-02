"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Loader2, QrCode, Camera, Check } from "lucide-react";
import type { EsteticaBooking } from "@/lib/estetica/types";

interface Props {
  booking: EsteticaBooking;
}

interface PixData {
  paymentId?: string;
  pixQrCode?: string;
  pixPayload?: string;
  method: string;
  invoiceUrl?: string;
  total: number;
}

export function BookingActions({ booking }: Props) {
  const [pix, setPix] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  async function generatePix() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/estetica/bookings/${booking.id}/payment`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setPix(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar Pix");
    } finally {
      setLoading(false);
    }
  }

  async function copyPayload() {
    if (!pix?.pixPayload) return;
    await navigator.clipboard.writeText(pix.pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Código Pix copiado");
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("booking_id", booking.id);
      const res = await fetch("/api/estetica/loyalty/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro no upload");
      }
      setPhotoUploaded(true);
      toast.success("Foto enviada! Aguarde aprovação da Kath.", {
        style: { borderLeft: "3px solid #FF0080" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setPhotoUploading(false);
    }
  }

  // Pending → botão gerar Pix
  if (booking.status === "pending" && !booking.loyalty_free) {
    return (
      <div className="pt-3 border-t border-gray-4">
        {!pix ? (
          <Button onClick={generatePix} disabled={loading} className="w-full">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
            {loading ? "Gerando..." : "Pagar via Pix"}
          </Button>
        ) : pix.pixQrCode ? (
          <div className="space-y-3">
            <div className="bg-white rounded-[14px] p-4 flex justify-center">
              <Image
                src={`data:image/png;base64,${pix.pixQrCode}`}
                alt="QR Code Pix"
                width={180}
                height={180}
              />
            </div>
            <Button onClick={copyPayload} variant="secondary" className="w-full">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado!" : "Copiar Pix Copia e Cola"}
            </Button>
            <p className="text-[11px] text-gray-3 text-center">
              Após o pagamento, o status atualiza automaticamente.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  // Done → botão upload de foto pra fidelidade
  if (booking.status === "done") {
    return (
      <div className="pt-3 border-t border-gray-4">
        {photoUploaded ? (
          <div className="flex items-center gap-2 text-success text-sm">
            <Check size={14} />
            Foto enviada — aguardando aprovação
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 w-full bg-bg-2 border border-dashed border-pink/40 rounded-[14px] py-4 text-pink text-sm font-semibold cursor-pointer hover:bg-pink/5 transition-colors">
            {photoUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Camera size={16} />
                Enviar foto pra fidelidade
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={photoUploading}
            />
          </label>
        )}
      </div>
    );
  }

  return null;
}
