import {
  getPartnerStores,
  getPartnerStoreClickStats,
} from "@/app/admin/actions";
import { PartnerStoreList } from "./partner-store-list";
import { PartnerStoreForm } from "./partner-store-form";
import { Store, MessageCircle } from "lucide-react";

export default async function ParceirosPage() {
  const [stores, clickStats] = await Promise.all([
    getPartnerStores(),
    getPartnerStoreClickStats(),
  ]);

  const totalClicks = Object.values(clickStats).reduce(
    (acc, s) => acc + s.clicks_total,
    0,
  );
  const clicks7d = Object.values(clickStats).reduce(
    (acc, s) => acc + s.clicks_7d,
    0,
  );
  const clicks30d = Object.values(clickStats).reduce(
    (acc, s) => acc + s.clicks_30d,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-white">
            LOJAS <span className="text-pink">PARCEIRAS</span>
          </h1>
          <p className="text-gray-2 text-sm mt-1">
            Produtos vinculados a uma loja parceira redirecionam para o WhatsApp do parceiro — sem passar pelo carrinho da KathApp.
          </p>
        </div>
        <PartnerStoreForm />
      </div>

      {/* KPI: cliques no botão WhatsApp */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Cliques (total)" value={totalClicks} />
        <KpiCard label="Últimos 30 dias" value={clicks30d} />
        <KpiCard label="Últimos 7 dias" value={clicks7d} highlight />
      </div>

      {stores.length === 0 ? (
        <div className="rounded-[22px] border border-gray-4 bg-bg-1 p-12 text-center">
          <Store size={40} className="stroke-gray-3 mx-auto mb-3" />
          <p className="text-gray-2">Nenhuma loja parceira cadastrada ainda.</p>
          <p className="text-gray-3 text-sm mt-1">Crie a primeira usando o botão acima.</p>
        </div>
      ) : (
        <PartnerStoreList stores={stores} clickStats={clickStats} />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border bg-bg-1 px-5 py-4 ${
        highlight ? "border-success/40" : "border-gray-4"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-gray-3">
        <MessageCircle
          size={12}
          className={highlight ? "stroke-success" : "stroke-gray-3"}
        />
        {label}
      </div>
      <div
        className={`mt-1 font-display text-3xl ${
          highlight ? "text-success" : "text-white"
        }`}
      >
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}
