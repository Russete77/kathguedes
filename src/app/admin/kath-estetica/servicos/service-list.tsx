"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { deleteService } from "../actions";
import { toast } from "sonner";
import { ServiceForm } from "./service-form";
import { formatPrice } from "@/lib/estetica/types";

interface Service {
  id: string;
  title: string;
  category: string;
  duration_min: number;
  price_cents: number;
  compare_price: number | null;
  is_active: boolean;
  eligible_for_loyalty: boolean;
  cost_cents: number;
  requires_paid_plan: boolean;
  includes: string[];
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

export function ServiceList({ services }: { services: Service[] }) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir "${title}"?\n\nServiços com agendamentos vinculados serão desativados em vez de apagados (para preservar histórico).`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await deleteService(id);
        if (res.mode === "hard") {
          toast.success(`"${title}" excluído`);
        } else {
          toast.success(
            `"${title}" tem agendamentos vinculados — foi desativado em vez de excluído.`,
            { duration: 6000 },
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir", {
          duration: 6000,
        });
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-16 bg-bg-1 border border-gray-4 rounded-[22px]">
        <p className="text-gray-2">Nenhum serviço cadastrado.</p>
      </div>
    );
  }

  return (
    <>
      {/* MOBILE: cards verticais (< sm) */}
      <div className="sm:hidden space-y-3">
        {services.map((s) => {
          const isDeleting = deletingId === s.id && pending;
          return (
            <div
              key={s.id}
              className="bg-bg-1 border border-gray-4 rounded-[18px] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold leading-tight truncate">
                    {s.title}
                  </div>
                  <div className="text-[11px] text-gray-3 uppercase tracking-wider mt-0.5">
                    {s.category} · {s.duration_min} min
                  </div>
                </div>
                <Badge variant={s.is_active ? "pink" : "dark"}>
                  {s.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-4">
                <span className="font-display text-xl text-pink">
                  {formatPrice(s.price_cents)}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    aria-label="Editar"
                    className="text-gray-2 hover:text-pink p-2 -mr-1 inline-flex items-center justify-center rounded-md hover:bg-bg-2"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.title)}
                    disabled={isDeleting}
                    aria-label="Excluir"
                    className="text-gray-2 hover:text-danger p-2 inline-flex items-center justify-center rounded-md hover:bg-bg-2 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP: tabela (>= sm) com scroll horizontal de fallback */}
      <div className="hidden sm:block bg-bg-1 border border-gray-4 rounded-[22px] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-bg-2">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Serviço</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Categoria</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Duração</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Preço base</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Status</th>
              <th className="px-4 py-3 w-0" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const isDeleting = deletingId === s.id && pending;
              return (
                <tr key={s.id} className="border-t border-gray-4">
                  <td className="px-4 py-3 text-white font-semibold">{s.title}</td>
                  <td className="px-4 py-3 text-gray-2">{s.category}</td>
                  <td className="px-4 py-3 text-gray-2 font-mono whitespace-nowrap">
                    {s.duration_min} min
                  </td>
                  <td className="px-4 py-3 text-pink font-mono whitespace-nowrap">
                    {formatPrice(s.price_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.is_active ? "pink" : "dark"}>
                      {s.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        aria-label="Editar"
                        className="text-gray-2 hover:text-pink p-2 inline-flex items-center justify-center rounded-md hover:bg-bg-2"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id, s.title)}
                        disabled={isDeleting}
                        aria-label="Excluir"
                        className="text-gray-2 hover:text-danger p-2 inline-flex items-center justify-center rounded-md hover:bg-bg-2 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de edição — renderizado FORA da lista, com defaultOpen + onClose
          (correção do bug onde o EditWrapper antigo era um <div onClick={onClose}>
          que fechava qualquer interação e não abria o modal interno do ServiceForm). */}
      {editing && (
        <ServiceForm
          key={editing.id}
          initial={editing}
          defaultOpen
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
