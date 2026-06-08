"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { SubscribeButton } from "./subscribe-button";
import type { Plan, PlanFeatures, BillingCycle } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";
import { PLAN_FEATURE_LISTS } from "@/lib/billing/plan-features";

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


export function PlansGrid({
  plans,
  currentPlan,
  currentCpf,
  hasActiveSubscription,
}: {
  plans: Plan[];
  currentPlan: PlanTier;
  currentCpf: string | null;
  hasActiveSubscription: boolean;
}) {
  const searchParams = useSearchParams();
  const rawCycle = searchParams?.get("cycle");
  const initialCycle: BillingCycle =
    rawCycle === "semestral" ? "semestral" : rawCycle === "mensal" ? "mensal" : "anual";
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);

  return (
    <>
      {/* Toggle de ciclo */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-2 border border-gray-4">
          <button
            type="button"
            onClick={() => setCycle("mensal")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
              cycle === "mensal" ? "bg-gray-3 text-white" : "text-gray-3 hover:text-gray-2"
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCycle("semestral")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
              cycle === "semestral" ? "bg-pink text-white" : "text-gray-2 hover:text-white"
            }`}
          >
            Semestral
          </button>
          <button
            type="button"
            onClick={() => setCycle("anual")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all inline-flex items-center gap-2 ${
              cycle === "anual" ? "bg-pink text-white" : "text-gray-2 hover:text-white"
            }`}
          >
            Anual
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                cycle === "anual" ? "bg-white/20 text-white" : "bg-pink/15 text-pink"
              }`}
            >
              -35%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 justify-items-center">
        {plans.map((plan) => (
          <PlanCard
            key={plan.slug}
            plan={plan}
            cycle={cycle}
            currentPlan={currentPlan}
            currentCpf={currentCpf}
            hasActiveSubscription={hasActiveSubscription}
            featured={plan.slug === "saude_completa"}
            premium={plan.slug === "atleta"}
          />
        ))}
      </div>

      <div className="text-center text-xs text-gray-3 mt-4">
        {cycle === "mensal"
          ? "Plano mensal sem fidelidade. Mais econômico no semestral ou anual."
          : "Planos semestral ou anual. À vista no PIX/boleto ou parcelado no cartão."}
      </div>
    </>
  );
}

function PlanCard({
  plan,
  cycle,
  currentPlan,
  currentCpf,
  hasActiveSubscription,
  featured,
  premium,
}: {
  plan: Plan;
  cycle: BillingCycle;
  currentPlan: PlanTier;
  currentCpf: string | null;
  hasActiveSubscription: boolean;
  featured?: boolean;
  premium?: boolean;
}) {
  const isCurrent = plan.slug === currentPlan && hasActiveSubscription;
  // Lista de benefícios rica (mesma copy da landing). Fallback para o derivado
  // do JSONB caso um slug novo ainda não tenha copy definida.
  const richItems = PLAN_FEATURE_LISTS[plan.slug];
  const items: string[] =
    richItems && richItems.length > 0
      ? richItems
      : featuresToList(plan)
          .filter((f) => f.on)
          .map((f) => f.label);
  const mensalCents = plan.monthly_mensal_cents ?? 0;
  const monthly =
    cycle === "anual"
      ? plan.monthly_anual_cents
      : cycle === "mensal"
      ? mensalCents
      : plan.monthly_semestral_cents;
  const total =
    cycle === "anual"
      ? plan.total_anual_cents
      : cycle === "mensal"
      ? mensalCents
      : plan.total_semestral_cents;
  const months = cycle === "anual" ? 12 : cycle === "mensal" ? 1 : 6;

  return (
    <div
      className={`bg-bg-1 border rounded-[22px] p-6 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 flex flex-col w-full max-w-sm ${
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
      <div className="font-display text-[40px] leading-none text-white">R$ {brl(monthly)}</div>
      {cycle === "mensal" ? (
        <>
          <div className="text-[12px] text-gray-3 mb-0.5">/mês (sem fidelidade)</div>
          <div className="text-[11px] text-yellow/70 mb-5">Economize no semestral ou anual</div>
        </>
      ) : (
        <>
          <div className="text-[12px] text-gray-3 mb-0.5">/mês no plano {cycle}</div>
          <div className="text-[11px] text-gray-2/70 mb-5">{months}× = R$ {brl(total)} à vista</div>
        </>
      )}

      <div className="flex flex-col gap-2 mb-5 flex-1">
        {items.map((text, i) => (
          <FeatureRow key={i} on label={text} />
        ))}
      </div>

      <SubscribeButton plan={plan} cycle={cycle} currentPlan={currentPlan} currentCpf={currentCpf} hasActiveSubscription={hasActiveSubscription} featured={featured} />
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

function featuresToList(plan: Plan): Array<{ on: boolean; label: string }> {
  const f: PlanFeatures = plan.features ?? {};
  const items: Array<{ on: boolean; label: string }> = [];

  if (f.workouts) {
    items.push({ on: true, label: "Biblioteca completa de vídeos" });
  } else if (typeof f.workouts_preview === "number" && f.workouts_preview > 0) {
    items.push({ on: true, label: `${f.workouts_preview} vídeos preview grátis` });
  } else {
    items.push({ on: false, label: "Vídeos completos" });
  }

  items.push({ on: !!f.diet, label: "Plano de dieta personalizado" });
  items.push({ on: !!f.supplements, label: "Acompanhamento de suplementação" });
  if (f.juices) {
    items.push({ on: true, label: "Sucos da Kath" });
  }

  if (typeof f.chat_sla_h === "number") {
    items.push({ on: true, label: `Chat com Kath/Sidney (SLA ${f.chat_sla_h}h)` });
  } else {
    items.push({ on: false, label: "Chat com Kath/Sidney" });
  }

  if (f.reavaliation === "biweekly") {
    items.push({ on: true, label: "Reavaliação quinzenal" });
  } else if (f.reavaliation === "monthly") {
    items.push({ on: true, label: "Reavaliação mensal" });
  }

  if (typeof f.video_call_per_month === "number" && f.video_call_per_month > 0) {
    items.push({ on: true, label: `${f.video_call_per_month}x vídeo 1-1 por mês` });
  }

  if (f.affiliate_clicks_per_month === "unlimited") {
    items.push({ on: true, label: "Cupons + afiliados ilimitados" });
  } else if (typeof f.affiliate_clicks_per_month === "number") {
    items.push({ on: true, label: `${f.affiliate_clicks_per_month} clicks de afiliado/mês` });
  }

  if (plan.cashback_pct > 0) {
    items.push({ on: true, label: `Cashback ${plan.cashback_pct}%` });
  }
  if (plan.store_discount_pct > 0) {
    items.push({ on: true, label: `${plan.store_discount_pct}% off na loja` });
  }

  return items;
}
