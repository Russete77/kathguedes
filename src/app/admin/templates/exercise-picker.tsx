"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, PlayCircle, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listCatalogExercises, type CatalogExercise } from "./actions";
import { exerciseInGroup } from "@/constants/categories";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ex: {
    name: string;
    sets: number;
    reps: string;
    rest: number;
    notes: string;
    exercise_id: string;
    youtube_id?: string;
  }) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  gluteo: "Glúteo",
  pernas: "Pernas",
  quadriceps: "Quadríceps",
  costas: "Costas",
  ombro: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  peito: "Peito",
  abdomen: "Abdômen",
  superior: "Superior",
  inferior: "Inferior",
  hiit: "HIIT",
  cardio: "Cardio",
  funcional: "Funcional",
  full: "Full Body",
  alongamento: "Alongamento",
  aquecimento: "Aquecimento",
  viagem: "Viagem",
  competicao: "Competição",
};

export function ExercisePicker({ open, onClose, onPick }: Props) {
  const [catalog, setCatalog] = useState<CatalogExercise[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    if (!open || catalog !== null) return;
    setLoading(true);
    listCatalogExercises()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false));
  }, [open, catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => {
      if (!exerciseInGroup(e, category)) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q);
    });
  }, [catalog, query, category]);

  const categories = useMemo(() => {
    if (!catalog) return [];
    const set = new Set<string>();
    catalog.forEach((e) => {
      set.add(e.primary_category);
      e.secondary_groups.forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [catalog]);

  function pick(ex: CatalogExercise) {
    onPick({
      name: ex.name,
      sets: ex.default_sets,
      reps: ex.default_reps,
      rest: ex.default_rest,
      notes: ex.notes ?? "",
      exercise_id: ex.id,
      youtube_id: ex.youtube_id ?? undefined,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Escolher exercício do catálogo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-3"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome…"
              className="pl-9"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-bg-1 border border-gray-4 text-white rounded-md px-3 py-2 text-sm"
          >
            <option value="all">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c] ?? c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto border border-gray-4 rounded-md">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-3">
              <Loader2 className="animate-spin mr-2" size={18} />
              Carregando catálogo…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center text-gray-3 text-sm">
              {catalog && catalog.length === 0
                ? "Catálogo vazio. Cadastre exercícios em /admin/exercises primeiro."
                : "Nenhum exercício corresponde."}
            </div>
          )}
          {!loading &&
            filtered.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => pick(ex)}
                className="w-full text-left px-4 py-3 hover:bg-bg-2 border-b border-gray-4 last:border-b-0 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{ex.name}</span>
                    {ex.youtube_id && (
                      <PlayCircle size={14} className="text-pink shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-gray-3 mt-0.5">
                    {CATEGORY_LABEL[ex.primary_category] ?? ex.primary_category} ·{" "}
                    {ex.default_sets}x{ex.default_reps} · {ex.default_rest}s descanso
                  </div>
                </div>
                <Plus size={16} className="text-pink shrink-0" />
              </button>
            ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
