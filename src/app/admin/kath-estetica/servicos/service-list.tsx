"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Loader2, ChevronDown } from "lucide-react";
import { deleteService } from "../actions";
import { toast } from "sonner";
import { ServiceForm } from "./service-form";
import { formatPrice } from "@/lib/estetica/types";
import { PricingMatrix } from "../precos/pricing-matrix";
import type {
  EsteticaVehicleType,
  ServicePricing,
} from "@/lib/estetica/pricing-types";
import { cn } from "@/lib/utils";

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
  slug: string | null;
}

export function ServiceList({
  services,
  vehicleTypes,
  pricingByService,
}: {
  services: Service[];
  vehicleTypes: EsteticaVehicleType[];
  pricingByService: Record<string, ServicePricing>;
}) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir "${title}"?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteService(id);
        toast.success("Serviço excluído");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
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
      <div className="space-y-3">
        {services.map((s) => {
          const isOpen = expanded[s.id] ?? false;
          const isDeleting = deletingId === s.id && pending;
          const pricing = pricingByService[s.id];
          const matrixCount = pricing?.options?.length ?? 0;
          const requiresPrepay = pricing?.payment_rule?.require_app_prepay ?? false;
          const prepayPct = pricing?.payment_rule?.prepay_pct ?? 0;
          return (
            <article
              key={s.id}
              className="bg-bg-1 border border-gray-4 rounded-[18px] overflow-hidden"
            >
              {/* HEADER do card — info básica + ações + toggle expand */}
              <header className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-white font-semibold leading-tight truncate text-base sm:text-lg">
                      {s.title}
                    </h2>
                    <div className="text-[11px] text-gray-3 uppercase tracking-wider mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{s.category}</span>
                      <span>·</span>
                      <span>{s.duration_min} min</span>
                      {s.slug && (
                        <>
                          <span>·</span>
                          <span className="font-mono normal-case">/{s.slug}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant={s.is_active ? "pink" : "dark"}>
                    {s.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-xl text-pink">
                      {formatPrice(s.price_cents)}
                    </span>
                    <span className="text-[11px] text-gray-3 uppercase tracking-wider">
                      base
                    </span>
                    {matrixCount > 0 && (
                      <span className="text-[11px] text-gray-3">
                        · {matrixCount} {matrixCount === 1 ? "tipo" : "tipos"} de moto
                      </span>
                    )}
                    {requiresPrepay && (
                      <span className="text-[11px] text-pink font-mono">
                        · sinal {prepayPct}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s.id)}
                      aria-label={isOpen ? "Recolher preços" : "Configurar preços"}
                      aria-expanded={isOpen}
                      className="text-gray-2 hover:text-pink px-2 py-2 inline-flex items-center gap-1 rounded-md hover:bg-bg-2 text-[12px] font-mono uppercase tracking-wider"
                    >
                      Preços
                      <ChevronDown
                        size={14}
                        className={cn(
                          "transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      aria-label="Editar"
                      className="text-gray-2 hover:text-pink p-2 inline-flex items-center justify-center rounded-md hover:bg-bg-2"
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
              </header>

              {/* CORPO expansível — matriz de preços + payment rule */}
              {isOpen && (
                <div className="bg-bg-2/40 border-t border-gray-4 p-3 sm:p-4">
                  <PricingMatrix
                    service={{
                      id: s.id,
                      title: s.title,
                      category: s.category,
                      duration_min: s.duration_min,
                      slug: s.slug,
                    }}
                    vehicleTypes={vehicleTypes}
                    initial={pricing}
                    showHeader={false}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>

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
