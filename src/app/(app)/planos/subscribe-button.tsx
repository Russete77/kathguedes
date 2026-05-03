"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, Copy, Check, QrCode } from "lucide-react";
import type { PlanTier } from "@/lib/supabase/types";
import type { Plan } from "@/lib/billing/plans";

interface SubscribeButtonProps {
  plan: Plan;
  currentPlan: PlanTier;
  featured?: boolean;
}

const BILLING_OPTIONS = [
  {
    id: "PIX",
    label: "PIX",
    description: "Pagamento instantâneo via PIX",
    accentColor: "from-green-500 to-green-600",
    borderColor: "border-green-500/50",
  },
  {
    id: "BOLETO",
    label: "Boleto",
    description: "Pagamento via boleto bancário (até 3 dias úteis)",
    accentColor: "from-yellow-500 to-yellow-600",
    borderColor: "border-yellow-500/50",
  },
  {
    id: "CREDIT_CARD",
    label: "Cartão de Crédito",
    description: "Aprovação quase imediata",
    accentColor: "from-blue-500 to-blue-600",
    borderColor: "border-blue-500/50",
  },
];

type FlowStep = "select-billing" | "awaiting-payment";

interface PaymentData {
  invoiceUrl: string;
  billingType: string;
  pixQrCode?: string;
  pixPayload?: string;
}

