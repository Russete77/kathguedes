"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  X,
  Dumbbell,
  Repeat,
  Timer,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  youtube_id?: string;
}

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
}

/**
 * Card de exercício da consultoria.
 * - Com youtube_id: mostra thumbnail → clique abre player embed (shorts ou normal)
 * - Sem youtube_id: mostra placeholder com ícone
 */
export function ExerciseCard({ exercise: ex, index }: ExerciseCardProps) {
  const [showVideo, setShowVideo] = useState(false);

  const hasVideo = !!ex.youtube_id;

  // Detectar se é Shorts pelo ID (shorts geralmente são verticais)
  // Na prática, o admin pode prefixar com "short:" para forçar
  const isShort = ex.youtube_id?.startsWith("short:") ?? false;
  const videoId = isShort ? ex.youtube_id!.replace("short:", "") : ex.youtube_id;

  const thumbUrl = hasVideo
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden transition-all duration-200 hover:border-pink/40 hover:-translate-y-0.5 group">
      {/* Video / Thumbnail area */}
      {showVideo && hasVideo ? (
        /* ── Embed Player ── */
        <div className="relative">
          <div
            className={cn(
              "relative bg-black rounded-t-[22px] overflow-hidden",
              isShort ? "aspect-[9/16] max-w-[280px] mx-auto" : "aspect-video w-full"
            )}
          >
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`}
              title={ex.name ?? "Exercício"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
          {/* Close button */}
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-black rounded-full flex items-center justify-center z-10 transition-colors"
          >
            <X size={14} className="stroke-white" />
          </button>
        </div>
      ) : (
        /* ── Thumbnail / Placeholder ── */
        <div
          className={cn(
            "relative overflow-hidden cursor-pointer",
            hasVideo ? "h-[160px]" : "h-[100px]"
          )}
          onClick={() => hasVideo && setShowVideo(true)}
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
              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-pink/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play size={20} className="fill-white stroke-white ml-0.5" />
                </div>
              </div>
              {/* Shorts badge */}
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
          {/* Exercise number */}
          <div className="absolute top-3 left-3">
            <div className="w-7 h-7 bg-pink rounded-full flex items-center justify-center shadow-sm">
              <span className="font-mono text-[11px] text-white font-bold">
                {index + 1}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4 space-y-2.5">
        <h4 className="font-display text-[16px] leading-tight text-white group-hover:text-pink transition-colors line-clamp-2">
          {(ex.name ?? "Exercício").toUpperCase()}
        </h4>

        {ex.notes && (
          <div className="flex items-start gap-1.5">
            <Info size={10} className="stroke-pink mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-3 leading-relaxed line-clamp-2">
              {ex.notes}
            </p>
          </div>
        )}

        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-bg-2 border border-gray-4 rounded-full px-2.5 py-1">
            <Repeat size={10} className="stroke-pink" />
            <span className="font-mono text-[11px] text-white font-bold">
              {ex.sets ?? 0}
            </span>
            <span className="font-mono text-[10px] text-gray-3">x</span>
            <span className="font-mono text-[11px] text-white font-bold">
              {ex.reps ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-bg-2 border border-gray-4 rounded-full px-2.5 py-1">
            <Timer size={10} className="stroke-gray-3" />
            <span className="font-mono text-[11px] text-gray-2">
              {ex.rest ?? "—"}
            </span>
          </div>
        </div>

        {/* Watch on YouTube link */}
        {hasVideo && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-pink hover:text-pink/80 transition-colors"
          >
            <Play size={10} className="fill-pink stroke-pink" />
            Abrir no YouTube
          </a>
        )}
      </div>
    </div>
  );
}
