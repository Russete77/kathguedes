"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertTriangle size={48} className="stroke-danger mx-auto mb-4" />
        <h2 className="font-display text-3xl text-white mb-2">ALGO DEU ERRADO</h2>
        <p className="text-gray-2 mb-6">
          Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-pink text-white rounded-xl font-medium hover:bg-pink-light transition-colors"
          >
            Tentar novamente
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-bg-2 text-white rounded-xl font-medium hover:bg-bg-3 transition-colors border border-gray-4"
          >
            Ir para o início
          </a>
        </div>
        {error.digest && (
          <p className="text-gray-3 text-xs mt-4">Código: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
