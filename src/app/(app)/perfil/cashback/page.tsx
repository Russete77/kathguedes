import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listWalletCreditsForUser, getWalletBalance } from "@/lib/billing/wallet";

export const dynamic = "force-dynamic";

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

type Credit = {
  id: string;
  amount_cents: number;
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
};

export default async function CashbackPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const balance = await getWalletBalance(userId);
  const credits = (await listWalletCreditsForUser(userId)) as unknown as Credit[];

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl text-white">Extrato de cashback</h1>
        <p className="text-sm text-gray-2 mt-1">Carteira KathApp — créditos e gastos.</p>
      </header>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Saldo ativo" value={balance.active_cents} accent />
        <Stat label="Ganho total" value={balance.earned_total_cents} />
        <Stat label="Gasto" value={balance.spent_total_cents} />
        <Stat label="Expirado" value={balance.expired_total_cents} />
      </div>

      {credits.length === 0 ? (
        <div className="text-center py-12 text-gray-2 border border-gray-4 rounded-[22px] bg-bg-1">
          Você ainda não possui movimentações de cashback.
        </div>
      ) : (
        <div className="border border-gray-4 rounded-[22px] bg-bg-1 overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-gray-2 text-left">
              <tr className="border-b border-gray-4">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4">Validade</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id} className="border-t border-gray-4">
                  <td className="py-2.5 px-4 text-gray-1">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-2.5 px-4 text-gray-2">
                    {c.amount_cents > 0 ? "Crédito" : "Débito"}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono ${
                      c.amount_cents > 0 ? "text-success" : "text-pink"
                    }`}
                  >
                    {c.amount_cents > 0 ? "+" : ""}
                    {formatBRL(Math.abs(c.amount_cents))}
                  </td>
                  <td className="py-2.5 px-4 text-gray-3 text-xs">
                    {c.used_at
                      ? "Usado"
                      : c.expires_at
                      ? new Date(c.expires_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-[14px] border border-gray-4 p-4 ${
        accent ? "bg-pink/10 border-pink/30" : "bg-bg-1"
      }`}
    >
      <p className="text-xs text-gray-2">{label}</p>
      <p className="font-display text-xl text-white mt-1">{formatBRL(value)}</p>
    </div>
  );
}
