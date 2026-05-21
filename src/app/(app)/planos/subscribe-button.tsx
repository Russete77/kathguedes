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
  currentCpf: string | null;
  featured?: boolean;
}

const BILLING_OPTIONS = [
  {
    id: "PIX",
    label: "PIX",
    description: "Pagamento instantaneo via PIX",
    accentColor: "from-green-500 to-green-600",
    borderColor: "border-green-500/50",
  },
  {
    id: "BOLETO",
    label: "Boleto",
    description: "Pagamento via boleto bancario (ate 3 dias uteis)",
    accentColor: "from-yellow-500 to-yellow-600",
    borderColor: "border-yellow-500/50",
  },
  {
    id: "CREDIT_CARD",
    label: "Cartao de Credito",
    description: "Aprovacao quase imediata",
    accentColor: "from-blue-500 to-blue-600",
    borderColor: "border-blue-500/50",
  },
];

type FlowStep = "collect-cpf" | "select-billing" | "awaiting-payment";

interface PaymentData {
  invoiceUrl: string;
  billingType: string;
  pixQrCode?: string;
  pixPayload?: string;
}

/** Formata CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx) a partir de digitos. */
function formatCpfCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

export function SubscribeButton({
  plan,
  currentPlan,
  currentCpf,
  featured,
}: SubscribeButtonProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Se ja tem CPF salvo, pula direto pro select-billing.
  const initialStep: FlowStep = currentCpf ? "select-billing" : "collect-cpf";
  const [step, setStep] = useState<FlowStep>(initialStep);
  const [cpfInput, setCpfInput] = useState<string>("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [selectedBillingType, setSelectedBillingType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);

  const isCurrent = currentPlan === plan.slug;
  const LEVELS: Record<string, number> = {
    free: 0, acesso: 1, plano1: 2, plano2: 3, plano3: 4, atleta: 5,
  };
  const isDowngrade = (LEVELS[currentPlan] ?? 0) > plan.level;

  const resetDialog = () => {
    setStep(currentCpf ? "select-billing" : "collect-cpf");
    setSelectedBillingType(null);
    setPaymentData(null);
    setCopied(false);
    setCpfInput("");
    setCpfError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetDialog();
    setDialogOpen(open);
  };

  const handleConfirmCpf = () => {
    const digits = digitsOnly(cpfInput);
    if (digits.length !== 11 && digits.length !== 14) {
      setCpfError("CPF (11 digitos) ou CNPJ (14 digitos) invalido.");
      return;
    }
    setCpfError(null);
    setStep("select-billing");
  };

  const handleSelectBillingType = async (billingType: string) => {
    setSelectedBillingType(billingType);
    setIsLoading(true);

    try {
      const body: { plan: string; billingType: string; cpfCnpj?: string } = {
        plan: plan.slug,
        billingType,
      };
      // Manda o CPF do input se foi coletado nesta sessao; senao backend usa profile.cpf
      const cpfDigits = digitsOnly(cpfInput);
      if (cpfDigits) body.cpfCnpj = cpfDigits;

      const response = await fetch("/api/checkout/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        // Caso especial: backend disse que CPF e obrigatorio (cpf cache vazio + nao mandamos)
        if (error?.error === "cpf_required") {
          setStep("collect-cpf");
          setCpfError("Precisamos do seu CPF ou CNPJ para continuar.");
          throw new Error("CPF obrigatorio");
        }
        throw new Error(
          (typeof error?.message === "string" && error.message)
            || (typeof error?.error === "string" && error.error)
            || "Erro ao criar assinatura",
        );
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
          : "Erro ao criar assinatura. Tente novamente.",
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
      toast.success("Codigo PIX copiado!");
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
          {step === "collect-cpf" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-lg">
                  Informe seu CPF
                </DialogTitle>
                <DialogDescription className="text-gray-2">
                  Necessario para gerar a cobranca da assinatura{" "}
                  <span className="text-pink font-semibold uppercase">{plan.name}</span>.
                  Salvamos no seu perfil — voce so digita uma vez.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <label className="block text-xs font-mono text-gray-3 mb-2 tracking-wider uppercase">
                  CPF ou CNPJ
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={(e) => {
                    setCpfInput(formatCpfCnpj(e.target.value));
                    setCpfError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmCpf();
                  }}
                  className={`w-full bg-bg-2 border rounded-xl px-4 py-3 text-white placeholder:text-gray-3 outline-none transition-colors ${
                    cpfError ? "border-danger" : "border-gray-4 focus:border-pink"
                  }`}
                />
                {cpfError && (
                  <p className="text-xs text-danger mt-2">{cpfError}</p>
                )}
                <p className="text-[11px] text-gray-3 mt-3">
                  Asaas exige CPF/CNPJ para emissao da nota fiscal e antifraude.
                </p>
              </div>

              <Button
                onClick={handleConfirmCpf}
                disabled={!cpfInput || isLoading}
                className="w-full"
              >
                Continuar
              </Button>
            </>
          )}

          {step === "select-billing" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-lg">
                  Escolha seu metodo de pagamento
                </DialogTitle>
                <DialogDescription className="text-gray-2">
                  Selecione como voce deseja pagar sua assinatura do plano{" "}
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
                  Sua assinatura e mensal e recorrente. O acesso e ativado
                  apos a confirmacao do pagamento.
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
                    ? "Escaneie o QR code ou copie o codigo PIX para pagar."
                    : paymentData.billingType === "BOLETO"
                    ? "Acesse o link abaixo para visualizar e pagar o boleto."
                    : "Clique no botao abaixo para inserir os dados do cartao."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {paymentData.billingType === "PIX" &&
                  paymentData.pixQrCode && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white rounded-2xl p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                              Codigo copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={16} className="text-gray-3" />
                              Copiar codigo PIX (copia e cola)
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

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

                {paymentData.billingType !== "PIX" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 bg-bg-2 rounded-full flex items-center justify-center border border-gray-4">
                      <ExternalLink size={36} className="text-pink" />
                    </div>
                    <p className="text-sm text-gray-2 text-center">
                      {paymentData.billingType === "BOLETO"
                        ? "Clique abaixo para visualizar o boleto."
                        : "Clique abaixo para inserir os dados do seu cartao com seguranca."}
                    </p>
                  </div>
                )}

                {paymentData.invoiceUrl && (
                  <button
                    onClick={handleOpenInvoice}
                    className="flex items-center gap-2 px-4 py-3 bg-pink hover:bg-pink/90 text-white rounded-xl text-sm font-semibold w-full justify-center transition-colors"
                  >
                    <ExternalLink size={16} />
                    {paymentData.billingType === "PIX"
                      ? "Abrir pagina de pagamento"
                      : paymentData.billingType === "BOLETO"
                      ? "Visualizar boleto"
                      : "Inserir dados do cartao"}
                  </button>
                )}
              </div>

              <div className="bg-bg-2/50 border border-gray-4 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-3">
                  Seu plano sera ativado automaticamente apos a
                  confirmacao do pagamento.
                  {plan.slug === "atleta" &&
                    " Voce tera acesso imediato a consultoria e ficha de anamnese."}
                </p>
                <p className="text-xs text-gray-3">
                  {paymentData.billingType === "PIX"
                    ? "PIX e confirmado em poucos segundos."
                    : paymentData.billingType === "BOLETO"
                    ? "Boleto pode levar ate 3 dias uteis para compensar."
                    : "Cartao de credito e aprovado quase imediatamente."}
                </p>
              </div>

              <button
                onClick={() => {
                  handleClose(false);
                  router.refresh();
                }}
                className="text-sm text-gray-3 hover:text-gray-1 transition-colors text-center py-2"
              >
                Ja paguei — atualizar pagina
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
