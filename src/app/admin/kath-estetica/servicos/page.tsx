import { getServices } from "../actions";
import { listVehicleTypes, getServicePricing } from "@/lib/estetica/pricing";
import type {
  EsteticaVehicleType,
  ServicePricing,
} from "@/lib/estetica/pricing-types";
import { ServiceList } from "./service-list";
import { ServiceForm } from "./service-form";

export const metadata = { title: "Kath Estética · Serviços" };

interface RawService {
  id: string;
  title?: string;
  category?: string;
  duration_min?: number;
  price_cents?: number;
  compare_price?: number | null;
  is_active?: boolean;
  eligible_for_loyalty?: boolean;
  cost_cents?: number;
  requires_paid_plan?: boolean;
  includes?: string[];
  description?: string | null;
  image_url?: string | null;
  sort_order?: number;
  slug?: string | null;
}

/**
 * Carrega matriz de preço de forma resiliente: se as tabelas da migration 20
 * (vehicle_types / service_prices / payment_rules) ainda não existem, ou se a
 * query falha por RLS / config, retorna vazio em vez de derrubar a página
 * inteira. Serviços continuam aparecendo; só a matriz fica indisponível.
 */
async function loadPricingSafe(
  serviceIds: string[],
): Promise<{
  vehicleTypes: EsteticaVehicleType[];
  pricingByService: Record<string, ServicePricing>;
  pricingError: string | null;
}> {
  try {
    const vehicleTypes = await listVehicleTypes();
    const pairs = await Promise.all(
      serviceIds.map(async (id) => [id, await getServicePricing(id)] as const),
    );
    const pricingByService: Record<string, ServicePricing> = {};
    for (const [id, pricing] of pairs) pricingByService[id] = pricing;
    return { vehicleTypes, pricingByService, pricingError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[admin/servicos] pricing load failed:", msg);
    return {
      vehicleTypes: [],
      pricingByService: {},
      pricingError: msg,
    };
  }
}

export default async function AdminEsteticaServicosPage() {
  const servicesRaw = (await getServices()) as RawService[];

  const services = servicesRaw.map((s) => ({
    id: s.id,
    title: s.title ?? "",
    category: s.category ?? "outros",
    duration_min: s.duration_min ?? 60,
    price_cents: s.price_cents ?? 0,
    compare_price: s.compare_price ?? null,
    is_active: s.is_active ?? false,
    eligible_for_loyalty: s.eligible_for_loyalty ?? true,
    cost_cents: s.cost_cents ?? 0,
    requires_paid_plan: s.requires_paid_plan ?? false,
    includes: s.includes ?? [],
    description: s.description ?? null,
    image_url: s.image_url ?? null,
    sort_order: s.sort_order ?? 0,
    slug: s.slug ?? null,
  }));

  const { vehicleTypes, pricingByService, pricingError } = await loadPricingSafe(
    services.map((s) => s.id),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
            ESTÉTICA MOTO · SERVIÇOS
          </h1>
          <p className="text-gray-2 text-xs sm:text-sm mt-1">
            Catálogo + preços por tipo de moto + regra de pagamento. Cadastre o serviço aqui;
            os preços por categoria de moto e o sinal aparecem em{" "}
            <strong className="text-pink">Preços</strong> dentro de cada card.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <ServiceForm />
        </div>
      </div>

      {pricingError && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-[14px] p-4 text-sm">
          <p className="text-yellow-400 font-semibold mb-1">
            Matriz de preços indisponível
          </p>
          <p className="text-gray-2 text-xs leading-relaxed">
            Não consegui carregar a matriz de preço por tipo de moto. Os serviços
            continuam editáveis. Detalhe técnico:{" "}
            <code className="text-gray-3 font-mono">{pricingError}</code>
          </p>
          <p className="text-gray-3 text-xs mt-2">
            Provável causa: migration{" "}
            <code className="text-gray-2 font-mono">
              20_estetica_pricing_matrix.sql
            </code>{" "}
            ainda não aplicada neste banco.
          </p>
        </div>
      )}

      <ServiceList
        services={services}
        vehicleTypes={vehicleTypes}
        pricingByService={pricingByService}
      />
    </div>
  );
}
