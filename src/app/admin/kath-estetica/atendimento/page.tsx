import { getServices, listRecentWalkins } from "../actions";
import { listVehicleTypes } from "@/lib/estetica/pricing";
import { WalkinForm } from "./walkin-form";
import { RecentWalkins } from "./recent-walkins";

export const metadata = { title: "Kath Estética · Atendimento presencial" };

export default async function AdminEsteticaAtendimentoPage() {
  const [services, recent, vehicleTypes] = await Promise.all([
    getServices(),
    listRecentWalkins(30),
    listVehicleTypes(),
  ]);

  const serviceOptions = services.map((s) => ({
    id: s.id as string,
    title: s.title as string,
    price_cents: (s.price_cents as number) ?? 0,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-4xl text-white">
          ESTÉTICA MOTO · ATENDIMENTO PRESENCIAL
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Registro de chegada de motos no balcão. Captura placa + fotos, cria
          ou reutiliza cliente/veículo e gera atendimento.
        </p>
      </div>

      <section className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <WalkinForm services={serviceOptions} vehicleTypes={vehicleTypes} />
        <RecentWalkins items={recent} />
      </section>
    </div>
  );
}
