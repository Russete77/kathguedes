import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { StreakBadge } from "@/components/fitness/streak-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import {
  Crown,
  Calendar,
  BarChart2,
  Settings,
  Bell,
  ArrowRight,
} from "lucide-react";
import WalletBlock from "./wallet-block";
import { getWalletActiveCents } from "@/lib/billing/wallet";
import { hasPlanAccess, isTopPlan } from "@/lib/billing/access";

export const metadata: Metadata = {
  title: "Meu Perfil",
  description: "Gerencie seu perfil, plano e configurações no KathApp.",
};

export default async function PerfilPage() {
  const user = await currentUser();
  const { userId } = await auth();
  // Admin + filtro user_id (RLS bloqueava em dev mesmo lendo o proprio profile).
  const supabase = createAdminSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId!)
    .single();

  const { count: totalWorkouts } = await supabase
    .from("workout_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId!);

  const streak = profile?.workout_streak ?? 0;
  const planTier = (profile?.plan_tier as string) || "free";
  const subscriptionEnds = profile?.subscription_ends_at
    ? new Date(profile.subscription_ends_at as string).toLocaleDateString("pt-BR")
    : null;

  const activeCents = await getWalletActiveCents(userId!);
  const adminSb = createAdminSupabaseClient();
  const { data: nextExp } = await adminSb
    .from("wallet_credits")
    .select("amount_cents,expires_at")
    .eq("user_id", userId!)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .gt("amount_cents", 0)
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const planColors: Record<string, string> = {
    free: "text-gray-2",
    acesso: "text-info",
    plano1: "text-info",
    plano2: "text-pink",
    plano3: "text-pink",
    atleta: "text-yellow",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-glow-pink opacity-10 pointer-events-none" />
        <div className="relative z-10">
          <div className="w-20 h-20 rounded-full bg-bg-3 border-2 border-pink mx-auto mb-4 flex items-center justify-center overflow-hidden">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt=""
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display text-[32px] text-pink">
                {(user?.firstName?.[0] || "K").toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl text-white">
            {(user?.firstName || "").toUpperCase()} {(user?.lastName || "").toUpperCase()}
          </h1>
          <p className="text-gray-2 text-sm mt-1">{user?.emailAddresses?.[0]?.emailAddress}</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Badge variant={isTopPlan(planTier) ? "yellow" : hasPlanAccess(planTier, "plano2") ? "pink" : "white"}>
              <Crown size={12} />
              {planTier.toUpperCase()}
            </Badge>
            <StreakBadge streak={streak} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 text-center">
          <div className="font-display text-[32px] leading-none text-pink">{streak}</div>
          <div className="text-[11px] text-gray-3 mt-1">Streak</div>
        </div>
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 text-center">
          <div className="font-display text-[32px] leading-none text-white">{totalWorkouts || 0}</div>
          <div className="text-[11px] text-gray-3 mt-1">Treinos</div>
        </div>
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 text-center">
          <div className={`font-display text-[32px] leading-none ${planColors[planTier] || "text-white"}`}>
            {planTier.toUpperCase()}
          </div>
          <div className="text-[11px] text-gray-3 mt-1">Plano</div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={16} className="stroke-pink" />
          <span className="font-mono text-[11px] text-gray-2 tracking-[0.1em] uppercase">Assinatura</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-gray-1">Plano atual</span>
          <Badge variant={planTier === "free" ? "dark" : "pink"}>{planTier.toUpperCase()}</Badge>
        </div>
        {subscriptionEnds && (
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-1">Vence em</span>
            <span className="font-mono text-[13px] text-gray-2 flex items-center gap-1.5">
              <Calendar size={12} className="stroke-gray-3" />
              {subscriptionEnds}
            </span>
          </div>
        )}
        {!isTopPlan(planTier) && (
          <Link href="/planos" className="block pt-2">
            <Button size="sm" className="w-full">
              <Crown size={14} /> Fazer Upgrade <ArrowRight size={14} />
            </Button>
          </Link>
        )}
      </div>

      {/* Wallet */}
      <WalletBlock
        activeCents={activeCents}
        expiringSoonCents={nextExp?.amount_cents ?? 0}
        expiringSoonAt={nextExp?.expires_at ?? null}
      />

      {/* Menu */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
        <MenuLink href="/consultoria" icon={<BarChart2 size={18} />} label="Minha Consultoria" />
        <MenuLink href="/chat" icon={<Bell size={18} />} label="Chat VIP" />
        <MenuLink href="/perfil/notificacoes" icon={<Bell size={18} />} label="Notificações" />
        <MenuLink href="/planos" icon={<Crown size={18} />} label="Planos e Preços" />
        <MenuLink href="/calculadora" icon={<Settings size={18} />} label="Calculadora de Macros" last />
      </div>
    </div>
  );
}

function MenuLink({ href, icon, label, last = false }: { href: string; icon: React.ReactNode; label: string; last?: boolean }) {
  return (
    <Link href={href} className={`flex items-center justify-between px-5 py-4 hover:bg-bg-2 transition-colors ${!last ? "border-b border-gray-4/50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-gray-2">{icon}</span>
        <span className="text-[14px] text-gray-1">{label}</span>
      </div>
      <ArrowRight size={14} className="stroke-gray-3" />
    </Link>
  );
}
