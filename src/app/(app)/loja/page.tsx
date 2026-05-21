import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { StoreGrid } from "./store-grid";
import { ShoppingBag } from "lucide-react";
import { getStoreDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents } from "@/lib/billing/wallet";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Loja Fitness",
  description: "Loja oficial KathApp — suplementos, acessórios fitness e produtos exclusivos selecionados pela Kath Guedes. Descontos para assinantes.",
  keywords: ["loja fitness", "suplementos", "produtos fitness", "kath guedes loja"],
  alternates: { canonical: "https://kathapp.com.br/loja" },
  openGraph: {
    title: "Loja Fitness — KathApp",
    description: "Suplementos, acessórios e produtos exclusivos selecionados pela Kath.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default async function LojaPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  // Buscar produtos ativos (RLS filtra)
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  // Buscar plano do usuário para calcular desconto
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();

  const planTier = ((profile?.plan_tier as string) || "free") as PlanTier;

  const [storeDiscountPct, activeCashbackCents] = await Promise.all([
    getStoreDiscountPct(planTier),
    getWalletActiveCents(userId!),
  ]);

  if (!products?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={48} className="stroke-gray-3 mx-auto mb-4" />
        <h2 className="font-display text-3xl text-white mb-2">
          LOJA EM BREVE
        </h2>
        <p className="text-gray-2">
          Produtos exclusivos da Kath chegando em breve.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          LOJA <span className="text-pink">KATH</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Produtos exclusivos com a marca da Kath — descontos especiais para assinantes.
        </p>
      </div>

      <StoreGrid products={products} storeDiscountPct={storeDiscountPct} activeCashbackCents={activeCashbackCents} />
    </div>
  );
}
