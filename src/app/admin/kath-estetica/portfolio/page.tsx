import { getPortfolio, getServices } from "../actions";
import { PortfolioManager } from "./portfolio-manager";

export const metadata = { title: "Kath Estética · Portfólio" };

export default async function AdminPortfolioPage() {
  const [items, services] = await Promise.all([getPortfolio(), getServices()]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">PORTFÓLIO ANTES & DEPOIS</h1>
        <p className="text-gray-2 text-sm mt-1">
          Galeria de resultados que aparece no app e na landing.
        </p>
      </div>
      <PortfolioManager
        items={items as unknown as PortfolioItemRow[]}
        services={services as unknown as { id: string; title: string }[]}
      />
    </div>
  );
}

interface PortfolioItemRow {
  id: string;
  title: string | null;
  service_id: string | null;
  before_url: string;
  after_url: string;
  description: string | null;
  is_featured: boolean;
  sort_order: number;
}

export type { PortfolioItemRow };
