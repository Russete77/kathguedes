"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteService(id);
        toast.success("Serviço excluído");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
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
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-2">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Serviço</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Categoria</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Duração</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Preço</th>
              <th className="px-4 py-3 font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">Status</th>
              <th className="px-4 py-3 w-0" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-t border-gray-4">
                <td className="px-4 py-3 text-white font-semibold">{s.title}</td>
                <td className="px-4 py-3 text-gray-2">{s.category}</td>
                <td className="px-4 py-3 text-gray-2 font-mono">{s.duration_min} min</td>
                <td className="px-4 py-3 text-pink font-mono">{formatPrice(s.price_cents)}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.is_active ? "pink" : "dark"}>
                    {s.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(s)}
                      className="text-gray-2 hover:text-pink p-1.5"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.title)}
                      disabled={pending}
                      className="text-gray-2 hover:text-danger p-1.5"
                    >
                      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditWrapper service={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function EditWrapper({ service, onClose }: { service: Service; onClose: () => void }) {
  return (
    <div onClick={onClose}>
      <ServiceForm initial={service} />
    </div>
  );
}
