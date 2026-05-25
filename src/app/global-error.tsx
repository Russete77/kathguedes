"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "global" } });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="font-display text-4xl mb-3">ALGO DEU ERRADO</h2>
          <p className="text-gray-400 mb-6">
            Um erro inesperado interrompeu a página. A equipe foi notificada.
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#FF0080] text-white rounded-xl font-medium"
          >
            Tentar novamente
          </button>
          {error.digest && (
            <p className="text-gray-500 text-xs mt-6 font-mono">Código: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
