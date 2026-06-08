"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createWorkout } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORKOUT_CATEGORIES } from "@/constants/categories";

export function WorkoutForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createWorkout(formData);
      toast.success("Treino publicado");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao publicar treino");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer"
      >
        <Plus size={16} />
        Novo Treino
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 w-[95vw] sm:w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            PUBLICAR TREINO
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Título do treino"
            placeholder="Ex: Glúteo Intenso com Leg Press"
            required
          />
          <Input
            name="youtube_id"
            label="Link do YouTube"
            placeholder="Cole a URL ou ID do vídeo"
            hint="Aceita qualquer formato: URL completa, youtu.be, ou só o ID"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Categoria
              </label>
              <Select name="category" required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue placeholder="Selecione" />
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
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Nível
              </label>
              <Select name="level" required>
                <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                  <SelectValue placeholder="Selecione" />
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
              placeholder="45"
              required
            />
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
                Plano mínimo
              </label>
              <Select name="required_plan" defaultValue="start">
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
          {/* Formato do vídeo */}
          <div className="flex items-center gap-3 bg-bg-2 border border-gray-4 rounded-[8px] px-4 py-3">
            <input type="checkbox" name="is_short" value="true" id="is_short" className="accent-pink" />
            <label htmlFor="is_short" className="text-[13px] text-gray-1">
              YouTube Shorts (vídeo vertical 9:16)
            </label>
          </div>
          {/* Freemium — libera pro visitante sem subscription ativa */}
          <div className="flex items-center gap-3 bg-bg-2 border border-gray-4 rounded-[8px] px-4 py-3">
            <input type="checkbox" name="is_free_preview" value="true" id="is_free_preview" className="accent-pink" />
            <label htmlFor="is_free_preview" className="text-[13px] text-gray-1">
              Liberar como preview gratuito (visível pra quem ainda não pagou)
            </label>
          </div>

          <Input
            name="thumbnail_url"
            label="Thumbnail custom (URL — opcional)"
            placeholder="https://… (imagem com o rosto; senão usa a do YouTube)"
          />

          {/* Dica da Kath */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
              Dica da Kath (opcional)
            </label>
            <textarea
              name="notes"
              placeholder="Ex: Foquem na contração do glúteo na subida..."
              rows={2}
              className="bg-bg-2 border border-gray-4 rounded-[8px] text-white font-body text-[14px] px-4 py-3 outline-none resize-none focus:border-pink placeholder:text-gray-3"
            />
          </div>

          <input type="hidden" name="is_published" value="true" />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
