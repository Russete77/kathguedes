"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  toggleWorkoutPublished,
  deleteWorkout,
  deleteWorkoutForce,
  moveWorkout,
  promoteWorkoutToExercise,
} from "../actions";
import { WorkoutEdit } from "./workout-edit";
import { WorkoutTipsButton } from "./workout-tips-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye, EyeOff, Trash2, PlayCircle, Search, ArrowUp, ArrowDown, Sparkles,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { WORKOUT_CATEGORIES, workoutCategoryLabel } from "@/constants/categories";

interface WorkoutRow {
  id: string;
  title: string;
  youtube_id: string;
  description: string | null;
  category: string;
  level: string;
  duration_minutes: number;
  required_plan: string;
  views_count: number;
  is_published: boolean;
  published_at: string | null;
  is_short: boolean;
  is_free_preview: boolean;
  notes: string | null;
  sort_order: number;
  coach_tips: string | null;
  coach_tips_source: string | null;
  block?: number | null;
  week_in_block?: number | null;
  split_slot?: string | null;
  track?: string | null;
}

const levelLabels: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const PLAN_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os planos" },
  { value: "start", label: "Start" },
  { value: "evolucao", label: "Evolução" },
  { value: "saude_completa", label: "Saúde Completa" },
  { value: "atleta", label: "Atleta" },
];

const PUBLISHED_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "yes", label: "Publicados" },
  { value: "no", label: "Despublicados" },
];

