"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight, Play } from "lucide-react";

interface MotivationalVideo {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
}

interface Props {
  videos: MotivationalVideo[];
  startIndex: number;
}

// Tipos mínimos pra YouTube IFrame API (sem instalar @types/youtube)
interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YTPlayerEvent {
  data: number;
}

interface YTConstructor {
  Player: new (
    el: HTMLElement | string,
    config: Record<string, unknown>,
  ) => YTPlayer;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
    BUFFERING: number;
    UNSTARTED: number;
  };
}

declare global {
  interface Window {
    YT?: YTConstructor;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Player estilo Stories Instagram pra vídeos motivacionais.
 *
 * Comportamento:
 * - Tela cheia (fixed inset-0).
 * - Header: avatar Kath + título + barras de progresso (uma por vídeo).
 * - Player YouTube via IFrame API (precisa pra ler currentTime/duration).
 * - Tap esquerda 1/3 → vídeo anterior; tap direita 1/3 → próximo;
 *   tap centro → toggle pause/play.
 * - Tap-hold pra pausar (mobile-friendly).
 * - Auto-advance quando vídeo termina (PlayerState.ENDED).
 * - Quando termina último vídeo → volta pro /dashboard.
 * - Inicia muted (browser bloqueia autoplay com som); botão "Tocar com som"
 *   no header.
 */
export function StoriesPlayer({ videos, startIndex }: Props) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const current = videos[currentIdx];

  // ── Carrega YouTube IFrame API uma vez ──
  useEffect(() => {
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      setApiReady(true);
    };
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIdx((idx) => {
      if (idx < videos.length - 1) return idx + 1;
      // Último vídeo → fecha
      router.push("/dashboard");
      return idx;
    });
  }, [videos.length, router]);

  // ── Cria player quando API ready ──
  useEffect(() => {
    if (!apiReady || !containerRef.current || playerRef.current) return;
    const YT = window.YT;
    if (!YT) return;

    playerRef.current = new YT.Player(containerRef.current, {
      videoId: current.youtube_id,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        controls: 0,
        disablekb: 1,
        mute: 1,
      },
      events: {
        onStateChange: (e: YTPlayerEvent) => {
          const state = e.data;
          if (state === YT.PlayerState.ENDED) {
            goToNext();
          } else if (state === YT.PlayerState.PLAYING) {
            setPaused(false);
          } else if (state === YT.PlayerState.PAUSED) {
            setPaused(true);
          }
        },
      },
    });

    return () => {
      try {
        playerRef.current?.destroy();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  // ── Quando muda currentIdx, troca vídeo no player existente ──
  useEffect(() => {
    if (!playerRef.current?.loadVideoById) return;
    setProgress(0);
    playerRef.current.loadVideoById(current.youtube_id);
    // Mantém estado de mute entre vídeos
    if (muted) playerRef.current.mute();
    else playerRef.current.unMute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  // ── Poll currentTime/duration pra atualizar barra ──
  useEffect(() => {
    if (!apiReady) return;
    pollIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime || !p?.getDuration) return;
      try {
        const dur = p.getDuration();
        const cur = p.getCurrentTime();
        if (dur > 0) {
          setProgress(Math.min(100, (cur / dur) * 100));
        }
      } catch {
        /* noop */
      }
    }, 120);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [apiReady]);

  // ── Handlers ──
  function handlePrev() {
    setCurrentIdx((idx) => Math.max(0, idx - 1));
  }

  function handleNext() {
    goToNext();
  }

  function handleToggleMute() {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  }

  function handleTogglePause() {
    const p = playerRef.current;
    if (!p) return;
    if (paused) p.playVideo();
    else p.pauseVideo();
  }

  function handleClose() {
    router.push("/dashboard");
  }

  // Tap-hold: depois de 250ms começa "segurar pra pausar"
  function handlePointerDown() {
    isHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      playerRef.current?.pauseVideo();
    }, 250);
  }

  function handlePointerUp(action: () => void) {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (isHoldingRef.current) {
        // Era hold — retoma play e não dispara navegação
        isHoldingRef.current = false;
        playerRef.current?.playVideo();
        return;
      }
      action();
    };
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* ── Barras de progresso (topo) ── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-2 pt-2 pb-2 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex gap-1">
          {videos.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white"
                style={{
                  width:
                    i < currentIdx
                      ? "100%"
                      : i > currentIdx
                        ? "0%"
                        : `${progress}%`,
                  transition: i === currentIdx ? "width 120ms linear" : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header com avatar + título + actions */}
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-pink shrink-0 bg-bg-2">
              <Image
                src="/images/kath-avatar.jpg"
                alt="Kath Guedes"
                width={36}
                height={36}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="min-w-0">
              <div className="text-white text-[13px] font-semibold truncate">
                Kath Guedes
              </div>
              <div className="text-white/60 text-[11px] truncate">
                {current.title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleMute}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-black/30 hover:bg-black/60 text-white transition-colors"
              aria-label={muted ? "Ativar som" : "Mudo"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-black/30 hover:bg-black/60 text-white transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Container do YouTube Player ── */}
      {/* Wrapper limita ratio 9:16 e centraliza em telas largas */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="relative w-full h-full max-w-[min(100vw,calc(100dvh*9/16))] aspect-[9/16] overflow-hidden">
          {/* O YT.Player substitui este div quando inicializa */}
          <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          {/* Overlay de "carregando" enquanto API não ready */}
          {!apiReady && (
            <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
              Carregando...
            </div>
          )}
        </div>
      </div>

      {/* ── Tap zones (esquerda/centro/direita) ── */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp(handlePrev)}
        onPointerLeave={() => {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }}
        className="absolute left-0 top-16 bottom-16 w-1/4 z-20 group"
        aria-label="Vídeo anterior"
      >
        {currentIdx > 0 && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={20} />
          </span>
        )}
      </button>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp(handleTogglePause)}
        className="absolute left-1/4 right-1/4 top-16 bottom-16 z-20 group"
        aria-label={paused ? "Retomar" : "Pausar"}
      >
        {paused && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 inline-flex items-center justify-center rounded-full bg-black/50 text-white">
            <Play size={28} />
          </span>
        )}
      </button>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp(handleNext)}
        onPointerLeave={() => {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }}
        className="absolute right-0 top-16 bottom-16 w-1/4 z-20 group"
        aria-label="Próximo vídeo"
      >
        {currentIdx < videos.length - 1 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={20} />
          </span>
        )}
      </button>

      {/* ── Body do vídeo (overlay inferior) ── */}
      {current.body && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
          <p className="text-white text-[14px] leading-relaxed text-center max-w-md mx-auto">
            {current.body}
          </p>
        </div>
      )}

      {/* Indicador de pause invisivel (só pra evitar warning de paused unused) */}
      {paused && <span className="sr-only">Pausado</span>}
    </div>
  );
}
