import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PlansGrid } from "./plans-grid";
import { getActivePlans } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Planos e Preços — Treino, Performance, Saúde Completa e Atleta",
  description:
    "Escolha o plano KathApp em ciclo semestral ou anual: Treino a partir de R$25,90/mês, Performance R$49,90, Saúde Completa R$64,90 ou Atleta R$199,90 (no plano anual). Biblioteca de vídeos, consultoria personalizada e cashback. À vista no PIX ou parcelado no cartão.",
  keywords: [
    "planos kathapp",
    "assinatura fitness",
    "preço consultoria personal trainer",
    "consultoria fitness online",
    "treino online preço",
    "plano dieta personalizada",
    "kath guedes plano",
  ],
  alternates: {
    canonical: "https://www.kathguedes.com.br/planos",
    languages: { "pt-BR": "https://www.kathguedes.com.br/planos" },
  },
  openGraph: {
    title: "Planos e Preços — KathApp",
    description:
      "Treino, Performance, Saúde Completa e Atleta. Planos semestral ou anual, à vista ou parcelado.",
    url: "https://www.kathguedes.com.br/planos",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Planos KathApp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Planos e Preços — KathApp",
    description: "Treino, Performance, Saúde Completa e Atleta.",
  },
};

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier, cpf, subscription_status")
    .eq("id", userId)
    .single();

  const currentPlan: PlanTier = (profile?.plan_tier as PlanTier | undefined) ?? "start";
  const currentCpf: string | null = (profile as { cpf?: string | null } | null)?.cpf ?? null;
  const subscriptionStatus =
    (profile as { subscription_status?: string | null } | null)?.subscription_status ?? "canceled";
  const hasActiveSubscription = subscriptionStatus === "active";
  const plans = await getActivePlans();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8 w-full">
      <div className="text-center">
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          ESCOLHA SEU <span className="text-pink">PLANO</span>
        </h1>
        <p className="text-gray-2 mt-2">
          Desbloqueie a biblioteca de vídeos, consultoria, cupons e cashback exclusivo.
        </p>
      </div>

      <Suspense>
        <PlansGrid
          plans={plans}
          currentPlan={currentPlan}
          currentCpf={currentCpf}
          hasActiveSubscription={hasActiveSubscription}
        />
      </Suspense>
    </div>
  );
}