export function SubscribeButton({
  plan,
  currentPlan,
  featured,
}: SubscribeButtonProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("select-billing");
  const [selectedBillingType, setSelectedBillingType] =
    useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);

  const isCurrent = currentPlan === plan.slug;
  // Para detectar downgrade precisamos saber o level do plano atual.
  // Como o caller passa apenas o slug, fazemos lookup via fetch one-time.
  // Solução pragmática: para slugs conhecidos hardcode os levels (cache local;
  // se vier slug inesperado, default 0 = free e nunca bloqueia).
  const LEVELS: Record<string, number> = {
    free: 0, acesso: 1, plano1: 2, plano2: 3, plano3: 4, atleta: 5,
  };
  const isDowngrade = (LEVELS[currentPlan] ?? 0) > plan.level;

  const resetDialog = () => {
    setStep("select-billing");
    setSelectedBillingType(null);
    setPaymentData(null);
    setCopied(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetDialog();
    setDialogOpen(open);
  };

  const handleSelectBillingType = async (billingType: string) => {
    setSelectedBillingType(billingType);
    setIsLoading(true);

    try {
      const response = await fetch("/api/checkout/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.slug, billingType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar assinatura");
      }

      const data = await response.json();

      setPaymentData({
        invoiceUrl: data.invoiceUrl,
        billingType: data.billingType,
        pixQrCode: data.pixQrCode,
        pixPayload: data.pixPayload,
      });
      setStep("awaiting-payment");
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao criar assinatura. Tente novamente."
      );
      setSelectedBillingType(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPix = async () => {
    if (paymentData?.pixPayload) {
      await navigator.clipboard.writeText(paymentData.pixPayload);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenInvoice = () => {
    if (paymentData?.invoiceUrl) {
      window.open(paymentData.invoiceUrl, "_blank");
    }
  };

  if (isCurrent) {
    return (
      <Button variant="ghost" size="sm" className="w-full" disabled>
        Plano Atual
      </Button>
    );
  }

  if (isDowngrade) {
    return (
      <Button variant="ghost" size="sm" className="w-full" disabled>
        Downgrade (em breve)
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={featured ? "primary" : "secondary"}
        size="sm"
        className="w-full"
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
      >
        Assinar
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="bg-bg-1 border-gray-4 sm:max-w-md">
          {step === "select-billing" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-lg">
                  Escolha seu método de pagamento
                </DialogTitle>
                <DialogDescription className="text-gray-2">
                  Selecione como você deseja pagar sua assinatura do plano{" "}
                  <span className="text-pink font-semibold uppercase">
                    {plan.name}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-6">
                {BILLING_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelectBillingType(option.id)}
                    disabled={isLoading}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 ${
                      isLoading
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-[1.02]"
                    } ${
                      selectedBillingType === option.id
                        ? `${option.borderColor} bg-bg-2 border-opacity-100`
                        : "border-gray-4 bg-bg-2/50 hover:border-gray-3"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-2 h-10 rounded-full bg-gradient-to-b ${option.accentColor}`}
                      />
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold text-sm">
                            {option.label}
                          </h3>
                          {selectedBillingType === option.id && isLoading && (
                            <Loader2
                              className="animate-spin text-pink"
                              size={14}
                            />
                          )}
                        </div>
                        <p className="text-gray-3 text-xs mt-1">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-bg-2/50 border border-gray-4 rounded-lg p-3">
                <p className="text-xs text-gray-3">
                  Sua assinatura é mensal e recorrente. O acesso é ativado
                  após a confirmação do pagamento.
                </p>
              </div>
            </>
          )}

          {step === "awaiting-payment" && paymentData && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-lg">
                  {paymentData.billingType === "PIX"
                    ? "Pague via PIX"
                    : paymentData.billingType === "BOLETO"
                    ? "Pague via Boleto"
                    : "Finalize o pagamento"}
                </DialogTitle>
                <DialogDescription className="text-gray-2">
                  {paymentData.billingType === "PIX"
                    ? "Escaneie o QR code ou copie o código PIX para pagar."
                    : paymentData.billingType === "BOLETO"
                    ? "Acesse o link abaixo para visualizar e pagar o boleto."
                    : "Clique no botão abaixo para inserir os dados do cartão."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* PIX QR Code */}
                {paymentData.billingType === "PIX" &&
                  paymentData.pixQrCode && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white rounded-2xl p-4">
                        <img
                          src={`data:image/png;base64,${paymentData.pixQrCode}`}
                          alt="QR Code PIX"
                          className="w-48 h-48"
                        />
                      </div>

                      {paymentData.pixPayload && (
                        <button
                          onClick={handleCopyPix}
                          className="flex items-center gap-2 px-4 py-2.5 bg-bg-2 border border-gray-4 rounded-xl text-sm text-white hover:border-green-500/50 transition-colors w-full justify-center"
                        >
                          {copied ? (
                            <>
                              <Check size={16} className="text-green-500" />
                              Código copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={16} className="text-gray-3" />
                              Copiar código PIX (copia e cola)
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                {/* PIX sem QR code — fallback para invoiceUrl */}
                {paymentData.billingType === "PIX" &&
                  !paymentData.pixQrCode &&
                  paymentData.invoiceUrl && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 bg-bg-2 rounded-full flex items-center justify-center border border-gray-4">
                        <QrCode size={36} className="text-green-500" />
                      </div>
                      <p className="text-sm text-gray-2 text-center">
                        Clique abaixo para ver o QR Code e pagar via PIX.
                      </p>
                    </div>
                  )}

                {/* Boleto / Card */}
                {paymentData.billingType !== "PIX" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 bg-bg-2 rounded-full flex items-center justify-center border border-gray-4">
                      <ExternalLink size={36} className="text-pink" />
                    </div>
                    <p className="text-sm text-gray-2 text-center">
                      {paymentData.billingType === "BOLETO"
                        ? "Clique abaixo para visualizar o boleto."
                        : "Clique abaixo para inserir os dados do seu cartão com segurança."}
                    </p>
                  </div>
                )}

                {/* Invoice URL button */}
                {paymentData.invoiceUrl && (
                  <button
                    onClick={handleOpenInvoice}
                    className="flex items-center gap-2 px-4 py-3 bg-pink hover:bg-pink/90 text-white rounded-xl text-sm font-semibold w-full justify-center transition-colors"
                  >
                    <ExternalLink size={16} />
                    {paymentData.billingType === "PIX"
                      ? "Abrir página de pagamento"
                      : paymentData.billingType === "BOLETO"
                      ? "Visualizar boleto"
                      : "Inserir dados do cartão"}
                  </button>
                )}
              </div>

              <div className="bg-bg-2/50 border border-gray-4 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-3">
                  Seu plano será ativado automaticamente após a
                  confirmação do pagamento.
                  {plan.slug === "atleta" &&
                    " Você terá acesso imediato à consultoria e ficha de anamnese."}
                </p>
                <p className="text-xs text-gray-3">
                  {paymentData.billingType === "PIX"
                    ? "PIX é confirmado em poucos segundos."
                    : paymentData.billingType === "BOLETO"
                    ? "Boleto pode levar até 3 dias úteis para compensar."
                    : "Cartão de crédito é aprovado quase imediatamente."}
                </p>
              </div>

              <button
                onClick={() => {
                  handleClose(false);
                  router.refresh();
                }}
                className="text-sm text-gray-3 hover:text-gray-1 transition-colors text-center py-2"
              >
                Já paguei — atualizar página
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
