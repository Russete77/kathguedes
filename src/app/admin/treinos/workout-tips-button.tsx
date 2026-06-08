"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { transcribeWorkoutTips, saveWorkoutTips } from "../actions";

interface Props {
  workout: {
    id: string;
    title: string;
    coach_tips?: string | null;
    coach_tips_source?: string | null;
  };
}

/**
 * Botão + modal de "Dicas do profissional" de um vídeo.
 * - "Transcrever do YouTube": puxa a legenda e resume por IA (preenche o texto).
 * - Edição manual + "Salvar": rede de segurança quando não há legenda.
 */
export function WorkoutTipsButton({ workout }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tips, setTips] = useState(workout.coach_tips ?? "");
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasTips = !!(workout.coach_tips && workout.coach_tips.trim());

  async function handleTranscribe() {
    setTranscribing(true);
    try {
      const res = await transcribeWorkoutTips(workout.id);
      setTips(res.tips);
      toast.success("Dicas extraídas da legenda do vídeo! Revise e salve.");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao transcrever",
        { duration: 8000 },
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveWorkoutTips(workout.id, tips);
      toast.success("Dicas salvas");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-bg-2 border border-gray-4 hover:border-pink hover:text-pink text-gray-2 transition-all relative"
        title="Dicas do profissional"
        aria-label="Dicas do profissional"
      >
        <Lightbulb size={15} />
        {hasTips && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pink" />
        )}
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 w-[95vw] sm:w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            DICAS DO PROFISSIONAL
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-[13px] text-gray-2">
            Dicas de execução que aparecem pro aluno junto do vídeo de{" "}
            <span className="text-pink">{workout.title}</span>.
          </p>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleTranscribe}
            disabled={transcribing}
            className="gap-2"
          >
            {transcribing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {transcribing ? "Transcrevendo..." : "Transcrever do YouTube"}
          </Button>

          <textarea
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            rows={8}
            placeholder={"• Na subida, contraia o glúteo\n• Não trave o joelho\n• Desça controlando o movimento"}
            className="w-full bg-bg-2 border border-gray-4 rounded-[10px] text-white text-[14px] px-3 py-2.5 outline-none focus:border-pink resize-y leading-relaxed"
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar dicas"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
