import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AffiliateCard } from "@/components/affiliates/affiliate-card";
import { ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produtos Recomendados",
  description: "Produtos recomendados pela Kath Guedes — fitness, moto, estética automotiva e acessórios com link direto para compra.",
  alternates: { canonical: "https://kathapp.com.br/afiliados" },
};

export default async function AfiliadosPage() {
  const supabase = await createServerSupabaseClient();

  const { data: links } = await supabase
    .from("affiliate_links")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          RECOMENDADOS <span className="text-pink">PELA KATH</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Produtos que a Kath usa e recomenda pessoalmente.
        </p>
      </div>

      {!links?.length ? (
        <div className="text-center py-20">
          <ShoppingBag size={48} className="stroke-gray-3 mx-auto mb-4" />
          <p className="text-gray-2">Nenhum produto disponível no momento.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {links.map((l) => (
            <AffiliateCard
              key={l.id}
              id={l.id}
              title={l.title}
              description={l.description}
              image_url={l.image_url}
              category={l.category}
              platform={l.platform}
              affiliate_url={l.affiliate_url}
              required_plan={l.required_plan}
              clicks_count={l.clicks_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