export function WorkoutList({ workouts }: { workouts: WorkoutRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [plan, setPlan] = useState<string>("all");
  const [published, setPublished] = useState<string>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function confirmDelete(id: string, title: string) {
    if (!confirm(`Deletar "${title}"?`)) return;
    setDeletingId(id);
    try {
      const res = await deleteWorkout(id);
      if (res.mode === "hard") {
        toast.success(`"${title}" deletado`);
        router.refresh();
        return;
      }
      // Soft delete fallback — oferece forçar
      const logs = res.affectedLogs ?? 0;
      const forceMsg = logs > 0
        ? `Esse treino tem ${logs} registro(s) de usuario(s) que ja treinaram. Foi DESPUBLICADO em vez de apagado.\n\nDeseja FORCAR a exclusao? Isso vai APAGAR PERMANENTEMENTE o video + os ${logs} registro(s) de treino. IRREVERSIVEL.`
        : `Foi DESPUBLICADO. Deseja FORCAR a exclusao (apagar permanentemente)?`;
      const wantsForce = confirm(forceMsg);
      if (!wantsForce) {
        toast.success(
          `"${title}" despublicado. Use 'Forçar' se quiser apagar de vez.`,
          { duration: 6000 },
        );
        router.refresh();
        return;
      }
      // Segunda confirmação explícita
      const reallySure = confirm(
        `CONFIRMAR: apagar permanentemente "${title}" e ${logs} registro(s) de treino?`,
      );
      if (!reallySure) {
        router.refresh();
        return;
      }
      const forceRes = await deleteWorkoutForce(id);
      toast.success(
        `"${title}" apagado. ${forceRes.deletedLogs} log(s) e ${forceRes.deletedLikes} like(s) removidos.`,
        { duration: 6000 },
      );
      router.refresh();
    } catch (err) {
      console.error("[deleteWorkout] failed", err);
      toast.error(
        err instanceof Error
          ? `Erro ao deletar: ${err.message}`
          : "Erro ao deletar",
        { duration: 9000 },
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePublished(id: string, next: boolean) {
    try {
      await toggleWorkoutPublished(id, next);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Erro ao ${next ? "publicar" : "despublicar"}: ${err.message}`
          : "Erro",
      );
    }
  }

  // "Promover a exercicio" — cria o item correspondente em /admin/exercises
  // ja vinculado ao video (workout_video_id). Idempotente: se ja existir,
  // so avisa. Defaults 3x10-12, 60s — ajusta depois em /admin/exercises.
  const [promotingId, setPromotingId] = useState<string | null>(null);
  async function handlePromoteToExercise(id: string, title: string) {
    setPromotingId(id);
    try {
      const res = await promoteWorkoutToExercise(id);
      if (res.mode === "created") {
        toast.success(`"${title}" entrou no catalogo de exercicios.`, {
          duration: 5000,
          style: { borderLeft: "3px solid #00FF88" },
        });
      } else if (res.mode === "linked") {
        toast.success(`"${title}" vinculado ao exercicio existente.`, {
          duration: 5000,
        });
      } else {
        toast.success(`"${title}" ja estava no catalogo.`, { duration: 4000 });
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Erro ao promover: ${err.message}`
          : "Erro ao promover",
        { duration: 8000 },
      );
    } finally {
      setPromotingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workouts.filter((w) => {
      if (q && !w.title.toLowerCase().includes(q) && !w.youtube_id.toLowerCase().includes(q)) return false;
      if (category !== "all" && w.category !== category) return false;
      if (plan !== "all" && w.required_plan !== plan) return false;
      if (published === "yes" && !w.is_published) return false;
      if (published === "no" && w.is_published) return false;
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [workouts, search, category, plan, published]);

  function handleMove(id: string, direction: "up" | "down") {
    setPendingId(id);
    startTransition(async () => {
      try {
        await moveWorkout(id, direction);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao mover");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (!workouts.length) {
    return (
      <div className="text-center py-16">
        <PlayCircle size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhum treino publicado ainda.</p>
        <p className="text-gray-3 text-sm mt-1">
          Clique em &quot;Novo Treino&quot; para começar.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filtros — sempre visíveis */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-3 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou YouTube ID..."
            className="pl-10"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
          >
            <option value="all">Todas as categorias</option>
            {WORKOUT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
          >
            {PLAN_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={published}
            onChange={(e) => setPublished(e.target.value)}
            className="bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[13px] px-3 py-2 outline-none focus:border-pink"
          >
            {PUBLISHED_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="text-[11px] font-mono text-gray-3 tracking-[0.08em] uppercase">
          {filtered.length} de {workouts.length}
        </div>
      </div>

      {/* MOBILE (< md): cards verticais — sem scroll horizontal. */}
      <div className="md:hidden space-y-3">
        {filtered.map((w, idx) => (
          <article
            key={w.id}
            className="bg-bg-1 border border-gray-4 rounded-[14px] p-3 space-y-3"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-16 h-16 rounded-[10px] bg-bg-2 bg-cover bg-center shrink-0"
                style={{
                  backgroundImage: `url(https://img.youtube.com/vi/${w.youtube_id}/mqdefault.jpg)`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white text-sm leading-tight line-clamp-2">
                  {w.title}
                </div>
                <div className="font-mono text-[10px] text-gray-3 mt-0.5 truncate">
                  {w.youtube_id}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge variant="pink" className="text-[10px]">
                    {workoutCategoryLabel(w.category)}
                  </Badge>
                  <Badge variant="pink" className="text-[10px]">
                    {w.required_plan.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Linha 1: meta dados */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-4 text-[11px] text-gray-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span>{levelLabels[w.level] || w.level}</span>
                <span className="font-mono">{w.duration_minutes} min</span>
                <span className="text-pink font-mono">
                  {w.views_count} {w.views_count === 1 ? "view" : "views"}
                </span>
              </div>
            </div>

            {/* Linha 2: acoes — separadas para nao estourar a largura no celular */}
            <div className="flex items-center justify-between gap-1 -mx-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="icon"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => handleMove(w.id, "up")}
                  disabled={idx === 0 || pendingId === w.id}
                  title="Mover pra cima"
                  aria-label="Mover pra cima"
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => handleMove(w.id, "down")}
                  disabled={idx === filtered.length - 1 || pendingId === w.id}
                  title="Mover pra baixo"
                  aria-label="Mover pra baixo"
                >
                  <ArrowDown size={14} />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <WorkoutEdit workout={w} />
                <WorkoutTipsButton workout={w} />
                <Button
                  variant="icon"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => handlePromoteToExercise(w.id, w.title)}
                  disabled={promotingId === w.id}
                  title="Promover a exercicio do catalogo"
                  aria-label="Promover a exercicio do catalogo"
                >
                  <Sparkles size={14} />
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() =>
                    handleTogglePublished(w.id, !w.is_published)
                  }
                  title={w.is_published ? "Despublicar" : "Publicar"}
                  aria-label={w.is_published ? "Despublicar" : "Publicar"}
                >
                  {w.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  className="w-8 h-8 text-red-400 hover:bg-red-500/10 border-red-500/40 disabled:opacity-40"
                  onClick={() => confirmDelete(w.id, w.title)}
                  disabled={deletingId === w.id}
                  title="Excluir"
                  aria-label="Excluir"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* DESKTOP (>= md): tabela densa. */}
      <div className="hidden md:block bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-4 hover:bg-transparent">
              <TableHead className="text-gray-2 w-[80px]">Ordem</TableHead>
              <TableHead className="text-gray-2">Treino</TableHead>
              <TableHead className="text-gray-2">Categoria</TableHead>
              <TableHead className="text-gray-2">Nível</TableHead>
              <TableHead className="text-gray-2">Duração</TableHead>
              <TableHead className="text-gray-2">Plano</TableHead>
              <TableHead className="text-gray-2 text-right">Views</TableHead>
              <TableHead className="text-gray-2 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((w, idx) => (
              <TableRow key={w.id} className="border-gray-4">
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="icon"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => handleMove(w.id, "up")}
                      disabled={idx === 0 || pendingId === w.id}
                      title="Mover pra cima"
                    >
                      <ArrowUp size={12} />
                    </Button>
                    <Button
                      variant="icon"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => handleMove(w.id, "down")}
                      disabled={idx === filtered.length - 1 || pendingId === w.id}
                      title="Mover pra baixo"
                    >
                      <ArrowDown size={12} />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[8px] bg-bg-2 bg-cover bg-center shrink-0"
                      style={{
                        backgroundImage: `url(https://img.youtube.com/vi/${w.youtube_id}/mqdefault.jpg)`,
                      }}
                    />
                    <div>
                      <div className="font-semibold text-white text-sm">
                        {w.title}
                      </div>
                      <div className="font-mono text-[11px] text-gray-3">
                        {w.youtube_id}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="pink">
                    {workoutCategoryLabel(w.category)}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-2 text-sm">
                  {levelLabels[w.level] || w.level}
                </TableCell>
                <TableCell className="font-mono text-sm text-gray-2">
                  {w.duration_minutes}min
                </TableCell>
                <TableCell>
                  <Badge variant="pink">
                    {w.required_plan.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-pink">
                  {w.views_count}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <WorkoutEdit workout={w} />
                    <WorkoutTipsButton workout={w} />
                    <Button
                      variant="icon"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => handlePromoteToExercise(w.id, w.title)}
                      disabled={promotingId === w.id}
                      title="Promover a exercicio do catalogo"
                      aria-label="Promover a exercicio do catalogo"
                    >
                      <Sparkles size={16} />
                    </Button>
                    <Button
                      variant="icon"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() =>
                        handleTogglePublished(w.id, !w.is_published)
                      }
                      title={w.is_published ? "Despublicar" : "Publicar"}
                    >
                      {w.is_published ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-8 h-8 px-0 rounded-full disabled:opacity-40"
                      onClick={() => confirmDelete(w.id, w.title)}
                      disabled={deletingId === w.id}
                      title="Excluir"
                      aria-label="Excluir"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
