"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Play, Dumbbell, Repeat, Timer, Info, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { exerciseTechniqueMeta } from "@/constants/techniques";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  youtube_id?: string;
  // ── Técnica + agrupamento (opcionais — vê src/constants/techniques.ts) ──
  technique?: string;
  technique_detail?: string;
  group_id?: string;
  group_type?: string;
  group_role?: string;
}

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  /** Quando true, o card está dentro de um bloco agrupado (bi-set/tri-set). */
  inGroup?: boolean;
  /** Dicas de execução (coach_tips) vindas da biblioteca, via youtube_id. */
  coachTips?: string;
  /** Abre o player imersivo (tela cheia) começando neste exercício. */
  onOpen?: () => void;
}

/**
 * Card de exercício da consultoria — é a ENTRADA para o player imersivo.
 * Mostra thumbnail + metadados; o clique abre o player em tela cheia
 * (ConsultationPlayer), que percorre os exercícios do dia em sequência.
 */
export function ExerciseCard({
  exercise: ex,
  index,
  inGroup,
  coachTips,
  onOpen,
}: ExerciseCardProps) {
  const tipItems = coachTips
    ? coachTips.split("\n").map((l) => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean)
    : [];

  const hasVideo = !!ex.youtube_id;
  const isShort = ex.youtube_id?.startsWith("short:") ?? false;
  const videoId = isShort ? ex.youtube_id!.replace("short:", "") : ex.youtube_id;
  const thumbUrl = hasVideo
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const techMeta = exerciseTechniqueMeta(ex.technique);

  return (
    <div
      className={cn(
        "border overflow-hidden transition-all duration-200 group",
        inGroup
          ? "bg-bg-1 border-gray-4 rounded-[14px]"
          : "bg-bg-1 border-gray-4 rounded-[22px] hover:border-pink/40 hover:-translate-y-0.5",
      )}
    >
      {/* Thumbnail / Placeholder — clique abre o player imersivo */}
      <div
        className={cn(
          "relative overflow-hidden cursor-pointer",
          hasVideo ? "h-[160px]" : "h-[100px]",
        )}
        onClick={() => hasVideo && onOpen?.()}
      >
        {thumbUrl ? (
          <>
            <Image
              src={thumbUrl}
              alt={ex.name ?? "Exercício"}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-pink/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play size={20} className="fill-white stroke-white ml-0.5" />
              </div>
            </div>
            {isShort && (
              <div className="absolute top-3 right-3">
                <Badge variant="solid">SHORT</Badge>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-pink/5 to-bg-2">
            <Dumbbell size={28} className="stroke-gray-3/40" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <div className="w-7 h-7 bg-pink rounded-full flex items-center justify-center shadow-sm">
            <span className="font-mono text-[11px] text-white font-bold">{index + 1}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        {(inGroup || techMeta) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {inGroup && ex.group_role && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] rounded-full bg-pink/15 text-pink border border-pink/30">
                {ex.group_role}
              </span>
            )}
            {techMeta && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] rounded-full border",
                  techMeta.bgClass,
                )}
                title={techMeta.description}
              >
                <Zap size={9} />
                {techMeta.short}
              </span>
            )}
          </div>
        )}

        <h4 className="font-display text-[16px] leading-tight text-white group-hover:text-pink transition-colors line-clamp-2">
          {(ex.name ?? "Exercício").toUpperCase()}
        </h4>

        {techMeta && ex.technique_detail && (
          <p className={cn("text-[11px] leading-relaxed line-clamp-2 font-medium", techMeta.color)}>
            {ex.technique_detail}
          </p>
        )}

        {ex.notes && (
          <div className="flex items-start gap-1.5">
            <Info size={10} className="stroke-pink mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-3 leading-relaxed line-clamp-2">{ex.notes}</p>
          </div>
        )}

        {tipItems.length > 0 && (
          <div className="bg-pink/5 border border-pink/15 rounded-[10px] p-2.5 space-y-1">
            <div className="flex items-center gap-1">
              <Info size={10} className="stroke-pink shrink-0" />
              <span className="font-mono text-[9px] text-pink uppercase tracking-[0.1em]">
                Dicas de execução
              </span>
            </div>
            <ul className="space-y-0.5">
              {tipItems.map((it, i) => (
                <li key={i} className="flex items-start gap-1 text-[11px] text-gray-2 leading-relaxed">
                  <span className="text-pink shrink-0">•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-bg-2 border border-gray-4 rounded-full px-2.5 py-1">
            <Repeat size={10} className="stroke-pink" />
            <span className="font-mono text-[11px] text-white font-bold">{ex.sets ?? 0}</span>
            <span className="font-mono text-[10px] text-gray-3">x</span>
            <span className="font-mono text-[11px] text-white font-bold">{ex.reps ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1 bg-bg-2 border border-gray-4 rounded-full px-2.5 py-1">
            <Timer size={10} className="stroke-gray-3" />
            <span className="font-mono text-[11px] text-gray-2">{ex.rest ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
