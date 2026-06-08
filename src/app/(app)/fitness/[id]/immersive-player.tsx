"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Check,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Timer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toggleWorkoutLike, sendWorkoutQuestion } from "./actions";

const REST_PRESETS = [30, 45, 60, 90, 120];

interface Props {
  workoutId: string;
  workoutTitle: string;
  youtubeId: string;
  isShort: boolean;
  initialLiked: boolean;
  initialLikes: number;
  canChat: boolean;
  alreadyCompleted: boolean;
  // Navegação por swipe (mesma categoria, em ordem). null = ponta da lista.
  prevVideoId?: string | null;
  nextVideoId?: string | null;
}

/**
 * Player imersivo estilo Stories — vídeo ocupando viewport,
 * FABs flutuantes na direita (like, share, dúvida no chat).
 *
 * Comportamento por viewport:
 *  - Mobile (< lg): vídeo full-screen 9:16 (ou 16:9 letterboxado pra normais),
 *    bottom-tab-bar e header da app some via CSS (data-attribute na page).
 *  - Desktop: vídeo dentro de um container 9:16 centralizado, max 420px,
 *    com o resto da app ao redor.
 */
export function ImmersivePlayer({
  workoutId,
  workoutTitle,
  youtubeId,
  isShort,
  initialLiked,
  initialLikes,
  canChat,
  alreadyCompleted,
  prevVideoId,
  nextVideoId,
}: Props) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [busyLike, setBusyLike] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(alreadyCompleted);
  const [, startTransition] = useTransition();

  // YouTube IFrame Player API via postMessage — controla volume nativamente.
  // Fullscreen do YouTube fica desligado (allowFullScreen=false): o proprio player
  // imersivo ja ocupa a viewport inteira no mobile, dispensando o fullscreen extra.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [muted, setMuted] = useState(false);

  // Origin para postMessage: so disponivel client-side. Evita hydration mismatch
  // setando depois do mount via state.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function ytPost(func: string, args: unknown[] = []) {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    ytPost(next ? "mute" : "unMute");
    if (!next) ytPost("setVolume", [100]);
  }

  // Swipe (estilo stories): arrastar esquerda = próximo, direita = anterior —
  // navega entre os vídeos da MESMA categoria, em ordem.
  function goToVideo(id: string | null | undefined) {
    if (id) router.push(`/fitness/${id}`);
  }
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goToVideo(nextVideoId);
    else goToVideo(prevVideoId);
  }

  // Rest timer compacto (inline ao lado do completar — UX mobile-first)
  const [restSec, setRestSec] = useState(60);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const restIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!restRunning) return;
    restIntervalRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          if (restIntervalRef.current) clearInterval(restIntervalRef.current);
          setRestRunning(false);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [restRunning]);

  function toggleRestTimer() {
    if (restRunning) {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      setRestRunning(false);
      setRestRemaining(0);
    } else {
      setRestRemaining(restSec);
      setRestRunning(true);
    }
  }

  function formatTimer(s: number) {
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return `${m}:${rest.toString().padStart(2, "0")}`;
  }

  async function handleLike() {
    if (busyLike) return;
    const previous = liked;
    setLiked(!previous);
    setLikes((c) => c + (previous ? -1 : 1));
    setBusyLike(true);
    try {
      const r = await toggleWorkoutLike(workoutId);
      setLiked(r.liked);
      setLikes(r.likes_count);
    } catch (e) {
      // rollback
      setLiked(previous);
      setLikes((c) => c + (previous ? 1 : -1));
      toast.error(e instanceof Error ? e.message : "Erro ao curtir");
    } finally {
      setBusyLike(false);
    }
  }

  async function handleSendQuestion() {
    if (!questionText.trim() || sending) return;
    setSending(true);
    try {
      await sendWorkoutQuestion({
        workout_id: workoutId,
        workout_title: workoutTitle,
        body: questionText.trim(),
      });
      toast.success("Pergunta enviada! A Kath responde no chat.");
      setQuestionText("");
      setQuestionOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: workoutTitle, url });
      } catch {
        // user cancelou — sem toast
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      } catch {
        toast.error("Nao foi possivel copiar o link");
      }
    }
  }

  async function handleComplete() {
    if (completed) return;
    setCompleted(true);
    try {
      const res = await fetch("/api/workout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao concluir");
      toast.success("Treino concluido!", {
        description: data.streak ? `Streak: ${data.streak} dia(s)` : undefined,
      });
      startTransition(() => {});
    } catch (e) {
      setCompleted(false);
      toast.error(e instanceof Error ? e.message : "Erro ao concluir");
    }
  }

  return (
    <div className="immersive-player-root fixed inset-0 z-40 lg:relative lg:inset-auto lg:z-auto bg-black lg:bg-transparent lg:rounded-[22px] lg:overflow-hidden">
      {/* Vídeo fundo — 9:16 fullscreen no mobile, container no desktop */}
      <div
        className={`relative w-full h-full lg:rounded-[22px] lg:overflow-hidden lg:mx-auto lg:bg-black ${
          isShort
            ? "lg:aspect-[9/16] lg:max-w-[420px] lg:h-auto"
            : "lg:aspect-video lg:max-w-3xl lg:h-auto"
        }`}
      >
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&enablejsapi=1${origin ? `&origin=${origin}` : ""}`}
          title={workoutTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="absolute inset-0 w-full h-full"
        />

        {/* Gesto de swipe só nas BORDAS (mantém o centro livre pro botão de
            play e os controles do YouTube). Arrastar troca o vídeo (mesma categoria). */}
        <div
          className="absolute inset-y-0 left-0 w-1/5"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/5"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />

        {/* Setas anterior/próximo (desktop / clique) */}
        {prevVideoId && (
          <button
            type="button"
            onClick={() => goToVideo(prevVideoId)}
            aria-label="Vídeo anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full p-2 hover:bg-black/60 transition-all"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {nextVideoId && (
          <button
            type="button"
            onClick={() => goToVideo(nextVideoId)}
            aria-label="Próximo vídeo"
            className="absolute right-2 bottom-24 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full p-2 hover:bg-black/60 transition-all"
          >
            <ChevronRight size={22} />
          </button>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Topo: voltar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <Link
            href="/fitness"
            className="pointer-events-auto inline-flex items-center gap-2 bg-black/40 backdrop-blur-md text-white text-[13px] font-semibold rounded-full px-3 py-2 border border-white/10 hover:bg-black/60 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <div className="pointer-events-auto bg-black/40 backdrop-blur-md text-white/90 text-[11px] font-mono uppercase tracking-wider rounded-full px-3 py-1.5 border border-white/10 max-w-[60%] truncate">
            {workoutTitle}
          </div>
        </div>

        {/* FABs direita — like, share, chat */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-none">
          <button
            type="button"
            onClick={handleLike}
            disabled={busyLike}
            aria-label={liked ? "Descurtir" : "Curtir"}
            className={`pointer-events-auto group flex flex-col items-center gap-1 rounded-full p-3 backdrop-blur-md border transition-all ${
              liked
                ? "bg-pink/90 border-pink text-white shadow-pink"
                : "bg-black/40 border-white/10 text-white hover:bg-black/60"
            } disabled:opacity-60`}
          >
            <Heart
              size={22}
              className={liked ? "fill-white" : ""}
              strokeWidth={liked ? 2.2 : 1.8}
            />
            <span className="text-[10px] font-mono font-semibold">{likes}</span>
          </button>

          {/* Volume / Mute — usa YouTube IFrame API via postMessage */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Ativar som" : "Mutar"}
            className="pointer-events-auto group flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full p-3 hover:bg-black/60 transition-all"
          >
            {muted ? (
              <VolumeX size={22} strokeWidth={1.8} />
            ) : (
              <Volume2 size={22} strokeWidth={1.8} />
            )}
          </button>

          {canChat ? (
            <button
              type="button"
              onClick={() => setQuestionOpen(true)}
              aria-label="Tirar duvida com a Kath"
              className="pointer-events-auto group flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full p-3 hover:bg-black/60 transition-all"
            >
              <MessageCircle size={22} strokeWidth={1.8} />
              <span className="text-[10px] font-mono font-semibold">Duvida</span>
            </button>
          ) : (
            <Link
              href="/planos?autostart=saude_completa"
              aria-label="Faca upgrade para tirar duvida"
              className="pointer-events-auto group flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 text-white/70 rounded-full p-3 hover:bg-black/60 transition-all"
            >
              <MessageCircle size={22} strokeWidth={1.5} />
              <span className="text-[10px] font-mono font-semibold">VIP</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartilhar"
            className="pointer-events-auto group flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full p-3 hover:bg-black/60 transition-all"
          >
            <Share2 size={22} strokeWidth={1.8} />
          </button>
        </div>

        {/* Barra inferior — cronometro de descanso + completar treino */}
        <div className="absolute left-2 right-2 bottom-2 flex items-center justify-center gap-2 pointer-events-none">
          {/* Cronometro inline — pill compacto. Quando rodando mostra contagem regressiva. */}
          <div className="pointer-events-auto flex items-center bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-2 py-1">
            <button
              type="button"
              onClick={toggleRestTimer}
              aria-label={restRunning ? "Parar cronometro" : "Iniciar descanso"}
              className={`flex items-center gap-1.5 text-white text-xs font-mono font-semibold px-2 py-1.5 rounded-full transition-colors ${
                restRunning ? "bg-pink text-white" : "hover:bg-white/10"
              }`}
            >
              <Timer size={14} strokeWidth={2} />
              <span>
                {restRunning
                  ? formatTimer(restRemaining)
                  : `${restSec}s`}
              </span>
            </button>
            {/* Seletor preset — so visivel quando parado */}
            {!restRunning && (
              <div className="hidden sm:flex items-center gap-0.5 ml-1 mr-1">
                {REST_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRestSec(p)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                      restSec === p
                        ? "bg-white/15 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {p}s
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleComplete}
            disabled={completed}
            className={`pointer-events-auto inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-5 py-2.5 rounded-full shadow-pink transition-all ${
              completed
                ? "bg-green-600/80 text-white border border-green-500"
                : "bg-pink text-white hover:bg-pink-light"
            }`}
          >
            <Check size={16} />
            <span className="whitespace-nowrap">
              {completed ? "Concluido" : "Completar"}
            </span>
          </button>
        </div>
      </div>

      {/* Modal de pergunta */}
      {questionOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !sending && setQuestionOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-bg-1 border border-gray-4 sm:rounded-[22px] rounded-t-[22px] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-white">
                Duvida pra Kath
              </h3>
              <button
                type="button"
                onClick={() => !sending && setQuestionOpen(false)}
                className="text-gray-3 hover:text-white"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-gray-2 text-sm">
              Pergunta sobre <span className="text-pink">{workoutTitle}</span>.
              Resposta vai no chat VIP em ate 48h.
            </p>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Qual sua duvida sobre execucao, carga, frequencia?"
              className="w-full bg-bg-2 border border-gray-4 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-pink"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuestionOpen(false)}
                disabled={sending}
                className="px-4 py-2 text-gray-2 hover:text-white text-sm font-semibold rounded-md disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendQuestion}
                disabled={sending || !questionText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-pink text-white text-sm font-semibold rounded-full disabled:opacity-50"
              >
                {sending && <Loader2 size={14} className="animate-spin" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
