"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Eye, EyeOff, Trash2, Dumbbell, Link as LinkIcon } from "lucide-react";
import { ExerciseForm } from "./exercise-form";
import { toggleExerciseActive, deleteExercise } from "../actions";
import { EXERCISE_CATEGORIES, exerciseInGroup, workoutCategoryLabel } from "@/constants/categories";
import type { ExerciseRow } from "@/lib/supabase/types";

interface Props {
  exercises: ExerciseRow[];
  videoOptions: { id: string; title: string; category: string }[];
}

const ACTIVE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "yes", label: "Ativos" },
  { value: "no", label: "Inativos" },
] as const;

const LEVEL_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function ExerciseList({ exercises, videoOptions }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "yes" | "no">("all");

  const videoById = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    videoOptions.forEach((v) => map.set(v.id, v));
    return map;
  }, [videoOptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (!exerciseInGroup(e, category)) return false;
      if (activeFilter === "yes" && !e.is_active) return false;
      if (activeFilter === "no" && e.is_active) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [exercises, search, category, activeFilter]);

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleExerciseActive(id, !current);
      toast.success(current ? "Exercício desativado" : "Exercício reativado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Desativar "${name}"?\n\nO catálogo preserva o exercício como inativo. Planos antigos que já referenciam exercise_id não quebram.`)) return;
    try {
      await deleteExercise(id);
      toast.success(`"${name}" desativado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  if (!exercises.length) {
    return (
      <div className="text-center py-16">
        <Dumbbell size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Catálogo vazio.</p>
        <p className="text-gray-3 text-sm mt-1">
          Aplique a migration 34 ou cadastre o primeiro exercício.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filtros */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-3 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-10"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
          >
            <option value="all">Todas as categorias</option>
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as "all" | "yes" | "no")}
            className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
          >
            {ACTIVE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="text-[11px] font-mono text-gray-3 tracking-[0.08em] uppercase">
          {filtered.length} de {exercises.length}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:block bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-4 hover:bg-transparent">
              <TableHead className="text-gray-2">Nome</TableHead>
              <TableHead className="text-gray-2">Categoria</TableHead>
              <TableHead className="text-gray-2">Grupos secundários</TableHead>
              <TableHead className="text-gray-2">Equipamento</TableHead>
              <TableHead className="text-gray-2 text-center">Defaults</TableHead>
              <TableHead className="text-gray-2 text-center">Vídeo</TableHead>
              <TableHead className="text-gray-2 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const video = e.workout_video_id ? videoById.get(e.workout_video_id) : null;
              return (
                <TableRow key={e.id} className="border-gray-4">
                  <TableCell>
                    <div className="font-semibold text-white text-sm">
                      {e.name}
                      {!e.is_active && (
                        <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.08em] text-gray-3">
                          inativo
                        </span>
                      )}
                    </div>
                    {e.notes && (
                      <div className="text-[11px] text-gray-3 mt-0.5 line-clamp-1">{e.notes}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="pink">{workoutCategoryLabel(e.primary_category)}</Badge>
                      {e.level && (
                        <Badge variant="white">{LEVEL_LABEL[e.level] ?? e.level}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-gray-2">
                    {e.secondary_groups.length > 0 ? e.secondary_groups.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-[12px] text-gray-2">
                    {e.equipment.length > 0 ? e.equipment.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-center font-mono text-[12px] text-gray-2">
                    {e.default_sets}×{e.default_reps} · {e.default_rest}s
                  </TableCell>
                  <TableCell className="text-center">
                    {video ? (
                      <span className="inline-flex items-center gap-1 text-pink text-[12px]" title={video.title}>
                        <LinkIcon size={12} />
                        sim
                      </span>
                    ) : (
                      <span className="text-gray-3 text-[12px]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ExerciseForm exercise={e} videoOptions={videoOptions} />
                      <Button
                        variant="icon"
                        size="icon"
                        className="w-8 h-8"
                        onClick={() => handleToggle(e.id, e.is_active)}
                        title={e.is_active ? "Desativar" : "Ativar"}
                      >
                        {e.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-8 h-8 px-0 rounded-full"
                        onClick={() => handleDelete(e.id, e.name)}
                        title="Desativar (soft delete)"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE */}
      <div className="md:hidden space-y-3">
        {filtered.map((e) => {
          const video = e.workout_video_id ? videoById.get(e.workout_video_id) : null;
          return (
            <article key={e.id} className="bg-bg-1 border border-gray-4 rounded-[14px] p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white text-sm">
                    {e.name}
                    {!e.is_active && (
                      <span className="ml-2 text-[10px] font-mono uppercase text-gray-3">inativo</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="pink" className="text-[10px]">{workoutCategoryLabel(e.primary_category)}</Badge>
                    {e.level && (
                      <Badge variant="white" className="text-[10px]">{LEVEL_LABEL[e.level] ?? e.level}</Badge>
                    )}
                    {video && (
                      <span className="inline-flex items-center gap-1 text-pink text-[10px]">
                        <LinkIcon size={10} /> vídeo
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-gray-3 mt-1">
                    {e.default_sets}×{e.default_reps} · {e.default_rest}s
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <ExerciseForm exercise={e} videoOptions={videoOptions} />
                  <Button
                    variant="icon" size="icon" className="w-8 h-8"
                    onClick={() => handleToggle(e.id, e.is_active)}
                  >
                    {e.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </Button>
                  <Button
                    variant="destructive" size="sm" className="w-8 h-8 px-0 rounded-full"
                    onClick={() => handleDelete(e.id, e.name)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
