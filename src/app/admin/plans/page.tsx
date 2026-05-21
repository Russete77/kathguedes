import { requireAdmin } from "@/lib/auth-helpers";
import { getAllPlans } from "@/lib/billing/plans";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planos" };

export default async function PlansPage() {
  await requireAdmin();
  const plans = await getAllPlans();

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-4xl text-white">PLANOS</h1>
        <p className="text-sm text-gray-2 mt-1">
          Edite precos, cashback, descontos e features.{" "}
          <span className="text-yellow-300">
            Mudancas de preco NAO afetam assinantes existentes — Asaas mantem o valor da
            subscription ate a proxima renovacao.
          </span>
        </p>
      </header>

      <div className="grid gap-4">
        {plans.map(p => (
          <details
            key={p.slug}
            className="border border-gray-4 bg-bg-1 rounded-[14px] overflow-hidden"
          >
            <summary className="cursor-pointer py-4 px-5 flex items-center justify-between hover:bg-bg-2">
              <div>
                <span className="font-display text-2xl text-white">{p.name}</span>
                <span className="font-mono text-xs text-gray-3 ml-3">
                  {p.slug} · level {p.level}
                </span>
              </div>
              <div className="text-right">
                <div className="font-display text-lg text-pink">
                  {p.price_cents === 0
                    ? "FREE"
                    : `R$ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}`}
                </div>
                <div className="text-xs text-gray-3">
                  {p.is_active ? "ativo" : "inativo"} · cashback {p.cashback_pct}%
                </div>
              </div>
            </summary>
            <div className="px-5 pb-5 pt-2 border-t border-gray-4">
              <PlanForm plan={p} />
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
