"use client";

import { useMemo, useState } from "react";
import { Search, X, Dumbbell, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { workoutCategoryLabel, exerciseInGroup } from "@/constants/categories";

export interface ExerciseCatalogItem {
  id: string;
  name: string;
  primary_category: string;
  level?: string | null;
  secondary_groups: string[];
  equipment: string[];
  default_sets: number;
  default_reps: string;
  default_rest: number;
  workout_video_id: string | null;
  workout_video_youtube_id?: string | null;
}

interface Props {
  open: boolean;
  dayName: string;
  catalog: ExerciseCatalogItem[];
  onClose: () => void;
  onPick: (exercise: ExerciseCatalogItem) => void;
}

/**
 * Modal de seleção de exercício do catálogo (tabela `exercises`).
 * Diferente do workout-picker (que é a biblioteca de vídeos YouTube), aqui o
 * admin escolhe um exercício catalogado com defaults de sets/reps/rest + grupo
 * secundário + equipamento + opcional link com vídeo da biblioteca.
 */
export function ExercisePickerModal({ open, dayName, catalog, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [equipFilter, setEquipFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((e) => {
      set.add(e.primary_category);
      e.secondary_groups.forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [catalog]);

  const equipments = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((e) => e.equipment.forEach((eq) => set.add(eq)));
    return Array.from(set).sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => {
      if (!exerciseInGroup(e, category)) return false;
      if (equipFilter !== "all" && !e.equipment.includes(equipFilter)) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [catalog, query, category, equipFilter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-1 border border-gray-4 rounded-[16px] w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-4">
          <div>
            <h3 className="font-display text-xl text-white">CATÁLOGO DE EXERCÍCIOS</h3>
            <p className="text-gray-3 text-[13px] mt-0.5">
              Adicionar a: <span className="text-pink">{dayName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-3 hover:text-white transition-colors p-1"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 border-b border-gray-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-3 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar exercício (ex: agachamento, hip thrust)..."
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
            >
              <option value="all">Todas categorias ({catalog.length})</option>
              {categories.map((c) => {
                const count = catalog.filter((e) => exerciseInGroup(e, c)).length;
                return (
                  <option key={c} value={c}>
                    {workoutCategoryLabel(c)} ({count})
                  </option>
                );
              })}
            </select>
            <select
              value={equipFilter}
              onChange={(e) => setEquipFilter(e.target.value)}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
            >
              <option value="all">Qualquer equipamento</option>
              {equipments.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-3 text-[13px]">
              {catalog.length === 0
                ? "Catálogo vazio. Cadastre exercícios em /admin/exercises."
                : "Nenhum exercício bate com os filtros."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPick(e)}
                  className="bg-bg-2 border border-gray-4 rounded-[12px] p-3 text-left hover:border-pink/40 hover:bg-bg-3/30 transition-all duration-150 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Dumbbell size={16} className="stroke-pink shrink-0" />
                      <h4 className="font-semibold text-white text-[13px] line-clamp-2 group-hover:text-pink transition-colors">
                        {e.name}
                      </h4>
                    </div>
                    {e.workout_video_id && (
                      <span title="Vinculado a vídeo da biblioteca">
                        <LinkIcon size={12} className="stroke-pink shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <Badge variant="pink" className="text-[10px]">
                      {workoutCategoryLabel(e.primary_category)}
                    </Badge>
                    {e.level && (
                      <Badge variant="white" className="text-[10px]">
                        {e.level === "iniciante"
                          ? "Iniciante"
                          : e.level === "intermediario"
                            ? "Intermediário"
                            : e.level === "avancado"
                              ? "Avançado"
                              : e.level}
                      </Badge>
                    )}
                    {e.secondary_groups.slice(0, 2).map((g) => (
                      <span
                        key={g}
                        className="text-[10px] font-mono uppercase text-gray-3 border border-gray-4 rounded-full px-2 py-0.5"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="font-mono text-[11px] text-gray-3">
                    {e.default_sets}×{e.default_reps} · {e.default_rest}s
                    {e.equipment.length > 0 && (
                      <span className="ml-2 text-gray-3">· {e.equipment.join(", ")}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-4 flex items-center justify-between">
          <span className="text-[11px] text-gray-3 font-mono tracking-[0.08em] uppercase">
            {filtered.length} de {catalog.length}
          </span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
