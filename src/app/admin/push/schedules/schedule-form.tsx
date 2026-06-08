"use client";

import { useState, ReactNode } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { upsertSchedule, type ScheduleRow } from "./actions";

interface Props {
  schedule?: ScheduleRow;
  children?: ReactNode;
}

export function ScheduleForm({ schedule, children }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      if (schedule?.id) formData.append("id", schedule.id);
      await upsertSchedule(formData);
      toast.success(schedule ? "Schedule atualizado" : "Schedule criado");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>
      ) : (
        <DialogTrigger className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer">
          <Plus size={16} className="mr-1" />
          Novo schedule
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{schedule ? "Editar schedule" : "Novo schedule"}</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Slug"
              name="slug"
              defaultValue={schedule?.slug ?? ""}
              placeholder="hidratacao"
              required
              hint="minusculas, números, hífen"
            />
            <Input
              label="Categoria"
              name="category"
              defaultValue={schedule?.category ?? "geral"}
              placeholder="motivacional"
              required
            />
          </div>

          <Input
            label="Título"
            name="title"
            defaultValue={schedule?.title ?? ""}
            placeholder="Hora da água"
            required
          />

          <div>
            <label className="text-xs text-gray-3 block mb-1">Corpo</label>
            <textarea
              name="body"
              defaultValue={schedule?.body ?? ""}
              className="w-full bg-bg-1 border border-gray-4 text-white rounded-md px-3 py-2 text-sm"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ícone (lucide name)"
              name="icon"
              defaultValue={schedule?.icon ?? ""}
              placeholder="Droplets"
            />
            <Input
              label="URL ao clicar"
              name="url"
              defaultValue={schedule?.url ?? "/dashboard"}
              required
            />
          </div>

          <Input
            label="Horários (CSV HH:MM)"
            name="times_csv"
            defaultValue={(schedule?.times ?? ["08:00"]).join(", ")}
            placeholder="09:00, 12:00, 15:00, 18:00"
            required
            hint="Separe por vírgula"
          />

          <Input
            label="Planos elegíveis (CSV, vazio = todos)"
            name="eligible_plans_csv"
            defaultValue={(schedule?.eligible_plans ?? []).join(", ")}
            placeholder="saude_completa, atleta"
            hint="start, evolucao, saude_completa, atleta"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ordem"
              name="sort_order"
              type="number"
              defaultValue={schedule?.sort_order ?? 0}
            />
            <div className="flex flex-col gap-2 pt-5">
              <label className="flex items-center gap-2 text-sm text-gray-1">
                <input
                  type="checkbox"
                  name="default_enabled"
                  defaultChecked={schedule?.default_enabled ?? true}
                  className="w-4 h-4"
                />
                Vem ligado por padrão
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-1">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={schedule?.is_active ?? true}
                  className="w-4 h-4"
                />
                Schedule ativo
              </label>
            </div>
          </div>

          <Input
            label="Descrição (admin only)"
            name="description"
            defaultValue={schedule?.description ?? ""}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando…" : schedule ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
