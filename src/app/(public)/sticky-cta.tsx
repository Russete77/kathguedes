"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * CTA fixo no rodapé — só mobile. Aparece depois de rolar ~1 viewport (passou do
 * hero), mantendo a ação de assinar sempre à mão. Alavanca de conversão.
 */
export function StickyMobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="m-3 rounded-2xl border border-pink/30 bg-[rgba(15,15,15,0.92)] backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3 shadow-[0_8px_40px_rgba(255,0,128,0.25)]">
        <div className="leading-tight">
          <div className="text-[11px] text-gray-3">A partir de</div>
          <div className="text-white font-display text-lg">
            R$25,90<span className="text-[11px] text-gray-3 font-body">/mês</span>
          </div>
        </div>
        <Link
          href="/registro"
          className="inline-flex items-center gap-1.5 bg-pink text-white text-sm font-semibold px-5 py-2.5 rounded-full active:scale-95 transition-transform"
        >
          Assinar <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
