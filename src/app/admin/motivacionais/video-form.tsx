"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMotivationalVideo, updateMotivationalVideo } from "./actions";

interface VideoInitial {
  id: string;
  title: string;
  body: string | null;
  youtube_id: string;
  sort_order: number;
  is_active: boolean;
}

export function VideoForm({
  initial,
  trigger,
  onClose,
}: {
  initial?: VideoInitial;
  trigger?: React.ReactNode;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initial !== undefined && onClose === undefined ? false : !!onClose);
  const [pending, startTransition] = useTransition();
  const editing = !!initial;

  function close() {
    setOpen(false);
    onClose?.();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (editing && initial) {
          await updateMotivationalVideo(initial.id, fd);
        } else {
          await createMotivationalVideo(fd);
        }
        toast.success(editing ? "Vídeo atualizado" : "Vídeo adicionado");
        close();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all"
      >
        {trigger ?? (
          <>
            <Plus size={16} />
            Novo vídeo
          </>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-bg-1 border border-gray-4 rounded-[22px] p-4 sm:p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl sm:text-2xl text-white">
            {editing ? "EDITAR" : "NOVO"} VÍDEO
          </h2>
          <button
            type="button"
            onClick={close}
            className="text-gray-2 hover:text-pink p-1 -m-1 rounded-md hover:bg-bg-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <Field
          label="Título"
          name="title"
          defaultValue={initial?.title}
          placeholder="Ex.: Comece o dia com foco"
          required
        />

        <Field
          label="Mensagem do push (opcional)"
          name="body"
          defaultValue={initial?.body || ""}
          placeholder="Texto curto que vai aparecer abaixo do título"
          textarea
        />

        <Field
          label="Link do YouTube"
          name="youtube_id"
          defaultValue={initial?.youtube_id}
          placeholder="URL completa, youtu.be ou só o ID"
          hint="Qualquer formato — o sistema extrai o ID automaticamente"
          required
        />

        {initial?.youtube_id && (
          <div className="bg-bg-2 border border-gray-4 rounded-[12px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${initial.youtube_id}/hqdefault.jpg`}
              alt="thumbnail atual"
              className="w-full aspect-video object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Ordem"
            name="sort_order"
            type="number"
            defaultValue={initial?.sort_order ?? 0}
            hint="Menor = mais cedo na rotação"
          />
          <label className="flex items-end gap-2 pb-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={initial?.is_active ?? true}
              className="w-4 h-4 accent-pink"
            />
            <span className="text-white text-sm">Ativo na rotação</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Salvando...
              </>
            ) : editing ? (
              "Salvar alterações"
            ) : (
              "Adicionar vídeo"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  textarea = false,
  required = false,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gray-3">
        {label}
        {required && <span className="text-pink ml-1">*</span>}
      </span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue as string | undefined}
          placeholder={placeholder}
          rows={2}
          className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none resize-none focus:border-pink placeholder:text-gray-3"
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className="w-full mt-1.5 bg-bg-2 border border-gray-4 rounded-[10px] text-white text-sm px-3 py-2.5 outline-none focus:border-pink placeholder:text-gray-3"
        />
      )}
      {hint && <span className="text-[11px] text-gray-3 mt-1 block">{hint}</span>}
    </label>
  );
}
