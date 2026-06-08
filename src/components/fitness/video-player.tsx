"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  youtube_id: string;
  title: string;
  is_short?: boolean;
}

/**
 * Player adaptável — detecta Shorts (9:16) vs Normal (16:9).
 * Admin marca se é short ou o sistema detecta automaticamente.
 */
export function VideoPlayer({ youtube_id, title, is_short = false }: VideoPlayerProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={cn(
        "rounded-[22px] overflow-hidden bg-bg-1 border border-gray-4 flex items-center justify-center",
        is_short ? "aspect-[9/16] max-w-[360px] mx-auto" : "aspect-video w-full"
      )}>
        <div className="text-center p-6">
          <p className="text-gray-2 text-sm">Erro ao carregar o vídeo</p>
          <a
            href={`https://youtube.com/watch?v=${youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink text-sm mt-2 inline-block hover:underline"
          >
            Abrir no YouTube
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-[22px] overflow-hidden bg-bg-1 border border-gray-4",
        is_short ? "aspect-[9/16] max-w-[360px] mx-auto" : "aspect-video w-full"
      )}
    >
      <iframe
        src={`https://www.youtube.com/embed/${youtube_id}?rel=0&modestbranding=1&playsinline=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        onError={() => setError(true)}
      />
    </div>
  );
}
