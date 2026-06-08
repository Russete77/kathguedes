"use client";

import { useState } from "react";
import { updateWorkout } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { WORKOUT_CATEGORIES } from "@/constants/categories";

interface Workout {
  id: string;
  title: string;
  youtube_id: string;
  category: string;
  level: string;
  duration_minutes: number;
  required_plan: string;
  description: string | null;
  is_short: boolean;
  is_free_preview: boolean;
  notes: string | null;
  thumbnail_url?: string | null;
  block?: number | null;
  week_in_block?: number | null;
  split_slot?: string | null;
  track?: string | null;
}

export function WorkoutEdit({ workout }: { workout: Workout }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await updateWorkout(workout.id, formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-bg-2 border border-gray-4 hover:border-pink hover:text-pink text-gray-2 transition-all">
        <Pencil size={14} />
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 w-[95vw] sm:w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            EDITAR TREINO
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Título do treino"
            defaultValue={workout.title}
            required
          />
          <Input
            name="youtube_id"
            label="Link do YouTube"
            defaultValue={workout.youtube_id}
            hint="Aceita URL completa, youtu.be ou só o ID"
            required
          />
          <Input
            name="description"
            label="Descrição (opcional)"
            defaultValue={workout.description || ""}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">Categoria</label>
              <Select name="category" defaultValue={workout.category} required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4 max-h-[300px]">
                  {WORKOUT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">Nível</label>
              <Select name="level" defaultValue={workout.level} required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4">
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="duration_minutes"
              label="Duração (min)"
              type="number"
              defaultValue={workout.duration_minutes}
              required
            />
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">Plano mínimo</label>
              <Select name="required_plan" defaultValue={workout.required_plan}>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-2 border-gray-4">
                  <SelectItem value="start">Start — Biblioteca de treinos</SelectItem>
                  <SelectItem value="evolucao">Evolução — Treinos + Dieta</SelectItem>
                  <SelectItem value="saude_completa">Saúde Completa — Treinador + Anamnese</SelectItem>
                  <SelectItem value="atleta">Atleta — Competição</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Periodização — consultoria IA / blocos de 6 semanas (todos opcionais) */}
          <div className="rounded-[8px] border border-gray-4 bg-bg-2/40 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-gray-3 tracking-[0.08em] uppercase">
              Periodização (opcional — usado pela consultoria/IA)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="block"
                label="Bloco"
                type="number"
                min={1}
                defaultValue={workout.block ?? ""}
                placeholder="ex: 1"
              />
              <Input
                name="week_in_block"
                label="Semana no bloco (1-6)"
                type="number"
                min={1}
                max={6}
                defaultValue={workout.week_in_block ?? ""}
                placeholder="1 a 6"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="split_slot"
                label="Slot do split"
                defaultValue={workout.split_slot ?? ""}
                placeholder="ex: gluteo, superior"
              />
              <Input
                name="track"
                label="Trilha"
                defaultValue={workout.track ?? ""}
                placeholder="ex: iniciante"
              />
            </div>
          </div>

          {/* Short + Dica */}
          <div className="flex items-center gap-3 bg-bg-2 border border-gray-4 rounded-[8px] px-4 py-3">
            <input type="checkbox" name="is_short" value="true" id={`is_short_${workout.id}`} defaultChecked={workout.is_short} className="accent-pink" />
            <label htmlFor={`is_short_${workout.id}`} className="text-[13px] text-gray-1">
              YouTube Shorts (vídeo vertical 9:16)
            </label>
          </div>
          {/* Freemium — libera pro visitante sem subscription ativa */}
          <div className="flex items-center gap-3 bg-bg-2 border border-gray-4 rounded-[8px] px-4 py-3">
            <input type="checkbox" name="is_free_preview" value="true" id={`is_free_preview_${workout.id}`} defaultChecked={workout.is_free_preview ?? false} className="accent-pink" />
            <label htmlFor={`is_free_preview_${workout.id}`} className="text-[13px] text-gray-1">
              Liberar como preview gratuito (visível pra quem ainda não pagou)
            </label>
          </div>

          <Input
            name="thumbnail_url"
            label="Thumbnail custom (URL — opcional)"
            placeholder="https://… (imagem com o rosto enquadrado; senão usa a do YouTube)"
            defaultValue={workout.thumbnail_url ?? ""}
          />

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
              Dica da Kath (opcional)
            </label>
            <textarea
              name="notes"
              defaultValue={workout.notes || ""}
              placeholder="Ex: Foquem na contração do glúteo na subida..."
              rows={2}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white font-body text-[14px] px-4 py-3 outline-none resize-none focus:border-pink placeholder:text-gray-3"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
