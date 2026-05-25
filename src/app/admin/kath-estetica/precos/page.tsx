import { getPricingMatrixData } from "../actions";
import { PricingMatrix } from "./pricing-matrix";

export const metadata = { title: "Kath Estética · Preços" };

export default async function AdminEsteticaPrecosPage() {
  const { services, vehicleTypes, pricingByService } = await getPricingMatrixData();
  const activeServices = services.filter((s) => s.is_active);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
          ESTÉTICA MOTO · PREÇOS
        </h1>
        <p className="text-gray-2 text-xs sm:text-sm mt-1">
          Matriz de preço por tipo de moto + regra de pagamento (sinal Asaas
          quando aplicável). O catálogo dos serviços é editado em{" "}
          <a href="/admin/kath-estetica/servicos" className="underline text-pink">
            Serviços
          </a>{" "}
          — mudanças aqui refletem lá e vice-versa.
        </p>
      </div>

      {activeServices.length === 0 ? (
        <div className="text-center py-16 bg-bg-1 border border-gray-4 rounded-[22px]">
          <p className="text-gray-2">Nenhum serviço ativo cadastrado.</p>
          <p className="text-gray-3 text-sm mt-1">
            Vá em <span className="text-pink">Serviços</span> para cadastrar
            antes de definir preços.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeServices.map((s) => (
            <PricingMatrix
              key={s.id}
              service={s}
              vehicleTypes={vehicleTypes}
              initial={pricingByService[s.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
