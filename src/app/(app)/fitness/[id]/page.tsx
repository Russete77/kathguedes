import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { planLevel, hasPlanAccess, hasActiveAccess, tiersUpTo } from "@/lib/billing/access";
import type { PlanTier } from "@/lib/supabase/types";
import { ImmersivePlayer } from "./immersive-player";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Clock, BarChart2, Target, Dumbbell, Info, Lock, Crown,
} from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

const categoryLabels: Record<string, string> = {
  gluteo: "Glúteos", pernas: "Pernas", quadriceps: "Quadríceps", panturrilha: "Panturrilha",
  costas: "Costas", ombro: "Ombro", biceps: "Bíceps", triceps: "Tríceps",
  peito: "Peito", abdomen: "Abdômen",
  superior: "Superior", inferior: "Inferior",
  hiit: "HIIT", cardio: "Cardio", funcional: "Funcional",
  full: "Completo", alongamento: "Alongamento", aquecimento: "Aquecimento",
  viagem: "Viagem", competicao: "Competição",
};

const levelLabels: Record<string, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  // Admin client + gate manual por plano: titulo so vaza se o user tem nivel >= required_plan.
  // Antes era RLS client (workouts_select_by_plan); em dev o JWT do Clerk dev nao eh aceito
  // pelo Supabase e o titulo voltava como "Treino" pra todo mundo. O gate de seguranca eh
  // identico, so movido pra codigo.
  const { userId } = await auth();
  const admin = createAdminSupabaseClient();
  const [{ data: workout }, { data: profile }] = await Promise.all([
    admin
      .from("workout_videos")
      .select("title, required_plan, youtube_id, description, is_free_preview")
      .eq("id", id)
      .single(),
    admin
      .from("profiles")
      .select("plan_tier, subscription_status, subscription_ends_at")
      .eq("id", userId!)
      .single(),
  ]);
  if (!workout) return { title: "Treino" };
  const w = workout as unknown as {
    title: string;
    required_plan: string;
    youtube_id?: string;
    description?: string | null;
    is_free_preview?: boolean;
  };
  const userLevel = planLevel(((profile?.plan_tier as string) || "start") as PlanTier);
  const required = planLevel(w.required_plan as PlanTier);
  const hasActiveSub = hasActiveAccess(
    profile as { subscription_status?: string | null; subscription_ends_at?: string | null } | null,
  );
  // SEO: titulo so vaza se o user pode ver o treino. is_free_preview destranca.
  const canSee = w.is_free_preview === true || (hasActiveSub && userLevel >= required);
  if (!canSee) return { title: "Treino" };

  const url = `https://www.kathguedes.com.br/fitness/${id}`;
  const title = w.title || "Treino";
  // Thumb do YouTube como OG image — sempre disponivel.
  const thumb = w.youtube_id
    ? `https://img.youtube.com/vi/${w.youtube_id}/maxresdefault.jpg`
    : "https://www.kathguedes.com.br/og-image.png";
  const description =
    w.description?.toString().slice(0, 200) ??
    `Treino completo de ${title} no KathApp com a Kath Guedes.`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { "pt-BR": url },
    },
    openGraph: {
      title,
      description,
      url,
      type: "video.other",
      images: [{ url: thumb, width: 1280, height: 720, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [thumb],
    },
  };
}

