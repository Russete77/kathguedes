import { getPartnerStores } from "@/app/admin/actions";
import { PartnerStoreList } from "./partner-store-list";
import { PartnerStoreForm } from "./partner-store-form";
import { Store } from "lucide-react";

export default async function ParceirosPage() {
  const stores = await getPartnerStores();

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

      {stores.length === 0 ? (
        <div className="rounded-[22px] border border-gray-4 bg-bg-1 p-12 text-center">
          <Store size={40} className="stroke-gray-3 mx-auto mb-3" />
          <p className="text-gray-2">Nenhuma loja parceira cadastrada ainda.</p>
          <p className="text-gray-3 text-sm mt-1">Crie a primeira usando o botão acima.</p>
        </div>
      ) : (
        <PartnerStoreList stores={stores} />
      )}
    </div>
  );
}
