import type { Metadata } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { StoreGrid } from "./store-grid";
import Link from "next/link";
import { ShoppingBag, Sparkles, Bell, Shirt, Dumbbell, Droplet, PlayCircle } from "lucide-react";
import { getStoreDiscountPct } from "@/lib/billing/plans";
import { getWalletActiveCents } from "@/lib/billing/wallet";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Loja Fitness",
  description: "Loja oficial KathApp — suplementos, acessórios fitness e produtos exclusivos selecionados pela Kath Guedes. Descontos para assinantes.",
  keywords: ["loja fitness", "suplementos", "produtos fitness", "kath guedes loja"],
  alternates: { canonical: "https://www.kathguedes.com.br/loja" },
  openGraph: {
    title: "Loja Fitness — KathApp",
    description: "Suplementos, acessórios e produtos exclusivos selecionados pela Kath.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default async function LojaPage() {
  const { userId } = await auth();
  // Admin client: catalogo eh publico (products_select_active soh exige is_active).
  // RLS aqui esbarra na integracao Clerk↔Supabase em dev.
  const admin = createAdminSupabaseClient();

  const { data: products } = await admin
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();

  const planTier = ((profile?.plan_tier as string) || "start") as PlanTier;

  const [storeDiscountPct, activeCashbackCents] = await Promise.all([
    getStoreDiscountPct(planTier),
    getWalletActiveCents(userId!),
  ]);

  if (!products?.length) {
    const categories = [
      { icon: Droplet, label: "Suplementos" },
      { icon: Shirt, label: "Vestuário" },
      { icon: Dumbbell, label: "Acessórios" },
    ];
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="relative overflow-hidden rounded-[28px] border border-pink/30 bg-bg-1 p-8 sm:p-12 text-center">
          {/* glow decorativo */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-pink/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-pink text-[11px] font-semibold uppercase tracking-[0.2em] bg-pink-dim border border-pink/30 rounded-full px-3 py-1.5">
              <Sparkles size={13} className="stroke-pink" />
              Em construção
            </span>

            <div className="mx-auto mt-6 w-16 h-16 rounded-2xl bg-pink-dim border border-pink/30 flex items-center justify-center">
              <ShoppingBag size={30} className="stroke-pink" />
            </div>

            <h2 className="font-display text-4xl sm:text-5xl text-white mt-5">
              LOJA <span className="text-pink">KATH GUEDES</span>
            </h2>
            <p className="text-gray-2 mt-3 max-w-md mx-auto leading-relaxed">
              Estamos montando a linha oficial da Kath — produtos selecionados a dedo.
              Assinantes terão <span className="text-white font-semibold">descontos exclusivos</span> e cashback.
            </p>

            {/* preview de categorias */}
            <div className="grid grid-cols-3 gap-3 mt-8">
              {categories.map((c) => (
                <div
                  key={c.label}
                  className="rounded-[18px] border border-gray-4 bg-bg-2 px-3 py-5 flex flex-col items-center gap-2"
                >
                  <c.icon size={22} className="stroke-pink" />
                  <span className="text-white text-sm font-semibold">{c.label}</span>
                  <span className="text-gray-3 text-[10px] uppercase tracking-wider">Em breve</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/fitness"
                className="inline-flex items-center justify-center gap-2 bg-pink text-white font-semibold text-sm rounded-full px-6 py-3 hover:bg-pink-light transition-colors"
              >
                <PlayCircle size={16} />
                Enquanto isso, treinar
              </Link>
            </div>

            <p className="text-gray-3 text-xs mt-5 inline-flex items-center gap-1.5">
              <Bell size={12} className="stroke-gray-3" />
              Ative as notificações para ser avisado no lançamento.
            </p>
          </div>
        </div>
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
