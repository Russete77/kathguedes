"use client";

import { useState } from "react";

/**
 * Player vertical 9:16 (formato Shorts) com autoplay para motivacionais.
 *
 * Comportamento:
 * - Container max-w fixo (calculado pelo aspect-ratio + viewport vertical) pra
 *   ficar formato celular mesmo em desktop.
 * - autoplay=1 + playsinline=1 (iOS nao vai pra fullscreen).
 * - mute=1 no autoplay porque navegador exige; o usuario clica no proprio
 *   player do YouTube pra ativar audio.
 * - rel=0 + modestbranding=1 minimizam UI do YouTube.
 */
export function MotivacionalPlayer({
  youtubeId,
  title,
  body,
}: {
  youtubeId: string;
  title: string;
  body: string | null;
}) {
  const [muted, setMuted] = useState(true);

  const src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&mute=${muted ? 1 : 0}`;

  return (
    <div className="w-full max-w-[min(100%,calc((100dvh-180px)*9/16))] mx-auto flex flex-col gap-4">
      <div className="relative aspect-[9/16] w-full bg-black rounded-[18px] overflow-hidden border border-gray-4 shadow-pink">
        <iframe
          key={`${youtubeId}-${muted ? "muted" : "audio"}`}
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
        {muted && (
          <button
            type="button"
            onClick={() => setMuted(false)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 bg-pink text-white text-[12px] font-semibold tracking-wide uppercase px-4 py-2 rounded-full shadow-pink hover:bg-pink-light transition-all"
          >
            Tocar com som
          </button>
        )}
      </div>

      <div className="text-center px-2">
        <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight">
          {title.toUpperCase()}
        </h1>
        {body && (
          <p className="text-gray-2 text-[13px] sm:text-sm mt-2 leading-relaxed">
            {body}
          </p>
        )}
      </div>
    </div>
  );
}
