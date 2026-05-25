import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { WorkoutCard } from "@/components/fitness/workout-card";
import { WorkoutFilters } from "@/components/fitness/workout-filters";
import { StreakBadge } from "@/components/fitness/streak-badge";
import { PlayCircle } from "lucide-react";
import { Suspense } from "react";
import { PLAN_LEVELS, planLevel } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Treinos em Vídeo",
  description: "Biblioteca completa de treinos em vídeo da Kath Guedes — glúteos, pernas, superior, HIIT e corpo todo. Novos treinos toda semana.",
  keywords: ["treinos em vídeo", "treino de glúteos", "treino feminino", "HIIT", "treino online"],
  alternates: { canonical: "https://kathapp.com.br/fitness" },
  openGraph: {
    title: "Treinos em Vídeo — KathApp",
    description: "Biblioteca completa de treinos em vídeo exclusivos da Kath — glúteos, pernas, superior, HIIT.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
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
    .select("plan_tier, workout_streak")
    .eq("id", userId!)
    .single();

  const userTier = ((profile?.plan_tier as string) || "free") as PlanTier;
  const userLevel = planLevel(userTier);
  const allowedTiers = (Object.keys(PLAN_LEVELS) as PlanTier[]).filter(
    (t) => PLAN_LEVELS[t] <= userLevel,
  );

  // Categorias que tem AO MENOS UM video publicado E acessivel ao plano do user —
  // calculadas em paralelo com a query principal pra nao adicionar latencia.
  // Query separada (sem filtros de cat/lvl) pra que o conjunto de botoes nao mude
  // conforme o user filtra.
  const allWorkoutsForCategoriesPromise = admin
    .from("workout_videos")
    .select("category")
    .eq("is_published", true)
    .in("required_plan", allowedTiers);

  let query = admin
    .from("workout_videos")
    .select("*")
    .eq("is_published", true)
    .in("required_plan", allowedTiers)
    .order("published_at", { ascending: false });

  if (cat) query = query.eq("category", cat);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl lg:text-5xl text-white">
            TREINOS
          </h1>
          <p className="text-gray-2 text-sm mt-1">
            Treinos exclusivos da Kath — assista e registre seu progresso.
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
          {workouts.map((w) => (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
