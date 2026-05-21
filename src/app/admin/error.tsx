"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Error boundary do painel admin.
 * Captura erros lançados em server actions / page rendering / async errors do admin.
 * Por enquanto loga local; quando Sentry frontend for instalado, adicionar
 * Sentry.captureException(error) aqui.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertTriangle size={48} className="stroke-danger mx-auto mb-4" />
        <h2 className="font-display text-3xl text-white mb-2">ERRO NO PAINEL</h2>
        <p className="text-gray-2 mb-6">
          Algo deu errado ao carregar esta seção do painel admin. Tente recarregar — se persistir, abra o console e verifique os logs.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-6 py-3 bg-pink text-white rounded-xl font-medium hover:bg-pink-light transition-colors"
          >
            Tentar novamente
          </button>
          <a
            href="/admin/dashboard"
            className="px-6 py-3 bg-bg-2 text-white rounded-xl font-medium hover:bg-bg-3 transition-colors border border-gray-4"
          >
            Voltar ao dashboard
          </a>
        </div>
        {error.digest && (
          <p className="text-gray-3 text-xs mt-4 font-mono">Código: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
