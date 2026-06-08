"use client";

import { useState } from "react";
import { ArrowLeft, Heart, Volume2, MessageCircle, Share2, Check, Timer, Play } from "lucide-react";

/**
 * Prévia do player do app na landing. A "casca" do app (voltar, título, FABs,
 * Completar) fica SEMPRE visível — inclusive durante a reprodução — pra parecer
 * o app o tempo todo. Padrão facade: o iframe só carrega ao clicar no play, e
 * aí toca com som (gesto do usuário libera áudio), em loop, sem controles do YT.
 *
 * Troque YOUTUBE_VIDEO_ID pelo id do seu vídeo não listado.
 */
const YOUTUBE_VIDEO_ID = "7zjJ6VS6hUM";

export function AppVideoPreview() {
  const [playing, setPlaying] = useState(false);

  const embed =
    `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}` +
    `?autoplay=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}` +
    `&controls=0&modestbranding=1&playsinline=1&rel=0&fs=0&disablekb=1&iv_load_policy=3`;
  const poster = `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`;
  const posterFallback = `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`;

  return (
    <div className="mx-auto lg:mx-0 lg:ml-auto w-[280px] lg:w-[300px]">
      <div className="relative aspect-[9/19] rounded-[24px] overflow-hidden border border-gray-4 group-hover:border-pink/30 transition-colors duration-500 bg-black shadow-[0_20px_60px_rgba(255,0,128,0.18)]">
        {/* Camada de vídeo */}
        {playing ? (
          <iframe
            src={embed}
            title="Prévia de treino em vídeo HD — KathApp"
            allow="autoplay; encrypted-media; picture-in-picture"
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt="Prévia de treino em vídeo HD com a Kath Guedes"
              loading="lazy"
              onError={(e) => {
                if (e.currentTarget.src !== posterFallback) e.currentTarget.src = posterFallback;
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
          </>
        )}

        {/* ── Casca do app (sempre visível, decorativa) ── */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold rounded-full px-2.5 py-1.5 border border-white/10">
            <ArrowLeft size={13} /> Voltar
          </span>
          <span className="bg-black/40 backdrop-blur-md text-white/90 text-[9px] font-mono uppercase tracking-wider rounded-full px-2.5 py-1 border border-white/10">
            Treino em Vídeo HD
          </span>
        </div>

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 pointer-events-none">
          {[Heart, Volume2, MessageCircle, Share2].map((Icon, i) => (
            <span key={i} className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white">
              <Icon size={16} strokeWidth={1.8} />
            </span>
          ))}
        </div>

        <div className="absolute left-2 right-2 bottom-2 flex items-center justify-center gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1.5 text-white text-[11px] font-mono font-semibold">
            <Timer size={12} /> 60s
          </span>
          <span className="inline-flex items-center gap-1.5 bg-pink text-white text-[12px] font-semibold px-4 py-2 rounded-full shadow-pink">
            <Check size={14} /> Completar
          </span>
        </div>

        {/* Botão de play — só antes de iniciar; cobre o frame e dispara a reprodução */}
        {!playing && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Assistir prévia do treino"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="relative flex items-center justify-center">
              <span className="absolute w-20 h-20 rounded-full bg-pink/40 animate-ping" />
              <span className="relative w-16 h-16 rounded-full bg-pink flex items-center justify-center shadow-[0_0_40px_rgba(255,0,128,0.6)] transition-transform duration-300 hover:scale-110">
                <Play size={26} className="text-white fill-white ml-1" />
              </span>
            </span>
          </button>
        )}
      </div>

      <p className="text-center text-[12px] text-gray-3 mt-3">
        {playing ? "Treino em vídeo HD, igual no app" : "Toque para ver um treino de verdade"}
      </p>
    </div>
  );
}
