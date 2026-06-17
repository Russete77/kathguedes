"use client";

import { useState } from "react";
import { Store, Pencil, Trash2, MessageCircle, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { deletePartnerStore, togglePartnerStoreActive } from "@/app/admin/actions";
import type { PartnerStoreClickStats } from "@/app/admin/actions";
import { PartnerStoreForm } from "./partner-store-form";

interface PartnerStore {
  id: string;
  name: string;
  whatsapp_number: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

function formatWhatsApp(number: string) {
  // Ex: 5511999999999 → +55 (11) 99999-9999
  const d = number.replace(/\D/g, "");
  if (d.length === 13) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return `+${d}`;
}

export function PartnerStoreList({
  stores,
  clickStats = {},
}: {
  stores: PartnerStore[];
  clickStats?: Record<string, PartnerStoreClickStats>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deletar "${name}"? Os produtos vinculados ficarão sem parceiro.`)) return;
    setDeletingId(id);
    try {
      await deletePartnerStore(id);
      toast.success("Loja parceira removida.");
    } catch {
      toast.error("Erro ao remover loja parceira.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setTogglingId(id);
    try {
      await togglePartnerStoreActive(id, !current);
      toast.success(!current ? "Loja ativada." : "Loja desativada.");
    } catch {
      toast.error("Erro ao alterar status.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {stores.map((store) => (
        <div
          key={store.id}
          className="flex items-center gap-4 bg-bg-1 border border-gray-4 rounded-[18px] px-5 py-4"
        >
          {/* Logo ou ícone fallback */}
          <div className="w-10 h-10 rounded-xl bg-bg-2 border border-gray-4 flex items-center justify-center shrink-0 overflow-hidden">
            {store.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logo_url}
                alt={store.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <Store size={18} className="stroke-gray-3" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm truncate">{store.name}</span>
              {!store.is_active && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-3 bg-bg-3 border border-gray-4 px-2 py-0.5 rounded-full">
                  Inativo
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-1.5">
                <MessageCircle size={12} className="stroke-success shrink-0" />
                <span className="font-mono text-xs text-gray-2">
                  {formatWhatsApp(store.whatsapp_number)}
                </span>
              </div>
              {(() => {
                const s = clickStats[store.id];
                const total = s?.clicks_total ?? 0;
                const last7 = s?.clicks_7d ?? 0;
                return (
                  <div
                    className="flex items-center gap-1.5"
                    title={
                      s?.last_click_at
                        ? `Último clique: ${new Date(s.last_click_at).toLocaleString("pt-BR")}`
                        : "Nenhum clique ainda"
                    }
                  >
                    <MousePointerClick size={12} className="stroke-pink shrink-0" />
                    <span className="font-mono text-xs text-gray-2">
                      {total.toLocaleString("pt-BR")} cliques
                      {last7 > 0 && (
                        <span className="text-gray-3">
                          {" "}
                          ({last7} em 7d)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleToggle(store.id, store.is_active)}
              disabled={togglingId === store.id}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                store.is_active
                  ? "border-gray-4 text-gray-2 hover:border-gray-3 hover:text-white"
                  : "border-success/40 text-success hover:bg-success/10"
              }`}
            >
              {togglingId === store.id ? "..." : store.is_active ? "Desativar" : "Ativar"}
            </button>

            <PartnerStoreForm store={store}>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-2 border border-gray-4 text-gray-2 hover:text-white hover:border-gray-3 transition-colors"
                aria-label="Editar"
              >
                <Pencil size={13} />
              </button>
            </PartnerStoreForm>

            <button
              type="button"
              onClick={() => handleDelete(store.id, store.name)}
              disabled={deletingId === store.id}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-2 border border-gray-4 text-gray-2 hover:text-red-400 hover:border-red-400/40 transition-colors"
              aria-label="Deletar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
