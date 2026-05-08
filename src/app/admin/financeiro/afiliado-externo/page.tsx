import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PayoutForm } from "./payout-form";
import { FinanceiroNav } from "../financeiro-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Afiliados externos" };

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default async function AfiliadoExternoPage() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: history } = await supabase
    .from("revenue_streams")
    .select("reference_id,gross_cents,occurred_at,category")
    .eq("type", "afiliado_externo")
    .eq("status", "confirmed")
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-4xl text-white">AFILIADOS EXTERNOS</h1>
        <p className="text-sm text-gray-2 mt-1">
          Registre receita mensal recebida da Amazon, Mercado Livre, Shopee.
        </p>
      </header>
      <FinanceiroNav active="afiliado-externo" />

      <section>
        <h2 className="font-display text-2xl text-white mb-3">Registrar payout mensal</h2>
        <PayoutForm />
      </section>

      <section>
        <h2 className="font-display text-2xl text-white mb-3">Histórico</h2>
        {(history ?? []).length === 0 ? (
          <p className="text-sm text-gray-3">Sem registros ainda.</p>
        ) : (
          <div className="rounded-[14px] border border-gray-4 bg-bg-1 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-2 border-b border-gray-4">
                  <th className="py-3 px-4">Quando</th>
                  <th className="py-3 px-4">Referência</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Bruto</th>
                </tr>
              </thead>
              <tbody>
                {((history ?? []) as Array<{
                  reference_id: string;
                  gross_cents: number;
                  occurred_at: string;
                  category: string | null;
                }>).map((r) => (
                  <tr key={r.reference_id} className="border-t border-gray-4">
                    <td className="py-2.5 px-4 text-gray-1">
                      {new Date(r.occurred_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2.5 px-4 text-gray-2 font-mono text-xs">{r.reference_id}</td>
                    <td className="py-2.5 px-4 text-gray-2">{r.category}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-gray-1">
                      {formatBRL(r.gross_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
