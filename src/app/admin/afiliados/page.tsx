import { getAffiliateLinks } from "../actions";
import { AffiliateList } from "./affiliate-list";
import { AffiliateForm } from "./affiliate-form";

export const metadata = { title: "Afiliados" };

export default async function AdminAfiliadosPage() {
  const links = await getAffiliateLinks();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">AFILIADOS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Gerencie links de produtos recomendados pela Kath.
          </p>
        </div>
        <AffiliateForm />
      </div>

      <AffiliateList links={links} />
    </div>
  );
}
