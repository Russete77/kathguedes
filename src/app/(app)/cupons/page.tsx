import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { CouponCard } from "@/components/coupons/coupon-card";
import { Tag, Zap } from "lucide-react";
import { PLAN_LEVELS, planLevel } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cupons de Desconto",
  description: "Cupons de desconto exclusivos negociados pela Kath com marcas parceiras — fitness, moto e estética. Só para assinantes KathApp.",
  alternates: { canonical: "https://kathapp.com.br/cupons" },
};

export default async function CuponsPage() {
  const { userId } = await auth();
  // Admin client + gate manual por plano (replica coupons_select_by_plan).
  const admin = createAdminSupabaseClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();
  const userLevel = planLevel(
    ((profile?.plan_tier as string) || "free") as PlanTier,
  );
  const allowedTiers = (Object.keys(PLAN_LEVELS) as PlanTier[]).filter(
    (t) => PLAN_LEVELS[t] <= userLevel,
  );

  const nowIso = new Date().toISOString();
  const { data: coupons } = await admin
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .gt("valid_until", nowIso)
    .in("required_plan", allowedTiers)
    .order("is_flash", { ascending: false })
    .order("valid_until", { ascending: true });

  const flashCoupons = coupons?.filter((c) => c.is_flash) || [];
  const regularCoupons = coupons?.filter((c) => !c.is_flash) || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          CUPONS <span className="text-pink">EXCLUSIVOS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Descontos negociados pela Kath com marcas parceiras — só para assinantes.
        </p>
      </div>

      {flashCoupons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="stroke-yellow" />
            <span className="font-mono text-[11px] text-yellow tracking-[0.12em] uppercase">
              Flash Deals
            </span>
          </div>
          <div className="space-y-4">
            {flashCoupons.map((c) => (
              <CouponCard
                key={c.id}
                id={c.id}
                title={c.title}
                code={c.code}
                discount_pct={c.discount_pct}
                partner_name={c.partner_name}
                partner_url={c.partner_url}
                valid_until={c.valid_until}
                is_flash={c.is_flash}
                module={c.module}
              />
            ))}
          </div>
        </div>
      )}

      {regularCoupons.length > 0 ? (
        <div className="space-y-4">
          {flashCoupons.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag size={18} className="stroke-pink" />
              <span className="font-mono text-[11px] text-pink tracking-[0.12em] uppercase">
                Cupons Ativos
              </span>
            </div>
          )}
          <div className="space-y-4">
            {regularCoupons.map((c) => (
              <CouponCard
                key={c.id}
                id={c.id}
                title={c.title}
                code={c.code}
                discount_pct={c.discount_pct}
                partner_name={c.partner_name}
                partner_url={c.partner_url}
                valid_until={c.valid_until}
                is_flash={c.is_flash}
                module={c.module}
              />
            ))}
          </div>
        </div>
      ) : (
        !flashCoupons.length && (
          <div className="text-center py-20">
            <Tag size={48} className="stroke-gray-3 mx-auto mb-4" />
            <p className="text-gray-2">Nenhum cupom disponível no momento.</p>
            <p className="text-gray-3 text-sm mt-1">
              Novos cupons são liberados toda semana.
            </p>
          </div>
        )
      )}
    </div>
  );
}
