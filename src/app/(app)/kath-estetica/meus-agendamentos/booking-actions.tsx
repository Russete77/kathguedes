"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Loader2, QrCode, Camera, Check, Image as ImageIcon } from "lucide-react";
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

  // Done → enviar foto pra fidelidade (câmera direta ou galeria)
  if (booking.status === "done") {
    return (
      <div className="pt-3 border-t border-gray-4">
        {photoUploaded ? (
          <div className="flex items-center gap-2 text-success text-sm">
            <Check size={14} />
            Foto enviada — aguardando aprovação
          </div>
        ) : photoUploading ? (
          <div className="flex items-center justify-center gap-2 w-full bg-bg-2 border border-dashed border-pink/40 rounded-[14px] py-4 text-pink text-sm font-semibold">
            <Loader2 size={16} className="animate-spin" />
            Enviando...
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-3 font-mono tracking-[0.1em] uppercase">
              Enviar foto pra fidelidade
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* Câmera (mobile abre direto na câmera traseira) */}
              <label className="flex items-center justify-center gap-2 bg-pink hover:bg-pink-light text-white text-[13px] font-semibold rounded-[14px] py-3 cursor-pointer transition-colors">
                <Camera size={16} />
                Tirar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
              </label>
              {/* Galeria (escolher arquivo existente) */}
              <label className="flex items-center justify-center gap-2 bg-bg-2 border border-gray-4 hover:border-pink/40 text-gray-1 text-[13px] font-semibold rounded-[14px] py-3 cursor-pointer transition-colors">
                <ImageIcon size={16} />
                Galeria
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
              </label>
            </div>
            <p className="text-[10px] text-gray-3 text-center">
              A foto vai pra aprovação da Kath antes de contar no programa.
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
