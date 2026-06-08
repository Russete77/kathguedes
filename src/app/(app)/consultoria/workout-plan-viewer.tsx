"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Target, Flame, Link2, Check } from "lucide-react";
import { ExerciseCard } from "./exercise-card";
import { ConsultationPlayer, type PlayerExercise } from "./consultation-player";
import { exerciseGroupLabel } from "@/constants/techniques";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  youtube_id?: string;
  technique?: string;
  technique_detail?: string;
  group_id?: string;
  group_type?: string;
  group_role?: string;
}

/**
 * Agrupa exercícios consecutivos com mesmo group_id num único "run".
 * Exercício solto vira run de tamanho 1; bi-set/tri-set viram run de 2/3.
 * Mantém a ordem original do plano.
 */
function buildExerciseRuns(exercises: Exercise[]): Array<{
  groupId: string | null;
  groupType: string | null;
  items: Array<{ exercise: Exercise; originalIndex: number }>;
}> {
  const runs: Array<{
    groupId: string | null;
    groupType: string | null;
    items: Array<{ exercise: Exercise; originalIndex: number }>;
  }> = [];
  exercises.forEach((ex, idx) => {
    const last = runs[runs.length - 1];
    if (ex.group_id && last && last.groupId === ex.group_id) {
      last.items.push({ exercise: ex, originalIndex: idx });
    } else {
      runs.push({
        groupId: ex.group_id ?? null,
        groupType: ex.group_type ?? null,
        items: [{ exercise: ex, originalIndex: idx }],
      });
    }
  });
  return runs;
}

interface TrainingDay {
  name: string;
  exercises: Exercise[];
}

interface PlanWeek {
  name: string;
  intensity?: "leve" | "moderado" | "intenso" | "pico";
  is_peak_week?: boolean;
  notes?: string;
  days: TrainingDay[];
}

interface Props {
  plan: { weeks: PlanWeek[] };
  /** Dicas de execução por youtube_id (sem prefixo "short:"). */
  tipsByYoutubeId?: Record<string, string>;
  /** Dias já concluídos (chaves "w<semana>d<dia>"). */
  completedDays?: string[];
}

/** Resolve as dicas de execução de um exercício pelo seu youtube_id. */
function tipsFor(ex: Exercise, map?: Record<string, string>): string | undefined {
  if (!map || !ex.youtube_id) return undefined;
  return map[ex.youtube_id.replace("short:", "")];
}

