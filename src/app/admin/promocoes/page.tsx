import { listPromoCodes } from "./actions";
import { PromoList } from "./promo-list";
import { PromoForm } from "./promo-form";

export const metadata = { title: "Promoções" };
export const dynamic = "force-dynamic";

export default async function AdminPromocoesPage() {
  const codes = await listPromoCodes();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-white">PROMOÇÕES</h1>
          <p className="text-gray-2 text-sm mt-1">
            Slots limitados por plano. Atômico — corrida zero. Quem entrar paga o
            valor promocional enquanto não cancelar.
          </p>
        </div>
        <PromoForm />
      </div>

      <PromoList codes={codes} />
    </div>
  );
}
