import { requireAdmin } from "@/lib/auth-helpers";
import { listAllocations, pendingPayoutsByMember } from "@/lib/billing/commissions";
import { CommissionList } from "./commission-list";
import { FinanceiroNav } from "../financeiro-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comissões" };

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default async function ComissoesPage() {
  await requireAdmin();

  const draft = await listAllocations({ status: "draft" });
  const approved = await listAllocations({ status: "approved" });
  const payouts = await pendingPayoutsByMember();

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-4xl text-white">COMISSÕES</h1>
      </header>
      <FinanceiroNav active="comissoes" />

      <section>
        <h2 className="font-display text-2xl text-white mb-2">A pagar (por sócio)</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-gray-3">Nada aprovado pendente de pagamento.</p>
        ) : (
          <ul className="rounded-[14px] border border-gray-4 bg-bg-1 divide-y divide-gray-4">
            {payouts.map((p) => (
              <li key={p.team_member_id} className="flex justify-between items-center py-2.5 px-4">
                <span className="text-gray-1">
                  {p.name}
                  <span className="text-xs text-gray-3 ml-2">
                    {p.pix_key ? `PIX: ${p.pix_key}` : "sem PIX cadastrado"}
                  </span>
                </span>
                <span className="font-display text-lg text-pink">{formatBRL(p.total_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommissionList
        draftAllocations={draft as never}
        approvedAllocations={approved as never}
      />
    </main>
  );
}
