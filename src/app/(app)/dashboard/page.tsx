import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PLAN_LEVELS, planLevel } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";
import { StreakBadge } from "@/components/fitness/streak-badge";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  PlayCircle,
  Target,
  Calculator,
  Tag,
  ShoppingBag,
  Flame,
  ArrowRight,
  Crown,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Seu painel no KathApp — acesse treinos, veja seu progresso de streak, consultoria e loja.",
};

export default async function DashboardPage() {
  const user = await currentUser();
  const { userId } = await auth();
  // Admin client: profile e workouts via RLS bloqueavam em dev (sem A1).
  // Workouts: gate manual de plano (replica workouts_select_by_plan).
  const supabase = createAdminSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId!)
    .single();

  const userLevel = planLevel(
    ((profile?.plan_tier as string) || "free") as PlanTier,
  );
  const allowedTiers = (Object.keys(PLAN_LEVELS) as PlanTier[]).filter(
    (t) => PLAN_LEVELS[t] <= userLevel,
  );

  const { data: recentWorkouts } = await supabase
    .from("workout_videos")
    .select("id, title, youtube_id, category, duration_minutes")
    .eq("is_published", true)
    .in("required_plan", allowedTiers)
    .order("published_at", { ascending: false })
    .limit(4);

  const streak = profile?.workout_streak ?? 0;
  const planTier = (profile?.plan_tier as string) || "free";
  const firstName = user?.firstName || "Atleta";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl lg:text-5xl text-white">
            OLÁ, <span className="text-pink">{firstName.toUpperCase()}</span>
          </h1>
          <p className="text-gray-2 text-sm mt-1">
            Bora treinar hoje? Sua evolução depende de você.
          </p>
        </div>
        <StreakBadge streak={streak} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame size={20} className="stroke-pink" />}
          value={String(streak)}
          label="Dias de streak"
          accent
        />
        <StatCard
          icon={<Crown size={20} className="stroke-yellow" />}
          value={planTier.toUpperCase()}
          label="Seu plano"
        />
        <StatCard
          icon={<PlayCircle size={20} className="stroke-pink" />}
          value={String(recentWorkouts?.length || 0)}
          label="Treinos novos"
        />
        <StatCard
          icon={<Target size={20} className="stroke-success" />}
          value={profile?.last_workout_at ? "Ativo" : "—"}
          label="Último treino"
        />
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="font-display text-2xl text-white mb-4">ACESSO RÁPIDO</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction href="/fitness" icon={<PlayCircle size={24} />} label="Treinos" />
          <QuickAction href="/consultoria" icon={<Target size={24} />} label="Consultoria" />
          <QuickAction href="/calculadora" icon={<Calculator size={24} />} label="Macros" />
          <QuickAction href="/cupons" icon={<Tag size={24} />} label="Cupons" />
          <QuickAction href="/loja" icon={<ShoppingBag size={24} />} label="Loja" />
          <QuickAction href="/kath-estetica" icon={<Sparkles size={24} />} label="Estética" />
        </div>
      </section>

      {/* Recent workouts */}
      {recentWorkouts && recentWorkouts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-white">TREINOS RECENTES</h2>
            <Link
              href="/fitness"
              className="text-[13px] text-pink flex items-center gap-1 hover:text-pink-light transition-colors"
            >
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentWorkouts.map((w) => (
              <Link
                key={w.id}
                href={`/fitness/${w.id}`}
                className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden hover:border-pink/40 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div
                  className="h-[120px] bg-bg-2 bg-cover bg-center relative"
                  style={{
                    backgroundImage: `url(https://img.youtube.com/vi/${w.youtube_id}/mqdefault.jpg)`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 to-transparent" />
                  <div className="absolute bottom-2 left-3">
                    <Badge variant="pink">{(w.category as string).toUpperCase()}</Badge>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-white text-[14px] font-bold line-clamp-1 group-hover:text-pink transition-colors">
                    {w.title}
                  </h3>
                  <span className="font-mono text-[11px] text-gray-3">
                    {w.duration_minutes} min
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upgrade CTA for free users */}
      {planTier === "free" && (
        <section className="bg-bg-1 border border-pink/30 rounded-[22px] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-glow-pink opacity-20 pointer-events-none" />
          <div className="relative z-10">
            <Badge variant="pink" className="mb-3">
              <Crown size={12} />
              UPGRADE
            </Badge>
            <h3 className="font-display text-[28px] leading-none text-white mb-2">
              DESBLOQUEIE TUDO
            </h3>
            <p className="text-gray-2 text-[14px] mb-4 max-w-md">
              Treinos completos, consultoria personalizada, cupons exclusivos e muito mais.
              A partir de R$19/mês.
            </p>
            <Link
              href="/planos"
              className="inline-flex items-center gap-2 font-body font-semibold text-sm px-7 py-3 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200"
            >
              Ver Planos <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/35 transition-all">
      <div className="mb-2">{icon}</div>
      <div className={`font-display text-[28px] leading-none ${accent ? "text-pink" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[12px] text-gray-3 mt-1">{label}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-bg-1 border border-gray-4 rounded-[14px] hover:border-pink/40 hover:bg-bg-2 transition-all duration-150 group"
    >
      <div className="w-12 h-12 bg-pink-dim rounded-[14px] flex items-center justify-center border border-pink/20 text-pink group-hover:shadow-[0_0_16px_rgba(255,0,128,0.2)] transition-shadow">
        {icon}
      </div>
      <span className="text-[12px] font-semibold text-gray-2 group-hover:text-white transition-colors">
        {label}
      </span>
    </Link>
  );
}
