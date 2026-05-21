"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Droplets, PlayCircle, Plus, X, Lock, Loader2 } from "lucide-react";
import { saveWellnessPrefs, type WellnessPrefsInput } from "./actions";

interface Props {
  initial: WellnessPrefsInput;
  isPaid: boolean;
  planTier: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function WellnessForm({ initial, isPaid, planTier }: Props) {
  const [pending, startTransition] = useTransition();
  const [dailyEnabled, setDailyEnabled] = useState(initial.daily_video_enabled);
  const [dailyTime, setDailyTime] = useState(initial.daily_video_time);
  const [hydrationEnabled, setHydrationEnabled] = useState(initial.hydration_enabled);
  const [hydrationTimes, setHydrationTimes] = useState<string[]>(initial.hydration_times);

  function addHydrationTime() {
    if (hydrationTimes.length >= 8) {
      toast.error("Máximo 8 lembretes por dia");
      return;
    }
    setHydrationTimes([...hydrationTimes, "12:00"]);
  }

  function updateHydrationTime(idx: number, value: string) {
    setHydrationTimes(hydrationTimes.map((t, i) => (i === idx ? value : t)));
  }

  function removeHydrationTime(idx: number) {
    setHydrationTimes(hydrationTimes.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validação client antes do roundtrip
    if (!TIME_REGEX.test(dailyTime)) {
      toast.error("Horário do vídeo inválido");
      return;
    }
    if (hydrationEnabled) {
      for (const t of hydrationTimes) {
        if (!TIME_REGEX.test(t)) {
          toast.error(`Horário inválido: ${t}`);
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        await saveWellnessPrefs({
          daily_video_enabled: dailyEnabled,
          daily_video_time: dailyTime,
          hydration_enabled: hydrationEnabled,
          hydration_times: hydrationTimes,
        });
        toast.success("Preferências salvas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Vídeo motivacional — todos os planos */}
      <section className="bg-bg-1 border border-gray-4 rounded-[18px] p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-pink/15 flex items-center justify-center">
            <PlayCircle size={18} className="stroke-pink" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base lg:text-lg text-white">
                VÍDEO MOTIVACIONAL DIÁRIO
              </h2>
              <Toggle
                checked={dailyEnabled}
                onChange={setDailyEnabled}
                ariaLabel="Ativar vídeo diário"
              />
            </div>
            <p className="text-gray-2 text-[13px] mt-1 leading-snug">
              1 vídeo curto da Kath por dia para começar bem. Disponível em
              todos os planos.
            </p>
          </div>
        </div>

        {dailyEnabled && (
          <div className="pl-13 sm:pl-13">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gray-3">
                Horário diário
              </span>
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                className="mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2 outline-none focus:border-pink"
              />
            </label>
          </div>
        )}
      </section>

      {/* Hidratação — planos pagos */}
      <section className={`bg-bg-1 border rounded-[18px] p-4 sm:p-5 space-y-4 ${isPaid ? "border-gray-4" : "border-yellow/30"}`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-pink/15 flex items-center justify-center">
            <Droplets size={18} className="stroke-pink" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base lg:text-lg text-white flex items-center gap-2">
                LEMBRETES DE HIDRATAÇÃO
                {!isPaid && <Lock size={14} className="stroke-yellow" />}
              </h2>
              {isPaid ? (
                <Toggle
                  checked={hydrationEnabled}
                  onChange={setHydrationEnabled}
                  ariaLabel="Ativar hidratação"
                />
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-yellow font-semibold border border-yellow/40 rounded-full px-2 py-0.5">
                  Plano pago
                </span>
              )}
            </div>
            <p className="text-gray-2 text-[13px] mt-1 leading-snug">
              {isPaid
                ? "Push em vários horários para você não esquecer de beber água."
                : `Disponível para planos Acesso e acima. Seu plano atual: ${planTier}.`}
            </p>
            {!isPaid && (
              <Link
                href="/planos"
                className="inline-flex items-center gap-1 mt-2 text-pink text-[12px] font-semibold hover:text-pink-light"
              >
                Conhecer planos →
              </Link>
            )}
          </div>
        </div>

        {isPaid && hydrationEnabled && (
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-3 block">
              Horários ({hydrationTimes.length}/8)
            </span>
            <div className="flex flex-wrap gap-2">
              {hydrationTimes.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 bg-bg-2 border border-gray-4 rounded-[10px] pl-1.5 pr-1 py-1"
                >
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => updateHydrationTime(idx, e.target.value)}
                    className="bg-transparent text-white text-sm px-2 py-0.5 outline-none w-[88px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeHydrationTime(idx)}
                    aria-label="Remover"
                    className="text-gray-3 hover:text-danger p-1 rounded-md hover:bg-bg-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {hydrationTimes.length < 8 && (
                <button
                  type="button"
                  onClick={addHydrationTime}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-bg-2 border border-dashed border-gray-4 rounded-[10px] text-gray-2 hover:border-pink hover:text-pink text-sm"
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar preferências"
        )}
      </Button>
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-12 h-7 rounded-full transition-colors ${
        checked ? "bg-pink" : "bg-bg-2 border border-gray-4"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
