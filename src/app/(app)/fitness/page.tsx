import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { WorkoutCard } from "@/components/fitness/workout-card";
import { WorkoutFilters } from "@/components/fitness/workout-filters";
import { StreakBadge } from "@/components/fitness/streak-badge";
import { PlayCircle } from "lucide-react";
import { Suspense } from "react";
import { planLevel, hasActiveAccess } from "@/lib/billing/access";
import { LOWER_BODY_CATEGORIES, UPPER_BODY_CATEGORIES } from "@/constants/categories";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Treinos em Vídeo HD — Glúteos, Pernas, HIIT e Corpo Todo",
  description:
    "Biblioteca completa de treinos em vídeo HD gravados pela Kath Guedes. Glúteos, pernas, quadríceps, costas, ombro, peito, abdômen, HIIT, funcional, alongamento. Novos treinos toda semana.",
  keywords: [
    "treinos em vídeo",
    "treino de glúteos",
    "treino feminino",
    "HIIT",
    "treino online",
    "biblioteca de treinos",
    "treino quadriceps",
    "treino funcional",
    "kath guedes treinos",
    "treino em casa",
    "treino academia",
  ],
  alternates: {
    canonical: "https://www.kathguedes.com.br/fitness",
    languages: { "pt-BR": "https://www.kathguedes.com.br/fitness" },
  },
  openGraph: {
    title: "Treinos em Vídeo HD — KathApp",
    description:
      "Biblioteca completa de treinos em vídeo exclusivos da Kath. Glúteos, pernas, HIIT e mais.",
    url: "https://www.kathguedes.com.br/fitness",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Treinos KathApp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Treinos em Vídeo HD — KathApp",
    description: "Biblioteca completa de treinos exclusivos da Kath.",
  },
};

interface Props {
  searchParams: Promise<{ cat?: string; lvl?: string }>;
}

export default async function FitnessPage({ searchParams }: Props) {
  const { cat, lvl } = await searchParams;
  const { userId } = await auth();
  // Antes lia via RLS client; em dev a integracao Clerk↔Supabase fica fora e o catalogo
  // volta vazio. Mudamos para admin + gate manual por plano: lemos plan_tier do user,
  // filtramos required_plan em codigo. RLS workouts_select_by_plan e replicada aqui.
  const admin = createAdminSupabaseClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier, workout_streak, subscription_status, subscription_ends_at")
    .eq("id", userId!)
    .single();

  const userTier = ((profile?.plan_tier as string) || "start") as PlanTier;
  const userLevel = planLevel(userTier);
  // Gate freemium: tier so libera quando ha acesso pago ativo (status active OU
  // dentro do periodo pago). Quem nao pagou ve so os treinos is_free_preview.
  const hasActiveSub = hasActiveAccess(
    profile as { subscription_status?: string | null; subscription_ends_at?: string | null } | null,
  );

  // Mostramos TODOS os treinos publicados (independentemente do plano) — quem
  // nao tem acesso ve o card com cadeado e link pra /planos. Antes filtravamos
  // por allowedTiers e o user achava que so existia conteudo do plano dele.
  // O gate de seguranca real esta em /fitness/[id] (notFound se locked) e nas
  // policies RLS — aqui eh apenas exibicao do catalogo.
  const allWorkoutsForCategoriesPromise = admin
    .from("workout_videos")
    .select("category")
    .eq("is_published", true);

  let query = admin
    .from("workout_videos")
    .select("*")
    .eq("is_published", true)
    .order("title", { ascending: true });

  // 'inferior'/'superior' são guarda-chuvas (abaixo/acima do quadril) → filtram
  // por TODAS as categorias do membro, não só pelo slug literal.
  if (cat === "inferior") query = query.in("category", [...LOWER_BODY_CATEGORIES]);
  else if (cat === "superior") query = query.in("category", [...UPPER_BODY_CATEGORIES]);
  else if (cat) query = query.eq("category", cat);
  if (lvl) query = query.eq("level", lvl);

  const [{ data: workouts }, { data: allForCategories }] = await Promise.all([
    query,
    allWorkoutsForCategoriesPromise,
  ]);

  const availableCategories = Array.from(
    new Set(
      (allForCategories ?? [])
        .map((w) => w.category as string | null)
        .filter((c): c is string => !!c),
    ),
  );
  // Garante as abas guarda-chuva "Superiores"/"Inferiores" sempre que houver
  // pelo menos um vídeo do membro (mesmo que nenhum esteja no slug literal).
  const lowerSet = new Set<string>(LOWER_BODY_CATEGORIES);
  const upperSet = new Set<string>(UPPER_BODY_CATEGORIES);
  if (availableCategories.some((c) => lowerSet.has(c)) && !availableCategories.includes("inferior"))
    availableCategories.push("inferior");
  if (availableCategories.some((c) => upperSet.has(c)) && !availableCategories.includes("superior"))
    availableCategories.push("superior");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl lg:text-5xl text-white">
            BIBLIOTECA DE VÍDEOS
          </h1>
          <p className="text-gray-2 text-sm mt-1">
            Vídeos de treino exclusivos da Kath — assista e registre seu progresso.
          </p>
        </div>
        <StreakBadge streak={profile?.workout_streak ?? 0} />
      </div>

      {/* Filters */}
      <Suspense>
        <WorkoutFilters availableCategories={availableCategories} />
      </Suspense>

      {/* Grid */}
      {!workouts?.length ? (
        <div className="text-center py-20">
          <PlayCircle
            size={48}
            className="stroke-gray-3 mx-auto mb-4"
          />
          <p className="text-gray-2">Nenhum treino disponível no momento.</p>
          <p className="text-gray-3 text-sm mt-1">
            Novos treinos são publicados toda semana pela Kath.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {workouts.map((w) => {
            // is_free_preview destranca o video pra qualquer um. Caso contrario,
            // exige subscription ativa E tier >= required.
            const isUnlocked =
              (w as { is_free_preview?: boolean }).is_free_preview === true ||
              (hasActiveSub && planLevel(w.required_plan as PlanTier) <= userLevel);
            const isLocked = !isUnlocked;
            return (
              <WorkoutCard
                key={w.id}
                id={w.id}
                title={w.title}
                youtube_id={w.youtube_id}
                category={w.category}
                level={w.level}
                duration_minutes={w.duration_minutes}
                required_plan={w.required_plan}
                views_count={w.views_count}
                thumbnail_url={(w as { thumbnail_url?: string | null }).thumbnail_url}
                isLocked={isLocked}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