const INTENSITY_LABELS: Record<string, { label: string; className: string }> = {
  leve: { label: "Leve", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  moderado: { label: "Moderado", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  intenso: { label: "Intenso", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  pico: { label: "Pico", className: "bg-pink/15 text-pink border-pink/30" },
};

export function WorkoutPlanViewer({ plan, tipsByYoutubeId, completedDays }: Props) {
  const weeks = plan?.weeks ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  // Dia ativo dentro da semana (abas por dia).
  const [activeDay, setActiveDay] = useState(0);
  // Player imersivo aberto: índice inicial na sequência (semana inteira).
  const [player, setPlayer] = useState<{ startIndex: number } | null>(null);
  // Dias concluídos (✓). Atualiza na hora quando o aluno conclui no player.
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(
    () => new Set(completedDays ?? []),
  );

  if (weeks.length === 0) return null;

  const current = weeks[activeIdx];
  const intensity = current.intensity ? INTENSITY_LABELS[current.intensity] : null;
  const dayKeyOf = (di: number) => `w${activeIdx}d${di}`;

  // Marca um dia como concluído: grava no servidor e atualiza o ✓ na hora.
  async function concludeDay(key: string) {
    setCompletedKeys((prev) => new Set(prev).add(key));
    try {
      await fetch("/api/consultoria/complete-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayKey: key }),
      });
    } catch {
      toast.error("Não consegui salvar a conclusão. Tente de novo.");
    }
  }

  // Sequência do player = TODOS os exercícios COM vídeo da semana ativa, na ordem
  // (cruza os dias/grupamentos). Cada item carrega o dia a que pertence, e `keys`
  // mapeia (dia-exercício) → posição na sequência, pra abrir no exercício tocado.
  function weekVideoExercises(): { items: PlayerExercise[]; keys: string[] } {
    const items: PlayerExercise[] = [];
    const keys: string[] = [];
    current.days.forEach((day, di) => {
      const dayLabel = day.name ?? `Dia ${di + 1}`;
      day.exercises.forEach((ex, ei) => {
        if (!ex.youtube_id) return;
        items.push({
          name: ex.name,
          youtube_id: ex.youtube_id,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          dayName: dayLabel,
          dayKey: dayKeyOf(di),
        });
        keys.push(`${di}-${ei}`);
      });
    });
    return { items, keys };
  }

  function openPlayer(di: number, ei: number) {
    const { keys } = weekVideoExercises();
    setPlayer({ startIndex: Math.max(0, keys.indexOf(`${di}-${ei}`)) });
  }

  function cardControl(di: number, ei: number) {
    return { onOpen: () => openPlayer(di, ei) };
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-dim rounded-full flex items-center justify-center">
          <Dumbbell size={18} className="stroke-pink" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-2xl text-white tracking-wide">
            PLANO DE TREINO
          </h2>
          {weeks.length > 1 && (
            <p className="font-mono text-[11px] text-gray-3 uppercase tracking-wider">
              {weeks.length} semanas — Periodização
            </p>
          )}
        </div>
      </div>

      {/* Tabs de semana (só renderiza se > 1 semana) */}
      {weeks.length > 1 && (
        <div className="flex items-center gap-2 border-b border-gray-4 overflow-x-auto pb-px">
          {weeks.map((w, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setActiveIdx(idx);
                setActiveDay(0);
                setPlayer(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                activeIdx === idx
                  ? "border-pink text-pink"
                  : "border-transparent text-gray-2 hover:text-white"
              }`}
            >
              {w.is_peak_week && <Flame size={12} />}
              {w.name}
            </button>
          ))}
        </div>
      )}

      {/* Metadados da semana ativa */}
      {(current.is_peak_week || intensity || current.notes) && (
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-2">
          <div className="flex items-center flex-wrap gap-2">
            {current.is_peak_week && (
              <Badge variant="pink">
                <Flame size={10} /> PEAK WEEK
              </Badge>
            )}
            {intensity && (
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.08em] rounded-full border ${intensity.className}`}
              >
                {intensity.label}
              </span>
            )}
          </div>
          {current.notes && (
            <p className="text-[13px] text-gray-2 leading-relaxed">{current.notes}</p>
          )}
        </div>
      )}

      {/* Abas por dia — mostra um treino de cada vez */}
      {(() => {
        const dayIdx = Math.min(activeDay, current.days.length - 1);
        const day = current.days[dayIdx];
        const di = dayIdx;
        const firstVideoEi = day.exercises.findIndex((e) => e.youtube_id);
        return (
        <div className="space-y-4">
          {/* Seletor de dias (rolável no celular) */}
          {current.days.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {current.days.map((d, i) => {
                const on = i === dayIdx;
                const done = completedKeys.has(dayKeyOf(i));
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setActiveDay(i);
                      setPlayer(null);
                    }}
                    className={`flex items-center gap-2 shrink-0 rounded-full border px-3 py-2 transition-colors ${
                      on
                        ? "bg-pink border-pink text-white"
                        : "bg-bg-1 border-gray-4 text-gray-2 hover:text-white"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-display text-[12px] ${
                        on ? "bg-white/20 text-white" : "bg-pink-dim text-pink"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[12px] font-semibold whitespace-nowrap max-w-[150px] truncate">
                      {d.name ?? `Dia ${i + 1}`}
                    </span>
                    {done && (
                      <Check size={13} className={on ? "stroke-white" : "stroke-green-400"} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Cabeçalho do dia ativo */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 bg-pink border-2 border-pink rounded-[10px] flex items-center justify-center">
              <span className="font-display text-[15px] text-white">
                {String.fromCharCode(65 + di)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-[20px] text-white tracking-wide truncate">
                {(day.name ?? "Treino").toUpperCase()}
              </h3>
            </div>
            <Badge variant="pink">
              <Target size={10} />
              {day.exercises.length} exercícios
            </Badge>
            {completedKeys.has(dayKeyOf(di)) && (
              <Badge variant="green">
                <Check size={10} />
                Concluído
              </Badge>
            )}
            {firstVideoEi >= 0 && (
              <button
                type="button"
                onClick={() => openPlayer(di, firstVideoEi)}
                className="inline-flex items-center gap-2 bg-pink text-white text-[13px] font-semibold rounded-full px-4 py-2 hover:bg-pink-light transition-colors"
              >
                <Dumbbell size={14} />
                Treinar este dia
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {buildExerciseRuns(day.exercises).map((run, ri) =>
              run.items.length === 1 ? (
                <ExerciseCard
                  key={run.items[0].originalIndex}
                  exercise={run.items[0].exercise}
                  index={run.items[0].originalIndex}
                  coachTips={tipsFor(run.items[0].exercise, tipsByYoutubeId)}
                  {...cardControl(di, run.items[0].originalIndex)}
                />
              ) : (
                <div
                  key={`group-${ri}`}
                  className="sm:col-span-2 lg:col-span-3 bg-pink/5 border-l-4 border-l-pink rounded-[14px] pl-3 pr-2 py-2.5 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Link2 size={12} className="stroke-pink" />
                    <span className="font-mono text-[10px] text-pink uppercase tracking-[0.12em]">
                      {exerciseGroupLabel(run.groupType ?? "") || "Bloco"} ·{" "}
                      {run.items.length} exercícios
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {run.items.map((item) => (
                      <ExerciseCard
                        key={item.originalIndex}
                        exercise={item.exercise}
                        index={item.originalIndex}
                        inGroup
                        coachTips={tipsFor(item.exercise, tipsByYoutubeId)}
                        {...cardControl(di, item.originalIndex)}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
        );
      })()}

      {/* Player imersivo (tela cheia) — percorre os exercícios do dia */}
      {player &&
        (() => {
          const { items } = weekVideoExercises();
          if (items.length === 0) return null;
          return (
            <ConsultationPlayer
              exercises={items}
              startIndex={player.startIndex}
              completedKeys={Array.from(completedKeys)}
              onConcludeDay={concludeDay}
              onClose={() => setPlayer(null)}
            />
          );
        })()}
    </section>
  );
}
