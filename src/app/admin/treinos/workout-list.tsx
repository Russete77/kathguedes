"use client";

import { toggleWorkoutPublished, deleteWorkout } from "../actions";
import { WorkoutEdit } from "./workout-edit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Trash2, PlayCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  notes: string | null;
}

const categoryLabels: Record<string, string> = {
  gluteo: "Glúteos",
  pernas: "Pernas",
  quadriceps: "Quadríceps",
  costas: "Costas",
  ombro: "Ombro",
  peito: "Peito",
  biceps: "Bíceps",
  triceps: "Tríceps",
  abdomen: "Abdômen",
  superior: "Superior",
  inferior: "Inferior",
  hiit: "HIIT",
  cardio: "Cardio",
  funcional: "Funcional",
  full: "Completo",
  alongamento: "Alongamento",
  aquecimento: "Aquecimento",
  viagem: "Viagem",
  competicao: "Competição",
};

const levelLabels: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function WorkoutList({ workouts }: { workouts: WorkoutRow[] }) {
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
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-4 hover:bg-transparent">
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
          {workouts.map((w) => (
            <TableRow key={w.id} className="border-gray-4">
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
                  {categoryLabels[w.category] || w.category}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-2 text-sm">
                {levelLabels[w.level] || w.level}
              </TableCell>
              <TableCell className="font-mono text-sm text-gray-2">
                {w.duration_minutes}min
              </TableCell>
              <TableCell>
                <Badge
                  variant={w.required_plan === "free" ? "dark" : "pink"}
                >
                  {w.required_plan.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-pink">
                {w.views_count}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <WorkoutEdit workout={w} />
                  <Button
                    variant="icon"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() =>
                      toggleWorkoutPublished(w.id, !w.is_published)
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
                    className="w-8 h-8 px-0 rounded-full"
                    onClick={() => {
                      if (confirm("Deletar este treino?")) deleteWorkout(w.id);
                    }}
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
  );
}
