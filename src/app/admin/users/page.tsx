import { listUsersForTierTest } from "./actions";
import { UserTierTable } from "./user-tier-table";

export const metadata = { title: "Admin · Tiers de teste" };

export default async function AdminUsersPage() {
  const users = await listUsersForTierTest(100);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
          USUÁRIOS · TIERS DE TESTE
        </h1>
        <p className="text-gray-2 text-xs sm:text-sm mt-1 max-w-2xl">
          Atalho para mudar o <code className="text-pink">plan_tier</code> de
          contas de teste sem passar por Asaas. Espelha o efeito do webhook
          <code className="text-pink"> PAYMENT_CONFIRMED</code> (atualiza
          profile + cria consultoria se aplicável + notifica). Não cobra cartão.
        </p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-[14px] p-3 text-[12px] text-yellow-300">
        <strong>Use só em contas de teste.</strong> Mudar manualmente o tier
        de um cliente real cria desalinhamento entre seu plano efetivo no
        Asaas e o que o app exibe. Para usuários reais, ajuste sempre via
        cobrança Asaas.
      </div>

      <UserTierTable users={users} />
    </div>
  );
}
