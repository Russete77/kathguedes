import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AffiliateCard } from "@/components/affiliates/affiliate-card";
import { ShoppingBag } from "lucide-react";
import { planLevel, tiersUpTo } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produtos Recomendados",
  description: "Produtos recomendados pela Kath Guedes — fitness, suplementos e lifestyle com link direto para compra.",
  alternates: { canonical: "https://www.kathguedes.com.br/afiliados" },
};

export default async function AfiliadosPage() {
  const { userId } = await auth();
  // Admin client + gate manual por plano (replica affiliates_select_by_plan).
  const admin = createAdminSupabaseClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();
  const userLevel = planLevel(
    ((profile?.plan_tier as string) || "start") as PlanTier,
  );
  const allowedTiers = tiersUpTo(userLevel);

  const { data: links } = await admin
    .from("affiliate_links")
    .select("*")
    .eq("is_active", true)
    .in("required_plan", allowedTiers)
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
