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
  notes: string | null;
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
      <DialogContent className="bg-bg-1 border-gray-4 max-w-lg">
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
                  <SelectItem value="gluteo">Glúteos</SelectItem>
                  <SelectItem value="pernas">Pernas</SelectItem>
                  <SelectItem value="costas">Costas</SelectItem>
                  <SelectItem value="ombro">Ombro</SelectItem>
                  <SelectItem value="peito">Peito</SelectItem>
                  <SelectItem value="biceps">Bíceps</SelectItem>
                  <SelectItem value="triceps">Tríceps</SelectItem>
                  <SelectItem value="abdomen">Abdômen</SelectItem>
                  <SelectItem value="superior">Superior Completo</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="funcional">Funcional</SelectItem>
                  <SelectItem value="full">Treino Completo</SelectItem>
                  <SelectItem value="alongamento">Alongamento</SelectItem>
                  <SelectItem value="aquecimento">Aquecimento</SelectItem>
                  <SelectItem value="viagem">Treino de Viagem</SelectItem>
                  <SelectItem value="competicao">Competição</SelectItem>
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
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Short + Dica */}
          <div className="flex items-center gap-3 bg-bg-2 border border-gray-4 rounded-[8px] px-4 py-3">
            <input type="checkbox" name="is_short" value="true" id={`is_short_${workout.id}`} defaultChecked={workout.is_short} className="accent-pink" />
            <label htmlFor={`is_short_${workout.id}`} className="text-[13px] text-gray-1">
              YouTube Shorts (vídeo vertical 9:16)
            </label>
          </div>

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
