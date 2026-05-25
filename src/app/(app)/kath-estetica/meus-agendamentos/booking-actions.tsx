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

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function formatCpfCnpj(v: string): string {
  const d = digitsOnly(v);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function BookingActions({ booking }: Props) {
  const [pix, setPix] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [needCpf, setNeedCpf] = useState<string | null>(null);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);

  async function callPayment(cpfDigits?: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/estetica/bookings/${booking.id}/payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cpfDigits ? { cpfCnpj: cpfDigits } : {}),
        },
      );
      const data = await res.json();
      if (res.status === 422 && data?.error === "cpf_required") {
        setNeedCpf(data.message ?? "Informe seu CPF/CNPJ para gerar o Pix.");
        return;
      }
      if (!res.ok) throw new Error(data.error || data.message || "Erro");
      setNeedCpf(null);
      setPix(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar Pix");
    } finally {
      setLoading(false);
    }
  }

  function generatePix() {
    return callPayment();
  }

  async function submitCpf(e: React.FormEvent) {
    e.preventDefault();
    const d = digitsOnly(cpfInput);
    if (d.length !== 11 && d.length !== 14) {
      setCpfError("CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.");
      return;
    }
    setCpfError(null);
    await callPayment(d);
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
        {needCpf ? (
          <form onSubmit={submitCpf} className="space-y-3">
            <div>
              <label htmlFor={`cpf-est-${booking.id}`} className="text-[11px] text-gray-3 font-mono tracking-[0.1em] uppercase mb-1 block">
                CPF / CNPJ
              </label>
              <input
                id={`cpf-est-${booking.id}`}
                inputMode="numeric"
                autoComplete="off"
                value={cpfInput}
                onChange={(e) => {
                  setCpfInput(formatCpfCnpj(e.target.value));
                  if (cpfError) setCpfError(null);
                }}
                placeholder="000.000.000-00"
                className="w-full bg-bg-2 border border-gray-4 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-pink focus:outline-none"
              />
              {cpfError && <p className="text-danger text-xs mt-1">{cpfError}</p>}
              <p className="text-[10px] text-gray-3 mt-1">{needCpf}</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
              {loading ? "Gerando..." : "Gerar Pix"}
            </Button>
          </form>
        ) : !pix ? (
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