export default async function WorkoutPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();
  // Antes a policy workouts_select_by_plan gateava (C4 do audit). Em dev o JWT do Clerk
  // nao eh aceito pelo Supabase e mesmo treino free voltava vazio → 404 generalizado.
  // Movemos o gate pra codigo (mesma logica: planLevel(user) >= planLevel(required_plan))
  // usando admin client. Sem regressao de seguranca — o gate explicit aqui eh o mesmo
  // SQL que a RLS aplica.
  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier, subscription_status, subscription_ends_at")
    .eq("id", userId!)
    .single();
  const userTier = ((profile?.plan_tier as string) || "start") as PlanTier;
  const userLevel = planLevel(userTier);
  const hasActiveSub = hasActiveAccess(
    profile as { subscription_status?: string | null; subscription_ends_at?: string | null } | null,
  );

  const { data: workout } = await admin
    .from("workout_videos")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  // Vídeo inexistente/despublicado → 404 de verdade.
  if (!workout) notFound();

  // Gate freemium: is_free_preview destranca pra qualquer um. Caso contrário,
  // exige subscription ativa + tier >= required_plan. Vídeo EXISTE mas está
  // bloqueado → paywall (não 404), inclusive para acesso por URL direta.
  const isPreview = (workout as { is_free_preview?: boolean }).is_free_preview === true;
  const tierOk = planLevel(workout.required_plan as PlanTier) <= userLevel;
  const isLocked = !isPreview && (!hasActiveSub || !tierOk);
  if (isLocked) {
    const planLabel = (workout.required_plan as string)?.toUpperCase?.() ?? "";
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/fitness"
          className="inline-flex items-center gap-2 text-gray-2 hover:text-white transition-colors text-sm mb-6"
        >
          <ArrowLeft size={16} />
          Voltar para treinos
        </Link>
        <div className="relative rounded-[22px] overflow-hidden border border-gray-4">
          <div
            className="h-[200px] bg-bg-2 bg-cover bg-center"
            style={{
              backgroundImage: `url(https://img.youtube.com/vi/${workout.youtube_id}/hqdefault.jpg)`,
            }}
          >
            <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-bg-1/90 border border-yellow/40 rounded-full p-4 shadow-pink">
                <Lock size={28} className="stroke-yellow" />
              </div>
            </div>
          </div>
          <div className="p-6 text-center bg-bg-1">
            <h1 className="font-display text-2xl lg:text-3xl text-white mb-2">
              {workout.title?.toUpperCase?.() ?? "TREINO"}
            </h1>
            <p className="text-gray-2 text-sm mb-1">
              Este treino faz parte do plano{" "}
              <span className="text-pink font-semibold">{planLabel}</span>.
            </p>
            <p className="text-gray-3 text-[13px] mb-6">
              {hasActiveSub
                ? "Faça upgrade do seu plano para desbloquear este conteúdo."
                : "Ative seu plano para assistir aos treinos da Kath."}
            </p>
            <Link
              href="/planos"
              className="inline-flex items-center gap-2 px-6 py-3 bg-pink hover:bg-pink/90 text-white rounded-full font-semibold text-sm transition-colors"
            >
              <Crown size={16} />
              Ver planos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Like status do user (admin client, sem RLS — filtro explicito)
  const { data: likeRow } = await admin
    .from("workout_likes" as never)
    .select("user_id")
    .eq("user_id" as never, userId!)
    .eq("workout_id" as never, workout.id)
    .maybeSingle();
  const initialLiked = !!likeRow;
  const initialLikes = (workout as { likes_count?: number }).likes_count ?? 0;
  const canChat = hasPlanAccess(userTier, "saude_completa");

  const allowedTiers = tiersUpTo(userLevel);

  let relatedQuery = admin
    .from("workout_videos")
    .select("id, title, youtube_id, duration_minutes, category")
    .eq("is_published", true)
    .eq("category", workout.category)
    .neq("id", workout.id);
  if (hasActiveSub) {
    // Pago: mostra todos os videos do tier que ele tem acesso.
    relatedQuery = relatedQuery.in("required_plan", allowedTiers);
  } else {
    // Free: mostra so outros previews (manter consistencia com o gate).
    relatedQuery = relatedQuery.eq("is_free_preview" as never, true);
  }
  const { data: relatedWorkouts } = await relatedQuery
    .order("published_at", { ascending: false })
    .limit(3);

  // Feed de navegação (swipe estilo stories): vídeos publicados da MESMA
  // categoria que o user PODE ver, em ordem alfabética. Arrastar pro lado
  // (ou as setas) navega entre eles sem cair num bloqueado.
  const { data: sameCatRaw } = await admin
    .from("workout_videos")
    .select("id, title, required_plan, is_free_preview")
    .eq("is_published", true)
    .eq("category", workout.category)
    .order("title", { ascending: true });
  const navList = (sameCatRaw ?? []).filter(
    (v) =>
      (v as { is_free_preview?: boolean }).is_free_preview === true ||
      (hasActiveSub && planLevel(v.required_plan as PlanTier) <= userLevel),
  );
  const curNavIdx = navList.findIndex((v) => v.id === workout.id);
  const prevVideoId = curNavIdx > 0 ? navList[curNavIdx - 1].id : null;
  const nextVideoId =
    curNavIdx >= 0 && curNavIdx < navList.length - 1
      ? navList[curNavIdx + 1].id
      : null;

  // Verificar se já completou hoje (depende de RLS no workout_logs; em dev sem A1
  // pode voltar vazio e alreadyCompleted sera false — UX degradada, sem risco).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayLog } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("user_id", userId!)
    .eq("workout_id", workout.id)
    .gte("completed_at", today.toISOString())
    .limit(1)
    .single();

  const alreadyCompleted = !!todayLog;
  const equipment = (workout.equipment as string[]) || [];
  const isShort = workout.is_short || false;

  // JSON-LD VideoObject — Google video rich result (com thumbnail, descricao, autor).
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: workout.title,
    description:
      workout.description ?? `Treino de ${workout.category} com Kath Guedes no KathApp.`,
    thumbnailUrl: [
      `https://img.youtube.com/vi/${workout.youtube_id}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${workout.youtube_id}/hqdefault.jpg`,
    ],
    uploadDate:
      (workout as { published_at?: string | null }).published_at ??
      new Date().toISOString(),
    duration: `PT${workout.duration_minutes}M`,
    contentUrl: `https://www.youtube.com/watch?v=${workout.youtube_id}`,
    embedUrl: `https://www.youtube.com/embed/${workout.youtube_id}`,
    publisher: {
      "@type": "Organization",
      name: "KathApp",
      logo: {
        "@type": "ImageObject",
        url: "https://www.kathguedes.com.br/icons/icon-512.png",
        width: 512,
        height: 512,
      },
    },
    author: { "@type": "Person", name: "Kath Guedes" },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "https://schema.org/WatchAction" },
      userInteractionCount: (workout as { views_count?: number }).views_count ?? 0,
    },
  };

  return (
    <div
      className="immersive-page max-w-4xl mx-auto lg:px-4 lg:py-6 space-y-0 lg:space-y-6"
      data-immersive="1"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, "\u003c") }}
      />
      {/* Back — só no desktop (mobile usa botão flutuante do player) */}
      <Link
        href="/fitness"
        className="hidden lg:inline-flex items-center gap-2 text-gray-2 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Voltar para treinos
      </Link>

      {/* Player imersivo (fullscreen mobile, container desktop) */}
      <ImmersivePlayer
        workoutId={workout.id}
        workoutTitle={workout.title}
        youtubeId={workout.youtube_id}
        isShort={isShort}
        initialLiked={initialLiked}
        initialLikes={initialLikes}
        canChat={canChat}
        alreadyCompleted={alreadyCompleted}
        prevVideoId={prevVideoId}
        nextVideoId={nextVideoId}
      />

      {/* Title + descricao — abaixo do player para SEO + leitura calma */}
      <div className="hidden lg:block">
        <h1 className="font-display text-3xl lg:text-4xl leading-none text-white">
          {workout.title.toUpperCase()}
        </h1>
        {workout.description && (
          <p className="text-gray-2 text-[14px] mt-2 leading-relaxed">
            {workout.description}
          </p>
        )}
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="pink">
          {categoryLabels[workout.category] || workout.category}
        </Badge>
        <Badge variant="white">
          <Target size={12} />
          {levelLabels[workout.level] || workout.level}
        </Badge>
        <Badge variant="white">
          <Clock size={12} />
          {workout.duration_minutes} min
        </Badge>
        <Badge variant="dark">
          <BarChart2 size={12} />
          {workout.views_count} views
        </Badge>
      </div>

      {/* Equipamentos */}
      {equipment.length > 0 && (
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell size={16} className="stroke-pink" />
            <span className="font-mono text-[11px] text-gray-2 tracking-[0.1em] uppercase">
              Equipamentos
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq, i) => (
              <Badge key={i} variant="dark">{eq}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notas da Kath */}
      {workout.notes && (
        <div className="bg-bg-1 border border-pink/20 rounded-[14px] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={16} className="stroke-pink" />
            <span className="font-mono text-[11px] text-pink tracking-[0.1em] uppercase">
              Dica da Kath
            </span>
          </div>
          <p className="text-gray-1 text-[14px] leading-relaxed">
            {workout.notes}
          </p>
        </div>
      )}

      {/* Dicas de execução (coach_tips — transcritas do vídeo ou manuais) */}
      {(() => {
        const tips = (workout as { coach_tips?: string | null }).coach_tips;
        if (!tips || !tips.trim()) return null;
        const items = tips
          .split("\n")
          .map((l) => l.replace(/^[•\-•]\s*/, "").trim())
          .filter(Boolean);
        return (
          <div className="bg-bg-1 border border-pink/20 rounded-[14px] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="stroke-pink" />
              <span className="font-mono text-[11px] text-pink tracking-[0.1em] uppercase">
                Dicas de execução
              </span>
            </div>
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-1 text-[14px] leading-relaxed">
                  <span className="text-pink mt-0.5 shrink-0">•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Próximos treinos */}
      {relatedWorkouts && relatedWorkouts.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-white mb-3">
            VÍDEOS RELACIONADOS
          </h2>
          <div className="space-y-2">
            {relatedWorkouts.map((w) => (
              <Link
                key={w.id}
                href={`/fitness/${w.id}`}
                className="flex items-center gap-4 bg-bg-1 border border-gray-4 rounded-[14px] p-4 hover:border-pink/40 hover:translate-x-1 transition-all duration-200 group"
              >
                <div
                  className="w-16 h-16 rounded-[8px] bg-bg-2 bg-cover bg-center shrink-0 border border-gray-4"
                  style={{
                    backgroundImage: `url(https://img.youtube.com/vi/${w.youtube_id}/mqdefault.jpg)`,
                  }}
                />
                <div className="flex-1">
                  <div className="text-white text-[14px] font-bold group-hover:text-pink transition-colors">
                    {w.title}
                  </div>
                  <div className="font-mono text-[11px] text-gray-3 flex gap-3 mt-1">
                    <span>{w.duration_minutes} min</span>
                    <span>{categoryLabels[w.category] || w.category}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
