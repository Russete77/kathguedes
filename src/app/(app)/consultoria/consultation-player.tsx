"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Timer,
  Check,
  Repeat,
} from "lucide-react";

const REST_PRESETS = [30, 45, 60, 90, 120];

export interface PlayerExercise {
  name: string;
  youtube_id: string;
  sets: number;
  reps: string;
  rest: string;
  /** Dia a que o exercício pertence (ex.: "Segunda — Glúteo"). */
  dayName?: string;
  /** Chave do dia no plano ("w<semana>d<dia>") — usada pra marcar conclusão. */
  dayKey?: string;
}

/**
 * Player imersivo da consultoria — mesmo formato do player da biblioteca
 * (/fitness/[id]), mas percorrendo os exercícios do DIA em sequência, com
 * anterior/próximo e cronômetro de descanso. Tela cheia (overlay fixo).
 */
export function ConsultationPlayer({
  exercises,
  startIndex,
  completedKeys,
  onConcludeDay,
  onClose,
}: {
  exercises: PlayerExercise[];
  startIndex: number;
  completedKeys?: string[];
  onConcludeDay?: (dayKey: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [muted, setMuted] = useState(false);
  const [busyConclude, setBusyConclude] = useState(false);
  const [origin, setOrigin] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const current = exercises[index];
  const isShort = current?.youtube_id?.startsWith("short:") ?? false;
  const videoId = current?.youtube_id?.replace("short:", "") ?? "";
  const hasPrev = index > 0;
  const hasNext = index < exercises.length - 1;
  const currentDayKey = current?.dayKey;
  const dayDone =
    !!currentDayKey && (completedKeys ?? []).includes(currentDayKey);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Fecha com ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < exercises.length - 1) setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, exercises.length, onClose]);

  function ytPost(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(
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

  // Swipe (estilo stories): arrastar pra esquerda = próximo, direita = anterior.
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < 50) return; // ignora toques curtos
    if (dx < 0 && hasNext) setIndex((i) => i + 1);
    else if (dx > 0 && hasPrev) setIndex((i) => i - 1);
  }

  // Cronômetro de descanso (igual ao player da biblioteca).
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
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  // Conclui o DIA atual (marca ✓ na consultoria) e avança pro primeiro
  // exercício do PRÓXIMO dia da sequência. Se não houver, fecha o player.
  async function handleConcludeDay() {
    if (busyConclude || !currentDayKey) return;
    setBusyConclude(true);
    try {
      await onConcludeDay?.(currentDayKey);
      const nextDayIdx = exercises.findIndex(
        (ex, i) => i > index && ex.dayKey !== currentDayKey,
      );
      if (nextDayIdx >= 0) {
        setIndex(nextDayIdx);
        toast.success("Treino concluído! Próximo dia liberado.", {
          style: { borderLeft: "3px solid #00FF88" },
        });
      } else {
        toast.success("Plano da semana concluído!", {
          style: { borderLeft: "3px solid #00FF88" },
        });
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao concluir");
    } finally {
      setBusyConclude(false);
    }
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div
        className={`relative w-full h-full mx-auto bg-black ${
          isShort ? "lg:max-w-[420px]" : "lg:max-w-3xl"
        }`}
      >
        <iframe
          key={videoId}
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&enablejsapi=1&autoplay=1${origin ? `&origin=${origin}` : ""}`}
          title={current.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="absolute inset-0 w-full h-full"
        />

        {/* Gesto de swipe só nas BORDAS (mantém o centro livre pro botão de
            play e os controles do YouTube). Arrastar pro lado troca o exercício;
            setas/teclado também. */}
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

        {/* Gradients */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        {/* Topo: fechar + contexto */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="pointer-events-auto inline-flex items-center gap-2 bg-black/40 backdrop-blur-md text-white text-[13px] font-semibold rounded-full px-3 py-2 border border-white/10 hover:bg-black/60 transition-colors"
          >
            <X size={16} />
            Fechar
          </button>
          <div className="pointer-events-auto bg-black/40 backdrop-blur-md text-white/90 text-[11px] font-mono uppercase tracking-wider rounded-full px-3 py-1.5 border border-white/10 max-w-[55%] truncate">
            {current.dayName ?? "Treino"} · {index + 1}/{exercises.length}
          </div>
        </div>

        {/* FABs direita — mute */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Ativar som" : "Mutar"}
            className="flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full p-3 hover:bg-black/60 transition-all"
          >
            {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>
        </div>

        {/* Barra inferior */}
        <div className="absolute left-2 right-2 bottom-3 space-y-2">
          {/* Nome + séries */}
          <div className="text-center">
            <div className="text-white font-display text-[20px] leading-tight truncate px-12">
              {current.name?.toUpperCase()}
            </div>
            <div className="inline-flex items-center gap-2 mt-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1">
              <Repeat size={12} className="stroke-pink" />
              <span className="font-mono text-[12px] text-white font-bold">
                {current.sets ?? 0} × {current.reps ?? "—"}
              </span>
              <span className="font-mono text-[11px] text-white/60">· descanso {current.rest ?? "—"}</span>
            </div>
          </div>

          {/* Controles: anterior / cronômetro / próximo */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => hasPrev && setIndex((i) => i - 1)}
              disabled={!hasPrev}
              aria-label="Anterior"
              className="inline-flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/10 text-white rounded-full p-3 hover:bg-black/70 transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={22} />
            </button>

            <div className="flex items-center bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-2 py-1">
              <button
                type="button"
                onClick={toggleRestTimer}
                className={`flex items-center gap-1.5 text-white text-xs font-mono font-semibold px-2 py-1.5 rounded-full transition-colors ${
                  restRunning ? "bg-pink text-white" : "hover:bg-white/10"
                }`}
              >
                <Timer size={14} />
                <span>{restRunning ? formatTimer(restRemaining) : `${restSec}s`}</span>
              </button>
              {!restRunning && (
                <div className="hidden sm:flex items-center gap-0.5 ml-1 mr-1">
                  {REST_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setRestSec(p)}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                        restSec === p ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
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
              onClick={() => hasNext && setIndex((i) => i + 1)}
              disabled={!hasNext}
              aria-label="Próximo"
              className="inline-flex items-center justify-center bg-pink text-white rounded-full p-3 hover:bg-pink-light transition-colors shadow-pink disabled:opacity-30"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Concluir treino — sempre disponível (marca o dia feito / streak) */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleConcludeDay}
              disabled={dayDone || busyConclude}
              className={`inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm px-5 py-2.5 rounded-full shadow-pink transition-all ${
                dayDone
                  ? "bg-green-600/80 text-white border border-green-500"
                  : "bg-pink text-white hover:bg-pink-light"
              }`}
            >
              <Check size={16} />
              {dayDone
                ? "Dia concluído"
                : busyConclude
                  ? "Concluindo…"
                  : "Concluir treino"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
