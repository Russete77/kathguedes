"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Home do admin — não mostra "voltar".
const ADMIN_HOME = new Set(["/admin", "/admin/dashboard"]);

/** Botão "voltar" do painel admin (o layout do admin não tem o header do app). */
export function AdminBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || ADMIN_HOME.has(pathname)) return null;

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/admin");
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 mb-4 text-sm text-gray-2 hover:text-pink transition-colors"
    >
      <ArrowLeft size={16} />
      Voltar
    </button>
  );
}
