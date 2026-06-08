"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Rotas de topo (entradas da bottom tab) — não mostram "voltar".
const TOP_LEVEL = new Set([
  "/dashboard",
  "/fitness",
  "/consultoria",
  "/loja",
  "/perfil",
]);

/**
 * Botão "voltar" global do app. Aparece no header em todas as telas exceto as
 * de topo (que já têm a bottom tab como navegação). Usa o histórico do router;
 * se não houver de onde voltar, cai no /dashboard.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || TOP_LEVEL.has(pathname)) {
    // Reserva o espaço pra não deslocar o logo nas telas de topo.
    return <span className="w-8" aria-hidden />;
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Voltar"
      className="flex items-center justify-center w-8 h-8 rounded-full text-gray-2 hover:text-white hover:bg-bg-2 transition-colors"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
