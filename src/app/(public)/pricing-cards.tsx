"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";

export type BillingCycle = "semestral" | "anual" | "mensal";

export interface PricingPlan {
  slug: string;
  name: string;
  level: number;
  monthly_semestral_cents: number;
  total_semestral_cents: number;
  monthly_anual_cents: number;
  total_anual_cents: number;
  monthly_mensal_cents: number;
  features: string[];
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PricingCards({ plans }: { plans: PricingPlan[] }) {
  // Anual é o melhor valor — vem selecionado por padrão.
  const [cycle, setCycle] = useState<BillingCycle>("anual");

  return (
    <div>
      {/* Toggle de ciclo */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-2 border border-gray-4">
          <button
            type="button"
            onClick={() => setCycle("mensal")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold tracking-wide transition-all ${
              cycle === "mensal" ? "bg-gray-3 text-white" : "text-gray-3 hover:text-gray-2"
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCycle("semestral")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold tracking-wide transition-all ${
              cycle === "semestral" ? "bg-pink text-white" : "text-gray-2 hover:text-white"
            }`}
          >
            Semestral
          </button>
          <button
            type="button"
            onClick={() => setCycle("anual")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold tracking-wide transition-all inline-flex items-center gap-2 ${
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const featured = plan.slug === "saude_completa";
          const premium = plan.slug === "atleta";
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
            <div key={plan.slug} className={`relative ${featured ? "pt-3" : ""}`}>
              {featured && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-pink text-white text-[10px] font-bold tracking-[0.14em] px-3 py-1 rounded-full whitespace-nowrap shadow-pink">
                  🔥 MAIS ESCOLHIDO
                </div>
              )}
              <div
                className={`bg-bg-1 border rounded-[22px] p-6 relative overflow-hidden transition-all duration-500 hover:-translate-y-2 group flex flex-col h-full ${
                  featured
                    ? "border-pink bg-gradient-to-b from-[#1A0010] to-bg-1 shadow-[0_0_60px_rgba(255,0,128,0.18)] scale-[1.02]"
                    : premium
                      ? "border-pink/40 bg-gradient-to-b from-[#120008] to-bg-1"
                      : "border-gray-4 hover:border-gray-3"
                }`}
              >
                {premium && !featured && <Crown size={18} className="absolute top-5 right-5 text-pink/60" />}

                <div className="font-mono text-[11px] text-gray-3 tracking-[0.12em] uppercase mb-2.5">{plan.name}</div>
                <div className="font-display text-[36px] sm:text-[44px] leading-none text-white group-hover:text-gradient-pink transition-colors duration-300">
                  R${brl(monthly)}
                </div>
                {cycle === "mensal" ? (
                  <>
                    <div className="text-[12px] text-gray-3 mb-1">/mês (sem fidelidade)</div>
                    <div className="text-[11px] text-yellow/70 mb-5">Economize no semestral ou anual</div>
                  </>
                ) : (
                  <>
                    <div className="text-[12px] text-gray-3 mb-1">/mês no plano {cycle}</div>
                    <div className="text-[11px] text-gray-2/70 mb-5">
                      {months}× = R${brl(total)} à vista
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2 mb-5 flex-1">
                  {plan.features.map((text, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12.5px] text-gray-1">
                      <span className="mt-0.5 text-pink shrink-0">
                        <Check size={14} />
                      </span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href={`/registro?redirect_url=${encodeURIComponent(`/planos?autostart=${plan.slug}&cycle=${cycle}`)}`}
                  className="block"
                >
                  <Button variant={featured || premium ? "primary" : "secondary"} className="w-full" size="sm">
                    {premium ? "Quero ser atleta" : featured ? "Quero esse plano" : "Assinar"}
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
