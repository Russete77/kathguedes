import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { FinanceiroNav } from "./financeiro-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro" };

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default async function FinanceiroPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: streams } = await supabase
    .from("revenue_streams")
    .select("type, gross_cents, net_cents, occurred_at")
    .gte("occurred_at", since30d)
    .eq("status", "confirmed");

  type Bucket = { gross: number; net: number; count: number };
  const byType = new Map<string, Bucket>();
  let totalGross = 0;
  let totalNet = 0;
  let totalCount = 0;
  for (const s of (streams ?? []) as Array<{ type: string; gross_cents: number; net_cents: number }>) {
    const cur = byType.get(s.type) ?? { gross: 0, net: 0, count: 0 };
    cur.gross += s.gross_cents;
    cur.net += s.net_cents;
    cur.count += 1;
    byType.set(s.type, cur);
    totalGross += s.gross_cents;
    totalNet += s.net_cents;
    totalCount += 1;
  }
  const ticketMedio = totalCount > 0 ? Math.round(totalGross / totalCount) : 0;

  const { data: walletAgg } = await supabase
    .from("wallet_balance")
    .select("active_cents,earned_total_cents,spent_total_cents,expired_total_cents");
  const wallet = ((walletAgg ?? []) as Array<{
    active_cents: number;
    earned_total_cents: number;
    spent_total_cents: number;
    expired_total_cents: number;
  }>).reduce(
    (acc, w) => ({
      active: acc.active + w.active_cents,
      earned: acc.earned + w.earned_total_cents,
      spent: acc.spent + w.spent_total_cents,
      expired: acc.expired + w.expired_total_cents,
    }),
    { active: 0, earned: 0, spent: 0, expired: 0 },
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <header>
        <h1 className="font-display text-4xl text-white">FINANCEIRO</h1>
        <p className="text-sm text-gray-2 mt-1">Visão consolidada — receita, comissões, carteira.</p>
      </header>

      <FinanceiroNav active="overview" />

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-white">Receita últimos 30 dias</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <Stat label="Receita bruta" value={totalGross} accent />
          <Stat label="Líquido (após CMV)" value={totalNet} />
          <Stat label="Transações" value={totalCount} raw />
          <Stat label="Ticket médio" value={ticketMedio} />
        </div>

        <div className="rounded-[14px] border border-gray-4 bg-bg-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-2 border-b border-gray-4">
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4 text-right">Bruto</th>
                <th className="py-3 px-4 text-right">Líquido</th>
                <th className="py-3 px-4 text-right">#</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byType.entries()).map(([type, v]) => (
                <tr key={type} className="border-t border-gray-4">
                  <td className="py-2.5 px-4 text-gray-1">{type}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-gray-1">{formatBRL(v.gross)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-gray-1">{formatBRL(v.net)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-gray-2">{v.count}</td>
                </tr>
              ))}
              {byType.size === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-3 text-sm">
                    Sem receita confirmada nos últimos 30 dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-white">Carteira (passivo de cashback)</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <Stat label="Ativo (a usar)" value={wallet.active} accent />
          <Stat label="Ganho total" value={wallet.earned} />
          <Stat label="Gasto" value={wallet.spent} />
          <Stat label="Expirado" value={wallet.expired} />
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  raw,
}: {
  label: string;
  value: number;
  accent?: boolean;
  raw?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border p-4 ${
        accent ? "bg-pink/10 border-pink/30" : "bg-bg-1 border-gray-4"
      }`}
    >
      <p className="text-xs text-gray-2">{label}</p>
      <p className="font-display text-2xl text-white mt-1">
        {raw ? value : formatBRL(value)}
      </p>
    </div>
  );
}
