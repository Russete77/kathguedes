"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  accessUntil: string; // data formatada pt-BR
}

export function CancelSubscriptionButton({ accessUntil }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Erro ao cancelar"
        );
      }
      toast.success("Assinatura cancelada. Voce mantem o acesso ate " + accessUntil + ".");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar assinatura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-3 hover:text-danger transition-colors underline underline-offset-2"
      >
        Cancelar renovacao automatica
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-bg-1 border-gray-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Cancelar renovacao automatica?
            </DialogTitle>
            <DialogDescription className="text-gray-2 space-y-2">
              <span className="block mt-2">
                Sua assinatura nao sera renovada ao fim do periodo atual.
              </span>
              <span className="block font-medium text-gray-1">
                Voce mantem acesso completo ate{" "}
                <span className="text-pink">{accessUntil}</span>.
              </span>
              <span className="block text-[12px] text-gray-3 mt-1">
                Para reativar, basta assinar novamente na pagina de planos. Nao ha reembolso proporcional.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Manter assinatura
            </Button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-danger/20 border border-danger/40 text-danger text-sm font-semibold hover:bg-danger/30 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
