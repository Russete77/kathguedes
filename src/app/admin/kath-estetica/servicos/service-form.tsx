"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { createService, updateService } from "../actions";
import { toast } from "sonner";

interface ServiceRow {
  id?: string;
  title?: string;
  description?: string | null;
  image_url?: string | null;
  category?: string;
  duration_min?: number;
  price_cents?: number;
  compare_price?: number | null;
  discount_start?: number;
  discount_pro?: number;
  discount_vip?: number;
  includes?: string[];
  eligible_for_loyalty?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export function ServiceForm({ initial }: { initial?: ServiceRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = !!initial?.id;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (editing && initial?.id) {
          await updateService(initial.id, fd);
        } else {
          await createService(fd);
        }
        toast.success(editing ? "Serviço atualizado" : "Serviço criado");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        {editing ? "Editar" : "Novo serviço"}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-bg-1 border border-gray-4 rounded-[22px] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4"
      >
        <h2 className="font-display text-2xl text-white">
          {editing ? "EDITAR" : "NOVO"} SERVIÇO
        </h2>

        <Field label="Título" name="title" defaultValue={initial?.title} required />
        <Field label="Descrição" name="description" textarea defaultValue={initial?.description || ""} />
        <Field label="URL da imagem" name="image_url" defaultValue={initial?.image_url || ""} />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Categoria"
            name="category"
            defaultValue={initial?.category || "lavagem"}
            options={[
              { value: "lavagem", label: "Lavagem" },
              { value: "polimento", label: "Polimento" },
              { value: "vitrificacao", label: "Vitrificação" },
              { value: "higienizacao", label: "Higienização" },
              { value: "cristalizacao", label: "Cristalização" },
              { value: "outros", label: "Outros" },
            ]}
          />
          <Field
            label="Duração (min)"
            name="duration_min"
            type="number"
            defaultValue={initial?.duration_min || 60}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Preço (R$)"
            name="price_reais"
            type="number"
            step="0.01"
            defaultValue={initial?.price_cents ? (initial.price_cents / 100).toString() : ""}
            required
          />
          <Field
            label='Preço "de" (R$)'
            name="compare_price_reais"
            type="number"
            step="0.01"
            defaultValue={
              initial?.compare_price ? (initial.compare_price / 100).toString() : ""
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Desc. START (%)" name="discount_start" type="number" defaultValue={initial?.discount_start || 0} />
          <Field label="Desc. PRO (%)" name="discount_pro" type="number" defaultValue={initial?.discount_pro || 0} />
          <Field label="Desc. VIP (%)" name="discount_vip" type="number" defaultValue={initial?.discount_vip || 0} />
        </div>

        <Field
          label="Incluso (1 por linha)"
          name="includes"
          textarea
          defaultValue={initial?.includes?.join("\n") || ""}
        />

        <Field label="Ordem" name="sort_order" type="number" defaultValue={initial?.sort_order || 0} />

        <div className="flex gap-4 text-[13px]">
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              name="eligible_for_loyalty"
              defaultChecked={initial?.eligible_for_loyalty ?? true}
              className="w-4 h-4 accent-pink"
            />
            Conta na fidelidade
          </label>
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={initial?.is_active ?? true}
              className="w-4 h-4 accent-pink"
            />
            Ativo
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={pending} className="flex-1">
            {pending && <Loader2 size={14} className="animate-spin" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  textarea,
  ...props
}: {
  label: string;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const base =
    "w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3";
  return (
    <label className="block">
      <span className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase block mb-1">
        {label}
      </span>
      {textarea ? (
        <textarea
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={3}
          className={base + " resize-none"}
        />
      ) : (
        <input {...props} className={base} />
      )}
    </label>
  );
}

function Select({
  label,
  options,
  ...props
}: {
  label: string;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase block mb-1">
        {label}
      </span>
      <select
        {...props}
        className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
