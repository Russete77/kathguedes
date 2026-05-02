import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";
import Link from "next/link";
import { SubscribeButton } from "./subscribe-button";

export const metadata: Metadata = {
  title: "Planos e Preços",
  description: "Escolha seu plano KathApp: Free, Start (R$19/mês), Pro (R$39/mês) ou VIP (R$99/mês) com consultoria personalizada. Comece grátis.",
  keywords: ["planos kathapp", "preços", "assinatura fitness", "consultoria fitness preço"],
  alternates: { canonical: "https://kathapp.com.br/planos" },
  openGraph: {
    title: "Planos e Preços — KathApp",
    description: "Free, Start, Pro ou VIP — escolha o plano ideal para seus objetivos fitness.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

const plans = [
  {
    name: "FREE",
    price: 0,
    period: "para sempre",
    features: [
      { text: "5 treinos liberados", ok: true },
      { text: "Afiliados básicos", ok: true },
      { text: "Loja (ver preços)", ok: true },
      { text: "Treinos novos toda semana", ok: false },
      { text: "Cupons de parceiros", ok: false },
      { text: "Consultoria personalizada", ok: false },
      { text: "Chat com a Kath", ok: false },
    ],
  },
  {
    name: "START",
    price: 19,
    period: "/mês",
    features: [
      { text: "Biblioteca completa de treinos", ok: true },
      { text: "Treinos novos toda semana", ok: true },
      { text: "Cupons de parceiros", ok: true },
      { text: "5% desconto na loja", ok: true },
      { text: "Consultoria personalizada", ok: false },
      { text: "Chat com a Kath", ok: false },
    ],
  },
  {
    name: "PRO",
    price: 39,
    period: "/mês",
    featured: true,
    features: [
      { text: "Tudo do START", ok: true },
      { text: "Cupons early access", ok: true },
      { text: "Check-in semanal de evolução", ok: true },
      { text: "10% desconto na loja", ok: true },
      { text: "Acesso antecipado a lançamentos", ok: true },
      { text: "Comunidade exclusiva", ok: true },
      { text: "Consultoria personalizada", ok: false },
      { text: "Chat com a Kath", ok: false },
    ],
  },
  {
    name: "VIP",
    price: 99,
    period: "/mês",
    features: [
      { text: "Tudo do PRO", ok: true },
      { text: "Consultoria mensal completa", ok: true },
      { text: "Treino + dieta personalizados", ok: true },
      { text: "Chat direto com a Kath", ok: true },
      { text: "Lives exclusivas mensais", ok: true },
      { text: "First access cupons 48h", ok: true },
      { text: "20% desconto na loja", ok: true },
    ],
  },
];

export default async function PlanosPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();

  const currentPlan = (profile?.plan_tier as string) || "free";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <div className="text-center">
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          ESCOLHA SEU <span className="text-pink">PLANO</span>
        </h1>
        <p className="text-gray-2 mt-2">
          Desbloqueie treinos, consultoria e cupons exclusivos.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name.toLowerCase();
          const featured = plan.featured;

          return (
            <div
              key={plan.name}
              className={`bg-bg-1 border rounded-[22px] p-7 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 ${
                isCurrent
                  ? "border-success"
                  : featured
                  ? "border-pink bg-gradient-to-b from-[#1A0010] to-bg-1"
                  : "border-gray-4"
              }`}
            >
              {featured && !isCurrent && (
                <div className="absolute top-4 right-[-28px] bg-pink text-white text-[9px] font-bold tracking-[0.12em] px-9 py-1 rotate-45">
                  POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-4 right-[-24px] bg-success text-bg-base text-[9px] font-bold tracking-[0.12em] px-9 py-1 rotate-45">
                  ATUAL
                </div>
              )}

              <div className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase mb-2.5">
                {plan.name}
              </div>
              <div className="font-display text-[52px] leading-none text-white">
                {plan.price === 0 ? "FREE" : `R$${plan.price}`}
              </div>
              <div className="text-[13px] text-gray-3 mb-6">{plan.period}</div>

              <div className="flex flex-col gap-2.5 mb-6">
                {plan.features.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-[13px] ${
                      f.ok ? "text-gray-1" : "text-gray-3"
                    }`}
                  >
                    <span className={`mt-0.5 ${f.ok ? "text-pink" : "text-gray-4"}`}>
                      {f.ok ? <Check size={14} /> : "—"}
                    </span>
                    {f.text}
                  </div>
                ))}
              </div>

              {plan.price === 0 ? (
                <Button variant="ghost" size="sm" className="w-full" disabled>
                  Plano Gratuito
                </Button>
              ) : (
                <SubscribeButton
                  plan={plan.name.toLowerCase() as "start" | "pro" | "vip"}
                  currentPlan={currentPlan}
                  featured={featured}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
