import Link from "next/link";
import { Wallet, Clock } from "lucide-react";

type Props = {
  activeCents: number;
  expiringSoonCents: number;
  expiringSoonAt: string | null;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function WalletBlock({ activeCents, expiringSoonCents, expiringSoonAt }: Props) {
  return (
    <section className="rounded-[22px] border border-gray-4 bg-bg-1 p-6">
      <header className="flex items-center gap-2 mb-3">
        <Wallet className="text-pink size-5" />
        <h2 className="font-display text-2xl text-white">Carteira KathApp</h2>
      </header>

      <div className="space-y-1 mb-4">
        <p className="text-sm text-gray-2">Saldo ativo</p>
        <p className="font-display text-3xl text-pink">{formatBRL(activeCents)}</p>
      </div>

      {expiringSoonCents > 0 && expiringSoonAt && (
        <div className="flex items-center gap-2 text-sm text-yellow-300 rounded-md bg-yellow-300/10 px-3 py-2 mb-3">
          <Clock className="size-4" />
          <span>
            {formatBRL(expiringSoonCents)} expira em{" "}
            {new Date(expiringSoonAt).toLocaleDateString("pt-BR")}
          </span>
        </div>
      )}

      <Link
        href="/perfil/cashback"
        className="text-sm text-pink hover:text-pink-light transition-colors"
      >
        Ver extrato &rarr;
      </Link>
    </section>
  );
}
