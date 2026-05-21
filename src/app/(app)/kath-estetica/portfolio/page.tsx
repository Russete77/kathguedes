import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { EsteticaPortfolioItem } from "@/lib/estetica/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfólio Antes & Depois — Kath Estética Moto",
  description:
    "Galeria de resultados reais da Kath Guedes Estética Moto. Veja motos antes e depois dos serviços de lavagem, polimento e vitrificação.",
};

export default async function PortfolioPage() {
  const supabase = await createServerSupabaseClient();

  const { data: itemsRaw } = await supabase
    .from("estetica_portfolio")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true });

  const items = (itemsRaw || []) as unknown as EsteticaPortfolioItem[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/kath-estetica"
        className="inline-flex items-center gap-2 text-pink text-sm font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          ANTES & <span className="text-pink">DEPOIS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Resultados reais dos serviços na Kath Guedes Estética Moto.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-bg-1 border border-gray-4 rounded-[22px]">
          <Sparkles size={48} className="stroke-gray-3 mx-auto mb-4" />
          <p className="text-gray-2">Portfólio em construção.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-0.5 bg-gray-4">
                <div className="relative aspect-square">
                  <Image
                    src={item.before_url}
                    alt="Antes"
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <Badge variant="dark" className="absolute bottom-2 left-2">
                    ANTES
                  </Badge>
                </div>
                <div className="relative aspect-square">
                  <Image
                    src={item.after_url}
                    alt="Depois"
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <Badge variant="pink" className="absolute bottom-2 left-2">
                    DEPOIS
                  </Badge>
                </div>
              </div>
              {(item.title || item.description) && (
                <div className="p-4">
                  {item.title && (
                    <h3 className="font-display text-xl text-white">
                      {item.title.toUpperCase()}
                    </h3>
                  )}
                  {item.description && (
                    <p className="text-[13px] text-gray-2 mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
