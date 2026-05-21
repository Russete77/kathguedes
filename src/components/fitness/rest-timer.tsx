"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [30, 45, 60, 90, 120];

export function RestTimer() {
  const [seconds, setSeconds] = useState(60);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          stop();
          setFinished(true);
          // Vibrar se suportado
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, stop]);

  function start() {
    setRemaining(seconds);
    setFinished(false);
    setRunning(true);
  }

  function toggle() {
    if (running) {
      stop();
    } else if (remaining > 0) {
      setRunning(true);
    } else {
      start();
    }
  }

  function reset() {
    stop();
    setRemaining(0);
    setFinished(false);
  }

  const pct = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Timer size={18} className="stroke-pink" />
        <span className="font-mono text-[11px] text-gray-2 tracking-[0.1em] uppercase">
          Cronômetro de Descanso
        </span>
      </div>

      {/* Timer display */}
      <div className="text-center mb-4">
        <div
          className={cn(
            "font-display text-[64px] leading-none transition-colors",
            finished ? "text-success animate-pulse" : running ? "text-pink" : "text-white"
          )}
        >
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        {finished && (
          <p className="text-success text-[13px] font-semibold mt-2">
            Descanso finalizado — bora!
          </p>
        )}
      </div>

      {/* Progress bar */}
      {(running || remaining > 0) && (
        <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden mb-4">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              finished
                ? "bg-success"
                : "bg-gradient-to-r from-pink to-pink-light"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Preset buttons */}
      {!running && remaining === 0 && (
        <div className="flex justify-center gap-2 mb-4">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setSeconds(preset)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-mono font-medium transition-all border",
                seconds === preset
                  ? "bg-pink-dim text-pink border-pink/25"
                  : "bg-bg-2 text-gray-3 border-gray-4 hover:text-white"
              )}
            >
              {preset}s
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-3">
        <Button
          size="lg"
          variant={running ? "secondary" : "primary"}
          onClick={toggle}
          className="min-w-[140px]"
        >
          {running ? (
            <><Pause size={16} /> Pausar</>
          ) : remaining > 0 ? (
            <><Play size={16} /> Continuar</>
          ) : (
            <><Play size={16} /> Iniciar</>
          )}
        </Button>
        {(running || remaining > 0 || finished) && (
          <Button size="lg" variant="ghost" onClick={reset}>
            <RotateCcw size={16} /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
