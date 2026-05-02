import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { Badge } from "@/components/ui/badge";
import {
  Settings2,
  Flame,
  Clock,
  ClipboardList,
  Crown,
  Dumbbell,
  UtensilsCrossed,
  Target,
  CalendarCheck,
  Zap,
  Droplets,
  Beef,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import { ExerciseCard } from "./exercise-card";
import { AnamneseSummary } from "./anamnese-summary";

export const metadata: Metadata = {
  title: "Consultoria Personalizada",
  description: "Consultoria fitness personalizada com a Kath Guedes — plano de treino e dieta montados sob medida, acompanhamento direto pelo app.",
  keywords: ["consultoria fitness", "treino personalizado", "dieta personalizada", "personal trainer online"],
};

export default async function ConsultoriaPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();

  const planTier = profile?.plan_tier || "free";

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*")
    .eq("user_id", userId!)
    .in("status", ["pending", "in_progress", "delivered"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // ── Sem consultoria ativa ──
  if (!consultation) {
    if (planTier === "vip") {
      return (
        <div className="max-w-2xl mx-auto px-4 py-6 text-center py-20">
          <Crown size={48} className="stroke-pink mx-auto mb-4" />
          <h2 className="font-display text-3xl text-white mb-2">
            CONSULTORIA <span className="text-pink">VIP</span>
          </h2>
          <p className="text-gray-2 mb-6">
            Sua consultoria será criada automaticamente. Se já fez o pagamento,
            aguarde alguns instantes e recarregue a página.
          </p>
          <Link
            href="/planos"
            className="inline-flex items-center gap-2 text-sm text-pink hover:text-pink/80 transition-colors"
          >
            Ver meu plano
          </Link>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center py-20">
        <Settings2 size={48} className="stroke-gray-3 mx-auto mb-4" />
        <h2 className="font-display text-3xl text-white mb-2">
          SEM CONSULTORIA ATIVA
        </h2>
        <p className="text-gray-2 mb-6">
          Faça upgrade para o plano VIP para ter acesso à consultoria
          personalizada com treino e dieta montados pela Kath.
        </p>
        <Link
          href="/planos"
          className="inline-flex items-center gap-2 px-6 py-3 bg-pink hover:bg-pink/90 text-white rounded-full font-semibold text-sm transition-colors"
        >
          <Crown size={16} />
          Ver plano VIP
        </Link>
      </div>
    );
  }

  // ── Consultoria pendente ──
  if (consultation.status === "pending") {
    const hasAnamnesis = consultation.anamnesis != null;

    if (!hasAnamnesis) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-6 text-center py-20">
          <div className="w-20 h-20 bg-pink-dim rounded-full flex items-center justify-center border border-pink/20 mx-auto mb-5">
            <ClipboardList size={36} className="stroke-pink" />
          </div>
          <h2 className="font-display text-3xl text-white mb-2">
            PREENCHA SUA <span className="text-pink">ANAMNESE</span>
          </h2>
          <p className="text-gray-2 mb-6 max-w-md mx-auto">
            Para a Kath montar seu plano personalizado de treino e dieta,
            precisamos conhecer você melhor. Preencha a ficha de anamnese.
          </p>
          <Link
            href="/consultoria/anamnese"
            className="inline-flex items-center gap-2 px-6 py-3 bg-pink hover:bg-pink/90 text-white rounded-full font-semibold text-sm transition-colors"
          >
            <ClipboardList size={16} />
            Preencher anamnese
          </Link>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center py-20">
        <div className="animate-pulse mb-4">
          <Settings2 size={48} className="stroke-pink mx-auto" />
        </div>
        <h2 className="font-display text-3xl text-white mb-2">
          ANAMNESE <span className="text-pink">ENVIADA</span>
        </h2>
        <p className="text-gray-2">
          Sua ficha foi recebida! Em breve a Kath vai começar a montar
          seu plano personalizado. Você receberá uma notificação.
        </p>
      </div>
    );
  }

  // ── Em progresso ──
  if (consultation.status === "in_progress") {
    const hasAnamnesis = consultation.anamnesis != null;
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-pulse mb-4">
            <Settings2 size={48} className="stroke-pink mx-auto" />
          </div>
          <h2 className="font-display text-3xl text-white mb-2">
            SEU PLANO ESTÁ SENDO <span className="text-pink">MONTADO</span>
          </h2>
          <p className="text-gray-2">
            A Kath está preparando seu plano personalizado. Você receberá uma
            notificação quando estiver pronto.
          </p>
        </div>
        {!hasAnamnesis && (
          <div className="bg-bg-1 border border-yellow/30 rounded-[22px] p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 bg-yellow/10 rounded-full flex items-center justify-center shrink-0">
              <ClipboardList size={22} className="stroke-yellow" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-display text-lg text-white">
                ANAMNESE <span className="text-yellow">PENDENTE</span>
              </h3>
              <p className="text-gray-2 text-sm mt-0.5">
                Você ainda não preencheu sua ficha de anamnese — ela ajuda a Kath
                a montar um plano ainda mais preciso.
              </p>
            </div>
            <Link
              href="/consultoria/anamnese"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow hover:bg-yellow/90 text-black rounded-full font-semibold text-sm transition-colors shrink-0"
            >
              <ClipboardList size={14} />
              Preencher agora
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // ── Consultoria delivered — plano completo ──
  // ══════════════════════════════════════════

  const hasAnamnesis = consultation.anamnesis != null;

  const workoutPlan = consultation.workout_plan as {
    weeks: {
      name: string;
      days: {
        name: string;
        exercises: {
          name: string;
          sets: number;
          reps: string;
          rest: string;
          notes?: string;
          youtube_id?: string;
        }[];
      }[];
    }[];
  } | null;

  const dietPlan = consultation.diet_plan as {
    meals: {
      name: string;
      time: string;
      foods: { name: string; quantity: string; calories?: number; protein?: number; carbs?: number; fat?: number }[];
    }[];
  } | null;

  const mealIcons = ["☀️", "🍳", "🥗", "🍌", "🍖", "🥤", "🌙"];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-10">
      {/* ── Header ── */}
      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          MINHA <span className="text-pink">CONSULTORIA</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Seu plano personalizado montado pela Kath.
        </p>
      </div>

      {/* ── Anamnese CTA (if not filled) ── */}
      {!hasAnamnesis && (
        <div className="bg-bg-1 border border-yellow/30 rounded-[22px] p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-12 h-12 bg-yellow/10 rounded-full flex items-center justify-center shrink-0">
            <ClipboardList size={22} className="stroke-yellow" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-display text-lg text-white">
              ANAMNESE <span className="text-yellow">PENDENTE</span>
            </h3>
            <p className="text-gray-2 text-sm mt-0.5">
              Preencha sua ficha de anamnese para que a Kath possa ajustar
              ainda mais o seu plano.
            </p>
          </div>
          <Link
            href="/consultoria/anamnese"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow hover:bg-yellow/90 text-black rounded-full font-semibold text-sm transition-colors shrink-0"
          >
            <ClipboardList size={14} />
            Preencher agora
          </Link>
        </div>
      )}

      {/* ── Macros Card ── */}
      {consultation.daily_calories != null && consultation.daily_calories > 0 && (
        <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-pink/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-pink-dim rounded-full flex items-center justify-center">
                <Flame size={16} className="stroke-pink" />
              </div>
              <span className="font-display text-lg text-white tracking-wide">
                MACROS DIÁRIOS
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-4 text-center hover:border-pink/40 transition-colors">
                <div className="w-10 h-10 bg-pink-dim rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap size={18} className="stroke-pink" />
                </div>
                <div className="font-display text-[32px] leading-none text-pink">
                  {consultation.daily_calories}
                </div>
                <div className="font-mono text-[11px] text-gray-3 mt-1 uppercase tracking-wider">kcal</div>
              </div>
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-4 text-center hover:border-emerald-500/40 transition-colors">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Beef size={18} className="stroke-emerald-400" />
                </div>
                <div className="font-display text-[32px] leading-none text-emerald-400">
                  {consultation.daily_protein}g
                </div>
                <div className="font-mono text-[11px] text-gray-3 mt-1 uppercase tracking-wider">proteína</div>
              </div>
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-4 text-center hover:border-amber-500/40 transition-colors">
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Wheat size={18} className="stroke-amber-400" />
                </div>
                <div className="font-display text-[32px] leading-none text-amber-400">
                  {consultation.daily_carbs}g
                </div>
                <div className="font-mono text-[11px] text-gray-3 mt-1 uppercase tracking-wider">carboidrato</div>
              </div>
              <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-4 text-center hover:border-blue-500/40 transition-colors">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Droplets size={18} className="stroke-blue-400" />
                </div>
                <div className="font-display text-[32px] leading-none text-blue-400">
                  {consultation.daily_fat}g
                </div>
                <div className="font-mono text-[11px] text-gray-3 mt-1 uppercase tracking-wider">gordura</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* ── PLANO DE TREINO ── */}
      {/* ══════════════════════════════════════ */}
      {workoutPlan?.weeks?.map((week, wi) => (
        <section key={wi} className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-dim rounded-full flex items-center justify-center">
              <Dumbbell size={18} className="stroke-pink" />
            </div>
            <div>
              <h2 className="font-display text-2xl text-white tracking-wide">
                PLANO DE TREINO
              </h2>
              {week.name && (
                <p className="font-mono text-[11px] text-gray-3 uppercase tracking-wider">
                  {week.name}
                </p>
              )}
            </div>
          </div>

          {/* Training Days */}
          {week.days.map((day, di) => (
            <div key={di} className="space-y-4">
              {/* Day Title */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-pink border-2 border-pink rounded-[10px] flex items-center justify-center">
                  <span className="font-display text-[15px] text-white">
                    {String.fromCharCode(65 + di)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-[20px] text-white tracking-wide">
                    {(day.name ?? "Treino").toUpperCase()}
                  </h3>
                </div>
                <Badge variant="pink">
                  <Target size={10} />
                  {day.exercises.length} exercícios
                </Badge>
              </div>

              {/* Exercise Cards — Grid como treinos */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {day.exercises.map((ex, ei) => (
                  <ExerciseCard key={ei} exercise={ex} index={ei} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {/* ══════════════════════════════════════ */}
      {/* ── PLANO ALIMENTAR ── */}
      {/* ══════════════════════════════════════ */}
      {dietPlan?.meals && dietPlan.meals.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <UtensilsCrossed size={18} className="stroke-emerald-400" />
            </div>
            <h2 className="font-display text-2xl text-white tracking-wide">
              PLANO ALIMENTAR
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {dietPlan.meals.map((meal, mi) => {
              const totalCals = meal.foods?.reduce((s, f) => s + (f.calories || 0), 0) ?? 0;
              const totalProtein = meal.foods?.reduce((s, f) => s + (f.protein || 0), 0) ?? 0;

              return (
                <div
                  key={mi}
                  className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden transition-all duration-200 hover:border-emerald-500/30 hover:-translate-y-0.5"
                >
                  {/* Meal Header */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-transparent px-5 pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{mealIcons[mi % mealIcons.length]}</span>
                        <div>
                          <h3 className="font-display text-[16px] text-white tracking-wide">
                            {(meal.name ?? "Refeição").toUpperCase()}
                          </h3>
                          {meal.time && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock size={10} className="stroke-gray-3" />
                              <span className="font-mono text-[11px] text-gray-3">
                                {meal.time}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {totalCals > 0 && (
                        <Badge variant="green">{totalCals} kcal</Badge>
                      )}
                    </div>
                  </div>

                  {/* Foods */}
                  <div className="px-5 py-3 space-y-0">
                    {meal.foods?.map((food, fi) => (
                      <div
                        key={fi}
                        className="flex items-center justify-between py-2.5 border-b border-gray-4/30 last:border-0"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-[14px] text-white truncate">
                            {food.name ?? "—"}
                          </span>
                        </div>
                        <span className="font-mono text-[12px] text-emerald-400 font-semibold shrink-0 ml-3">
                          {food.quantity ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Meal Macros Footer */}
                  {totalProtein > 0 && (
                    <div className="px-5 py-2.5 border-t border-gray-4/40 bg-bg-2/50 flex items-center gap-3">
                      <span className="font-mono text-[10px] text-gray-3 uppercase tracking-wider">Macros:</span>
                      <span className="font-mono text-[10px] text-emerald-400">{totalProtein}g prot</span>
                      {(meal.foods?.reduce((s, f) => s + (f.carbs || 0), 0) ?? 0) > 0 && (
                        <span className="font-mono text-[10px] text-amber-400">
                          {meal.foods.reduce((s, f) => s + (f.carbs || 0), 0)}g carb
                        </span>
                      )}
                      {(meal.foods?.reduce((s, f) => s + (f.fat || 0), 0) ?? 0) > 0 && (
                        <span className="font-mono text-[10px] text-blue-400">
                          {meal.foods.reduce((s, f) => s + (f.fat || 0), 0)}g gord
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Anamnese do usuário (collapsible) ── */}
      {hasAnamnesis && (
        <AnamneseSummary anamnesis={consultation.anamnesis as Record<string, unknown>} />
      )}

      {/* ── Validade ── */}
      {consultation.valid_until && (
        <div className="flex items-center justify-center gap-2 py-4">
          <CalendarCheck size={14} className="stroke-gray-3" />
          <span className="font-mono text-[11px] text-gray-3">
            Plano válido até{" "}
            <span className="text-white">
              {new Date(consultation.valid_until).toLocaleDateString("pt-BR")}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
