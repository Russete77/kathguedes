"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createExercise, updateExercise } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EXERCISE_CATEGORIES } from "@/constants/categories";
import { bestVideoMatch } from "@/lib/match-video";
import type { ExerciseRow } from "@/lib/supabase/types";

interface Props {
  exercise?: ExerciseRow;
  videoOptions: { id: string; title: string; category: string }[];
}

export function ExerciseForm({ exercise, videoOptions }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!exercise;

  // Nome controlado pra sugerir o vídeo da biblioteca por similaridade.
  const [name, setName] = useState(exercise?.name || "");
  // Vídeo escolhido manualmente sobrescreve a sugestão automática.
  const [videoChoice, setVideoChoice] = useState<string | null>(
    exercise?.workout_video_id ?? null,
  );

  // Se o admin ainda não escolheu vídeo, sugerimos o que melhor casa com o nome.
  const suggestedVideoId =
    videoChoice === null ? bestVideoMatch(name, videoOptions) : null;
  const selectedVideoId = videoChoice ?? suggestedVideoId ?? "__none__";
  const suggestedVideo =
    suggestedVideoId != null
      ? videoOptions.find((v) => v.id === suggestedVideoId)
      : null;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      if (isEdit) {
        await updateExercise(exercise.id, formData);
        toast.success("Exercício atualizado");
      } else {
        await createExercise(formData);
        toast.success("Exercício cadastrado");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={
          isEdit
            ? "w-8 h-8 inline-flex items-center justify-center rounded-full bg-bg-2 border border-gray-4 hover:border-pink hover:text-pink text-gray-2 transition-all"
            : "inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer"
        }
      >
        {isEdit ? <Pencil size={14} /> : <><Plus size={16} /> Novo Exercício</>}
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 w-[95vw] sm:w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            {isEdit ? "EDITAR EXERCÍCIO" : "NOVO EXERCÍCIO"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="name"
            label="Nome do exercício"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Agachamento Búlgaro"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Categoria primária
              </label>
              <Select name="primary_category" defaultValue={exercise?.primary_category || "gluteo"} required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4 max-h-[300px]">
                  {EXERCISE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              name="secondary_groups"
              label="Grupos secundários"
              defaultValue={(exercise?.secondary_groups ?? []).join(", ")}
              placeholder="posterior, gluteo"
              hint="Separados por vírgula"
            />
          </div>
          <Input
            name="equipment"
            label="Equipamento"
            defaultValue={(exercise?.equipment ?? []).join(", ")}
            placeholder="barra, banco"
            hint="Separados por vírgula"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              name="default_sets"
              label="Séries"
              type="number"
              defaultValue={exercise?.default_sets ?? 3}
              required
            />
            <Input
              name="default_reps"
              label="Reps"
              defaultValue={exercise?.default_reps || "10-12"}
              placeholder="10-12"
              required
            />
            <Input
              name="default_rest"
              label="Descanso (s)"
              type="number"
              defaultValue={exercise?.default_rest ?? 60}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
              Vincular com vídeo da biblioteca (opcional)
            </label>
            <Select
              name="workout_video_id"
              value={selectedVideoId}
              onValueChange={(v) => setVideoChoice(v)}
            >
              <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent className="bg-bg-2 border-gray-4 max-h-[300px]">
                <SelectItem value="__none__">— sem vídeo —</SelectItem>
                {videoOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestedVideo ? (
              <span className="text-[11px] text-pink">
                Sugerido automaticamente pelo nome: &ldquo;{suggestedVideo.title}&rdquo;. Troque se não for o vídeo certo.
              </span>
            ) : (
              <span className="text-[11px] text-gray-3">
                Se vincular, ao adicionar este exercício em plano o admin reaproveita o vídeo de execução.
              </span>
            )}
          </div>
          <Input
            name="notes"
            label="Notas (opcional)"
            defaultValue={exercise?.notes ?? ""}
            placeholder="Ex: 'foco na contração do glúteo na subida'"
          />
          <div className="flex items-center gap-3 bg-bg-2 border border-gray-4 rounded-[8px] px-4 py-3">
            <input
              type="checkbox"
              name="is_active"
              value="true"
              id="is_active"
              defaultChecked={exercise?.is_active ?? true}
              className="accent-pink"
            />
            <label htmlFor="is_active" className="text-[13px] text-gray-1">
              Ativo (visível pra admins na hora de montar plano)
            </label>
          </div>
          <input type="hidden" name="sort_order" value={exercise?.sort_order ?? 0} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
