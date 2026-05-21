import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { SubscribeButton } from "./subscribe-button";
import { getActivePlans, type Plan, type PlanFeatures } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Planos e Preços",
  description:
    "Escolha seu plano KathApp: Free, Acesso (R$19,90), Plano 1 (R$39,90), Plano 2 (R$74,90), Plano 3 (R$99,90) ou Atleta (R$309,90) com consultoria personalizada.",
  keywords: ["planos kathapp", "preços", "assinatura fitness", "consultoria fitness preço"],
  alternates: { canonical: "https://kathapp.com.br/planos" },
  openGraph: {
    title: "Planos e Preços — KathApp",
    description: "Free, Acesso, Plano 1, 2, 3 ou Atleta — escolha o plano ideal.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, cpf")
    .eq("id", userId)
    .single();

  const currentPlan: PlanTier = (profile?.plan_tier as PlanTier | undefined) ?? "free";
  const currentCpf: string | null = (profile as { cpf?: string | null } | null)?.cpf ?? null;
  const plans = await getActivePlans();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <div className="text-center">
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          ESCOLHA SEU <span className="text-pink">PLANO</span>
        </h1>
        <p className="text-gray-2 mt-2">
          Desbloqueie treinos, consultoria, cupons e cashback exclusivo.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {plans.map(plan => (
          <PlanCard
            key={plan.slug}
            plan={plan}
            currentPlan={currentPlan}
            currentCpf={currentCpf}
            featured={plan.slug === "plano3"}
            premium={plan.slug === "atleta"}
          />
        ))}
      </div>

      <div className="text-center text-xs text-gray-3 mt-4">
        Cancelamento a qualquer momento. Sem fidelidade.
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  currentPlan,
  currentCpf,
  featured,
  premium,
}: {
  plan: Plan;
  currentPlan: PlanTier;
  currentCpf: string | null;
  featured?: boolean;
  premium?: boolean;
}) {
  const isCurrent = plan.slug === currentPlan;
  const items = featuresToList(plan);

  return (
    <div
      className={`bg-bg-1 border rounded-[22px] p-6 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 flex flex-col ${
        isCurrent
          ? "border-success"
          : premium
          ? "border-pink bg-gradient-to-b from-[#1A0010] to-bg-1"
          : featured
          ? "border-pink/60"
          : "border-gray-4"
      }`}
    >
      {premium && !isCurrent && (
        <div className="absolute top-3 right-[-30px] bg-pink text-white text-[9px] font-bold tracking-[0.12em] px-9 py-1 rotate-45">
          PREMIUM
        </div>
      )}
      {featured && !premium && !isCurrent && (
        <div className="absolute top-3 right-[-30px] bg-pink/80 text-white text-[9px] font-bold tracking-[0.12em] px-9 py-1 rotate-45">
          POPULAR
        </div>
      )}
      {isCurrent && (
        <div className="absolute top-3 right-[-26px] bg-success text-bg-base text-[9px] font-bold tracking-[0.12em] px-9 py-1 rotate-45">
          ATUAL
        </div>
      )}

      <div className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase mb-2">
        {plan.name}
      </div>
      <div className="font-display text-[40px] leading-none text-white">
        {plan.price_cents === 0
          ? "FREE"
          : `R$ ${(plan.price_cents / 100).toFixed(2).replace(".", ",")}`}
      </div>
      <div className="text-[12px] text-gray-3 mb-5">
        {plan.price_cents === 0 ? "para sempre" : "/mês"}
      </div>

      <div className="flex flex-col gap-2 mb-5 flex-1">
        {items.map((it, i) => (
          <FeatureRow key={i} on={it.on} label={it.label} />
        ))}
      </div>

      {plan.price_cents === 0 ? (
        <Button variant="ghost" size="sm" className="w-full" disabled>
          Plano Gratuito
        </Button>
      ) : (
        <SubscribeButton plan={plan} currentPlan={currentPlan} currentCpf={currentCpf} />
      )}
    </div>
  );
}

function FeatureRow({ on, label }: { on: boolean; label: string }) {
  return (
    <div className={`flex items-start gap-2 text-[12.5px] ${on ? "text-gray-1" : "text-gray-3"}`}>
      <span className={`mt-0.5 ${on ? "text-pink" : "text-gray-4"}`}>
        {on ? <Check size={14} /> : <X size={14} />}
      </span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Converte o JSONB `features` + percentuais do plan em uma lista de "feature: on/off"
 * pra render uniforme em todos os cards.
 */
function featuresToList(plan: Plan): Array<{ on: boolean; label: string }> {
  const f: PlanFeatures = plan.features ?? {};
  const items: Array<{ on: boolean; label: string }> = [];

  // Treinos
  if (f.workouts) {
    items.push({ on: true, label: "Biblioteca completa de treinos" });
  } else if (typeof f.workouts_preview === "number" && f.workouts_preview > 0) {
    items.push({ on: true, label: `${f.workouts_preview} treinos preview grátis` });
  } else {
    items.push({ on: false, label: "Treinos completos" });
  }

  items.push({ on: !!f.diet, label: "Plano de dieta personalizado" });
  items.push({ on: !!f.supplements, label: "Acompanhamento de suplementação" });
  if (f.juices) {
    items.push({ on: true, label: "Sucos da Kath" });
  }

  // Chat
  if (typeof f.chat_sla_h === "number") {
    items.push({ on: true, label: `Chat com Kath/Sidney (SLA ${f.chat_sla_h}h)` });
  } else {
    items.push({ on: false, label: "Chat com Kath/Sidney" });
  }

  // Reavaliação
  if (f.reavaliation === "biweekly") {
    items.push({ on: true, label: "Reavaliação quinzenal" });
  } else if (f.reavaliation === "monthly") {
    items.push({ on: true, label: "Reavaliação mensal" });
  }

  // Vídeo 1-1
  if (typeof f.video_call_per_month === "number" && f.video_call_per_month > 0) {
    items.push({ on: true, label: `${f.video_call_per_month}x vídeo 1-1 por mês` });
  }

  // Cupons / afiliados
  if (f.affiliate_clicks_per_month === "unlimited") {
    items.push({ on: true, label: "Cupons + afiliados ilimitados" });
  } else if (typeof f.affiliate_clicks_per_month === "number") {
    items.push({ on: true, label: `${f.affiliate_clicks_per_month} clicks de afiliado/mês` });
  }

  // Estética
  if (f.estetica_book_all) {
    items.push({ on: true, label: "Agenda todos os serviços de estética" });
  }

  // Cashback + descontos
  if (plan.cashback_pct > 0) {
    items.push({ on: true, label: `Cashback ${plan.cashback_pct}%` });
  }
  if (plan.store_discount_pct > 0) {
    items.push({ on: true, label: `${plan.store_discount_pct}% off na loja` });
  }
  if (plan.estetica_discount_pct > 0) {
    items.push({ on: true, label: `${plan.estetica_discount_pct}% off na estética` });
  }

  return items;
}
