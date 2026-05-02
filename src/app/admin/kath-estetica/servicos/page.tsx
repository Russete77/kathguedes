import { getServices } from "../actions";
import { ServiceList } from "./service-list";
import { ServiceForm } from "./service-form";

export const metadata = { title: "Kath Estética · Serviços" };

export default async function AdminEsteticaServicosPage() {
  const services = await getServices();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">ESTÉTICA MOTO · SERVIÇOS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Catálogo de serviços da Kath Guedes Estética Moto.
          </p>
        </div>
        <ServiceForm />
      </div>
      <ServiceList services={services} />
    </div>
  );
}
