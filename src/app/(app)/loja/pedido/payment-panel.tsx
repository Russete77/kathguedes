"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, QrCode, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface PaymentData {
  method: "asaas_pix" | "manual_pix";
  total: number;
  // Asaas Pix
  paymentId?: string;
  invoiceUrl?: string;
  pixQrCode?: string; // base64
  pixPayload?: string; // copia e cola
  expirationDate?: string;
  // Manual Pix
  pixKey?: string | null;
  pixName?: string;
  instructions?: string;
}

export function PaymentPanel({
  orderId,
  totalCents,
}: {
  orderId: string;
  totalCents: number;
}) {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPayment() {
      try {
        const res = await fetch("/api/loja/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao gerar pagamento");
        }

        const data = await res.json();
        setPayment(data);
      } catch (err) {
        console.error("Payment error:", err);
        setError(err instanceof Error ? err.message : "Erro ao gerar pagamento");
      } finally {
        setLoading(false);
      }
    }

    fetchPayment();
  }, [orderId]);

  async function copyPix(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const totalFormatted = `R$ ${(totalCents / 100).toFixed(2).replace(".", ",")}`;

  if (loading) {
    return (
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-8 text-center">
        <Loader2 size={32} className="animate-spin stroke-pink mx-auto mb-3" />
        <p className="text-gray-2">Gerando pagamento Pix...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-1 border border-yellow-500/30 rounded-[22px] p-6">
        <p className="text-yellow-400 font-semibold mb-2">Erro ao gerar pagamento</p>
        <p className="text-gray-2 text-sm mb-4">{error}</p>
        <p className="text-gray-3 text-sm">
          Entre em contato pelo WhatsApp para finalizar o pagamento manualmente.
        </p>
      </div>
    );
  }

  // Asaas Pix (automático)
  if (payment?.method === "asaas_pix") {
    return (
      <div className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 space-y-5">
        <div className="text-center">
          <h2 className="font-display text-xl text-white mb-1">PAGUE VIA PIX</h2>
          <p className="text-gray-3 text-sm">
            Escaneie o QR code ou copie o código Pix abaixo
          </p>
        </div>

        {/* QR Code */}
        {payment.pixQrCode && (
          <div className="flex justify-center">
            <div className="bg-white rounded-2xl p-4 inline-block">
              <Image
                src={`data:image/png;base64,${payment.pixQrCode}`}
                alt="QR Code Pix"
                width={220}
                height={220}
                unoptimized
                className="w-[220px] h-[220px]"
              />
            </div>
          </div>
        )}

        {/* Total */}
        <div className="text-center">
          <p className="text-gray-3 text-xs uppercase tracking-wider mb-1">Valor</p>
          <p className="font-display text-3xl text-pink">{totalFormatted}</p>
        </div>

        {/* Pix Copia e Cola */}
        {payment.pixPayload && (
          <div className="space-y-2">
            <p className="text-gray-3 text-xs uppercase tracking-wider font-semibold">
              Pix Copia e Cola
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-bg-2 border border-gray-4 rounded-lg px-3 py-2.5 text-gray-2 text-xs font-mono break-all max-h-[60px] overflow-y-auto">
                {payment.pixPayload}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => copyPix(payment.pixPayload!)}
                className="shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </div>
        )}

        {/* Invoice URL */}
        {payment.invoiceUrl && (
          <a
            href={payment.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-pink text-sm font-semibold hover:text-pink-light transition-colors"
          >
            <ExternalLink size={14} />
            Abrir fatura completa
          </a>
        )}

        {payment.expirationDate && (
          <p className="text-gray-3 text-xs text-center">
            Válido até:{" "}
            {new Date(payment.expirationDate).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        <div className="pt-3 border-t border-gray-4 text-center">
          <p className="text-gray-3 text-xs mb-3">
            Após o pagamento, seu pedido será atualizado automaticamente.
          </p>
          <Link
            href="/loja/pedidos"
            className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light transition-colors"
          >
            Ver Meus Pedidos
          </Link>
        </div>
      </div>
    );
  }

  // Manual Pix (fallback sem Asaas)
  return (
    <div className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 space-y-5">
      <div className="text-center">
        <QrCode size={48} className="stroke-pink mx-auto mb-3" />
        <h2 className="font-display text-xl text-white mb-1">PAGUE VIA PIX</h2>
        <p className="text-gray-3 text-sm">
          {payment?.instructions || "Faça um Pix no valor abaixo e envie o comprovante."}
        </p>
      </div>

      {/* Total */}
      <div className="text-center">
        <p className="text-gray-3 text-xs uppercase tracking-wider mb-1">Valor</p>
        <p className="font-display text-3xl text-pink">{totalFormatted}</p>
      </div>

      {/* Pix Key */}
      {payment?.pixKey && (
        <div className="space-y-2">
          <p className="text-gray-3 text-xs uppercase tracking-wider font-semibold">
            Chave Pix
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-bg-2 border border-gray-4 rounded-lg px-4 py-3 text-white text-sm font-mono">
              {payment.pixKey}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => copyPix(payment.pixKey!)}
              className="shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          {payment.pixName && (
            <p className="text-gray-3 text-xs">
              Titular: <span className="text-white">{payment.pixName}</span>
            </p>
          )}
        </div>
      )}

      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
        <p className="text-yellow-400 text-sm font-semibold mb-1">Importante</p>
        <p className="text-gray-2 text-xs">
          Após realizar o Pix, envie o comprovante pelo WhatsApp para confirmarmos seu pedido.
          O pedido será processado após a confirmação do pagamento.
        </p>
      </div>

      <div className="pt-3 border-t border-gray-4 text-center">
        <Link
          href="/loja/pedidos"
          className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light transition-colors"
        >
          Ver Meus Pedidos
        </Link>
      </div>
    </div>
  );
}
