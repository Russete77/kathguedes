import { getServicesWithPricing } from "../actions";
import { ServiceList } from "./service-list";
import { ServiceForm } from "./service-form";

export const metadata = { title: "Kath Estética · Serviços" };

export default async function AdminEsteticaServicosPage() {
  const { services, vehicleTypes, pricingByService } = await getServicesWithPricing();

  // Normaliza o shape pro ServiceList (preserva nullables com defaults sãos).
  const normalized = services.map((s) => ({
    id: s.id,
    title: (s.title as string) ?? "",
    category: (s.category as string) ?? "outros",
    duration_min: (s.duration_min as number) ?? 60,
    price_cents: (s.price_cents as number) ?? 0,
    compare_price: (s.compare_price as number | null) ?? null,
    is_active: (s.is_active as boolean) ?? false,
    eligible_for_loyalty: (s.eligible_for_loyalty as boolean) ?? true,
    cost_cents: (s.cost_cents as number) ?? 0,
    requires_paid_plan: (s.requires_paid_plan as boolean) ?? false,
    includes: (s.includes as string[]) ?? [],
    description: (s.description as string | null) ?? null,
    image_url: (s.image_url as string | null) ?? null,
    sort_order: (s.sort_order as number) ?? 0,
    slug: s.slug,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
            ESTÉTICA MOTO · SERVIÇOS
          </h1>
          <p className="text-gray-2 text-xs sm:text-sm mt-1">
            Catálogo + preços por tipo de moto + regra de pagamento. Cadastre o serviço aqui;
            os preços por categoria de moto e o sinal aparecem em <strong className="text-pink">Preços</strong> dentro de cada card.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <ServiceForm />
        </div>
      </div>
      <ServiceList
        services={normalized}
        vehicleTypes={vehicleTypes}
        pricingByService={pricingByService}
      />
    </div>
  );
}
