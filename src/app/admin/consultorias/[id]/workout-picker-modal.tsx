"use client";

import { useMemo, useState } from "react";
import { Search, X, PlayCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface WorkoutLibraryItem {
  id: string;
  title: string;
  youtube_id: string;
  category: string;
  level: string;
  duration_minutes: number;
  required_plan: string;
}

interface Props {
  open: boolean;
  dayName: string;
  library: WorkoutLibraryItem[];
  onClose: () => void;
  onPick: (workout: WorkoutLibraryItem) => void;
}

/**
 * Modal de seleção de treino da biblioteca pública (workout_videos).
 * Usado no plan-editor da consultoria pra admin compor plano usando treinos já
 * cadastrados, em vez de digitar nome + youtube_id manualmente.
 */
export function WorkoutPickerModal({ open, dayName, library, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    library.forEach((w) => set.add(w.category));
    return Array.from(set).sort();
  }, [library]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter((w) => {
      if (category !== "all" && w.category !== category) return false;
      if (q && !w.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [library, query, category]);

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
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-4">
          <div>
            <h3 className="font-display text-xl text-white">BIBLIOTECA DE VÍDEOS</h3>
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

        {/* Filtros */}
        <div className="p-5 border-b border-gray-4 space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-3 pointer-events-none"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory("all")}
              className={`text-[11px] font-mono tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                category === "all"
                  ? "bg-pink text-white border-pink"
                  : "bg-bg-2 text-gray-2 border-gray-4 hover:border-pink/40"
              }`}
            >
              Todas ({library.length})
            </button>
            {categories.map((c) => {
              const count = library.filter((w) => w.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[11px] font-mono tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                    category === c
                      ? "bg-pink text-white border-pink"
                      : "bg-bg-2 text-gray-2 border-gray-4 hover:border-pink/40"
                  }`}
                >
                  {c} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-3 text-[13px]">
              {library.length === 0
                ? "Nenhum treino publicado ainda. Cadastre em /admin/treinos."
                : "Nenhum treino bate com os filtros."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onPick(w)}
                  className="bg-bg-2 border border-gray-4 rounded-[12px] overflow-hidden text-left hover:border-pink/40 hover:bg-bg-3/30 transition-all duration-150 group"
                >
                  <div
                    className="h-[100px] bg-bg-3 bg-cover bg-center relative"
                    style={{
                      backgroundImage: `url(https://img.youtube.com/vi/${w.youtube_id}/mqdefault.jpg)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-1/80 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle size={32} className="stroke-pink" />
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <h4 className="font-semibold text-white text-[13px] line-clamp-2 group-hover:text-pink transition-colors">
                      {w.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="pink" className="text-[10px]">
                        {w.category.toUpperCase()}
                      </Badge>
                      <Badge variant="white" className="text-[10px]">
                        {w.level}
                      </Badge>
                      <span className="font-mono text-[10px] text-gray-3">
                        {w.duration_minutes}min
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-gray-3 tracking-[0.08em] uppercase">
                      Plano: {w.required_plan.replace("_", " ")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-4 flex items-center justify-between">
          <span className="text-[11px] text-gray-3 font-mono tracking-[0.08em] uppercase">
            {filtered.length} de {library.length}
          </span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
