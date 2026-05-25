"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Loader2, Check } from "lucide-react";

interface Props {
  /**
   * Quando informado, a foto vai ser amarrada a este booking. Quando ausente,
   * o backend escolhe o primeiro booking `done` elegivel + sem foto do user
   * (usado pelo "Enviar foto" sem booking especifico em /fidelidade).
   */
  bookingId?: string;
}

export function LoyaltyPhotoUpload({ bookingId }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      if (bookingId) fd.append("booking_id", bookingId);
      const res = await fetch("/api/estetica/loyalty/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const friendly =
          data?.message ??
          data?.error ??
          "Erro no upload — tente de novo em alguns instantes.";
        throw new Error(friendly);
      }
      setUploaded(true);
      toast.success("Foto enviada! Aguarde aprovação da Kath.", {
        style: { borderLeft: "3px solid #FF0080" },
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload", {
        duration: 6000,
      });
    } finally {
      setUploading(false);
      // Reset input pra permitir reescolher o mesmo arquivo apos erro.
      e.target.value = "";
    }
  }

  if (uploaded) {
    return (
      <div className="flex items-center gap-2 text-success text-sm">
        <Check size={14} />
        Foto enviada — aguardando aprovação
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="flex items-center justify-center gap-2 w-full bg-bg-2 border border-dashed border-pink/40 rounded-[14px] py-3 text-pink text-sm font-semibold">
        <Loader2 size={16} className="animate-spin" />
        Enviando...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex items-center justify-center gap-2 bg-pink hover:bg-pink-light text-white text-[13px] font-semibold rounded-[14px] py-3 cursor-pointer transition-colors">
        <Camera size={16} />
        Tirar foto
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>
      <label className="flex items-center justify-center gap-2 bg-bg-3 border border-gray-4 hover:border-pink/40 text-gray-1 text-[13px] font-semibold rounded-[14px] py-3 cursor-pointer transition-colors">
        <ImageIcon size={16} />
        Galeria
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>
    </div>
  );
}
