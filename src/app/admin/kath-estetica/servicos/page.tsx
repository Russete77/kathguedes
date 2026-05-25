import { getServices } from "../actions";
import { ServiceList } from "./service-list";
import { ServiceForm } from "./service-form";

export const metadata = { title: "Kath Estética · Serviços" };

export default async function AdminEsteticaServicosPage() {
  const services = await getServices();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
            ESTÉTICA MOTO · SERVIÇOS
          </h1>
          <p className="text-gray-2 text-xs sm:text-sm mt-1">
            Catálogo de serviços da Kath Guedes Estética Moto. Preços por tipo de moto
            ficam em <a href="/admin/kath-estetica/precos" className="underline text-pink">Preços</a>.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <ServiceForm />
        </div>
      </div>
      <ServiceList services={services} />
    </div>
  );
}
