"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, QrCode, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface PaymentData {
  method: "asaas_pix" | "manual_pix";
  total: number;
  paymentId?: string;
  invoiceUrl?: string;
  pixQrCode?: string;
  pixPayload?: string;
  expirationDate?: string;
  pixKey?: string | null;
  pixName?: string;
  instructions?: string;
}

type PanelState =
  | { stage: "loading" }
  | { stage: "need-cpf"; message: string }
  | { stage: "paid"; data: PaymentData }
  | { stage: "error"; message: string };

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

export function PaymentPanel({
  orderId,
  totalCents,
}: {
  orderId: string;
  totalCents: number;
}) {
  const [state, setState] = useState<PanelState>({ stage: "loading" });
  const [copied, setCopied] = useState(false);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestPayment = useCallback(
    async (cpfDigits?: string) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/loja/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, ...(cpfDigits ? { cpfCnpj: cpfDigits } : {}) }),
        });

        if (res.status === 422) {
          const err = await res.json().catch(() => ({}));
          if (err?.error === "cpf_required") {
            setState({
              stage: "need-cpf",
              message: err.message ?? "Informe seu CPF/CNPJ para gerar o Pix.",
            });
            return;
          }
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || err.error || "Erro ao gerar pagamento");
        }
        const data = (await res.json()) as PaymentData;
        setState({ stage: "paid", data });
      } catch (err) {
        setState({
          stage: "error",
          message: err instanceof Error ? err.message : "Erro ao gerar pagamento",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    requestPayment();
  }, [requestPayment]);

  const handleSubmitCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = digitsOnly(cpfInput);
    if (d.length !== 11 && d.length !== 14) {
      setCpfError("CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.");
      return;
    }
    setCpfError(null);
    await requestPayment(d);
  };

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

  if (state.stage === "loading") {
    return (
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-8 text-center">
        <Loader2 size={32} className="animate-spin stroke-pink mx-auto mb-3" />
        <p className="text-gray-2">Gerando pagamento Pix...</p>
      </div>
    );
  }

  if (state.stage === "need-cpf") {
    return (
      <form
        onSubmit={handleSubmitCpf}
        className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 space-y-4"
      >
        <div>
          <h2 className="font-display text-xl text-white mb-1">CPF / CNPJ</h2>
          <p className="text-gray-3 text-sm">{state.message}</p>
        </div>
        <div>
          <label htmlFor="cpf-loja" className="text-gray-3 text-xs uppercase tracking-wider font-semibold mb-1 block">
            Documento do pagador
          </label>
          <input
            id="cpf-loja"
            inputMode="numeric"
            autoComplete="off"
            value={cpfInput}
            onChange={(e) => {
              setCpfInput(formatCpfCnpj(e.target.value));
              if (cpfError) setCpfError(null);
            }}
            placeholder="000.000.000-00"
            className="w-full bg-bg-2 border border-gray-4 rounded-lg px-4 py-3 text-white text-base font-mono focus:border-pink focus:outline-none"
          />
          {cpfError && <p className="text-danger text-xs mt-1">{cpfError}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Gerando Pix...
            </>
          ) : (
            "Gerar Pix"
          )}
        </Button>
        <p className="text-gray-3 text-xs">
          O CPF/CNPJ vai pra cobrança do Pix (Asaas) — exigência do BACEN. Salvamos no seu
          perfil para os próximos pagamentos.
        </p>
      </form>
    );
  }

  if (state.stage === "error") {
    return (
      <div className="bg-bg-1 border border-yellow-500/30 rounded-[22px] p-6">
        <p className="text-yellow-400 font-semibold mb-2">Erro ao gerar pagamento</p>
        <p className="text-gray-2 text-sm mb-4">{state.message}</p>
        <p className="text-gray-3 text-sm">
          Entre em contato pelo WhatsApp para finalizar o pagamento manualmente.
        </p>
      </div>
    );
  }

  const payment = state.data;

  if (payment.method === "asaas_pix") {
    return (
      <div className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 space-y-5">
        <div className="text-center">
          <h2 className="font-display text-xl text-white mb-1">PAGUE VIA PIX</h2>
          <p className="text-gray-3 text-sm">
            Escaneie o QR code ou copie o código Pix abaixo
          </p>
        </div>

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

        <div className="text-center">
          <p className="text-gray-3 text-xs uppercase tracking-wider mb-1">Valor</p>
          <p className="font-display text-3xl text-pink">{totalFormatted}</p>
        </div>

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

  return (
    <div className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 space-y-5">
      <div className="text-center">
        <QrCode size={48} className="stroke-pink mx-auto mb-3" />
        <h2 className="font-display text-xl text-white mb-1">PAGUE VIA PIX</h2>
        <p className="text-gray-3 text-sm">
          {payment.instructions || "Faça um Pix no valor abaixo e envie o comprovante."}
        </p>
      </div>

      <div className="text-center">
        <p className="text-gray-3 text-xs uppercase tracking-wider mb-1">Valor</p>
        <p className="font-display text-3xl text-pink">{totalFormatted}</p>
      </div>

      {payment.pixKey && (
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
