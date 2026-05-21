"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Star } from "lucide-react";
import { createPortfolioItem, deletePortfolioItem } from "../actions";
import { toast } from "sonner";
import type { PortfolioItemRow } from "./page";

interface Props {
  items: PortfolioItemRow[];
  services: { id: string; title: string }[];
}

export function PortfolioManager({ items, services }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createPortfolioItem(fd);
        toast.success("Item adicionado");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este item?")) return;
    startTransition(async () => {
      try {
        await deletePortfolioItem(id);
        toast.success("Excluído");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        Adicionar item
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <form
            onSubmit={handleCreate}
            className="relative bg-bg-1 border border-gray-4 rounded-[22px] p-6 w-full max-w-lg space-y-4"
          >
            <h2 className="font-display text-2xl text-white">NOVO ITEM</h2>
            <Input name="title" placeholder="Título (opcional)" />
            <Input name="before_url" placeholder="URL da foto ANTES" required />
            <Input name="after_url" placeholder="URL da foto DEPOIS" required />
            <select
              name="service_id"
              defaultValue=""
              className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink"
            >
              <option value="">Serviço (opcional)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <textarea
              name="description"
              placeholder="Descrição (opcional)"
              rows={2}
              className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink resize-none"
            />
            <div className="flex gap-4 text-[13px]">
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input type="checkbox" name="is_featured" className="w-4 h-4 accent-pink" />
                Destaque (aparece no hub)
              </label>
            </div>
            <Input name="sort_order" type="number" placeholder="Ordem" defaultValue={0} />
            <div className="flex gap-3">
              <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                {pending && <Loader2 size={14} className="animate-spin" />}
                Criar
              </Button>
            </div>
          </form>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 bg-bg-1 border border-gray-4 rounded-[22px]">
          <p className="text-gray-2">Nenhum item no portfólio.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-0.5 bg-gray-4">
                <div className="relative aspect-square">
                  <Image src={item.before_url} alt="Antes" fill sizes="50vw" className="object-cover" />
                  <Badge variant="dark" className="absolute bottom-2 left-2">ANTES</Badge>
                </div>
                <div className="relative aspect-square">
                  <Image src={item.after_url} alt="Depois" fill sizes="50vw" className="object-cover" />
                  <Badge variant="pink" className="absolute bottom-2 left-2">DEPOIS</Badge>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-sm">
                    {item.title || "Sem título"}
                  </div>
                  {item.is_featured && (
                    <div className="flex items-center gap-1 text-pink text-[11px] mt-1">
                      <Star size={11} />
                      Destaque
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={pending}
                  className="text-gray-2 hover:text-danger p-2"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-bg-2 border border-gray-4 rounded-[8px] text-white text-[14px] px-4 py-3 outline-none focus:border-pink placeholder:text-gray-3"
    />
  );
}
