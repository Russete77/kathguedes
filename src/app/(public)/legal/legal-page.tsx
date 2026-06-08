import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-base text-gray-1">
      <header className="border-b border-gray-4/40 sticky top-0 bg-bg-base/85 backdrop-blur-xl z-10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-2 hover:text-white text-sm">
            <ArrowLeft size={16} /> Voltar ao site
          </Link>
          <Image src="/icons/logo-navbar.png" alt="KathApp" width={28} height={28} className="rounded-md" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-display text-3xl sm:text-4xl text-white leading-tight">{title}</h1>
        <p className="text-gray-3 text-sm mt-3">Última atualização: {updatedAt}</p>

        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-gray-2">{children}</div>

        <nav className="mt-12 pt-6 border-t border-gray-4/40 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/termos" className="text-gray-3 hover:text-pink">Termos de Uso</Link>
          <Link href="/cancelamento" className="text-gray-3 hover:text-pink">Cancelamento e Reembolso</Link>
          <Link href="/privacidade" className="text-gray-3 hover:text-pink">Privacidade (LGPD)</Link>
        </nav>
        <p className="mt-6 font-mono text-[10px] text-gray-4 tracking-[0.08em]">
          &copy; 2026 KathApp &mdash; Desenvolvido por RS7 Tec
        </p>
      </main>
    </div>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-white pt-5">{children}</h2>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 marker:text-pink">{children}</ul>;
}
