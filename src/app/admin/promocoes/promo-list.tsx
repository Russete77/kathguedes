"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Edit2, Power, RotateCcw } from "lucide-react";
import {
  togglePromoActive,
  resetPromoCounter,
  type PromoCodeRow,
} from "./actions";
import { PromoForm } from "./promo-form";

const TIER_LABELS: Record<string, string> = {
  start: "Treino",
  evolucao: "Evolução",
  saude_completa: "Saúde Completa",
  atleta: "Atleta",
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PromoList({ codes }: { codes: PromoCodeRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (codes.length === 0) {
    return (
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-10 text-center">
        <p className="text-gray-2">
          Nenhuma promoção cadastrada. Clique em <span className="text-pink">Nova promoção</span>.
        </p>
      </div>
    );
  }

  async function handleToggle(id: string, current: boolean) {
    setBusyId(id);
    try {
      await togglePromoActive(id, !current);
      toast.success(current ? "Promoção desativada" : "Promoção reativada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReset(id: string) {
    if (!confirm("Zerar o contador de usos? Os 15 slots voltam a estar disponíveis.")) return;
    setBusyId(id);
    try {
      await resetPromoCounter(id);
      toast.success("Contador zerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao zerar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-2">
            <tr className="text-left text-gray-3 uppercase text-[11px] tracking-wider">
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3 text-right">Valor promo</th>
              <th className="px-4 py-3 text-right">Desconto</th>
              <th className="px-4 py-3 text-center">Usos</th>
              <th className="px-4 py-3 text-center">Ativo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => {
              const remaining = c.max_uses - c.uses_count;
              const exhausted = remaining <= 0;
              return (
                <tr key={c.id} className="border-t border-gray-4">
                  <td className="px-4 py-3 font-mono text-white">{c.slug}</td>
                  <td className="px-4 py-3 text-gray-1">{TIER_LABELS[c.plan_tier] ?? c.plan_tier}</td>
                  <td className="px-4 py-3 text-right text-white">
                    {fmtBRL(c.promo_value_cents)}
                  </td>
                  <td className="px-4 py-3 text-right text-pink">
                    -{fmtBRL(c.discount_cents)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        exhausted
                          ? "text-red-400 font-mono"
                          : remaining <= 3
                            ? "text-yellow-400 font-mono"
                            : "text-green-400 font-mono"
                      }
                    >
                      {c.uses_count} / {c.max_uses}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        c.is_active ? "bg-green-400/20 text-green-400" : "bg-gray-4 text-gray-2"
                      }`}
                    >
                      {c.is_active ? "ON" : "OFF"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <PromoForm code={c}>
                        <button
                          type="button"
                          className="p-2 text-gray-2 hover:text-pink rounded"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                      </PromoForm>
                      <button
                        type="button"
                        onClick={() => handleToggle(c.id, c.is_active)}
                        disabled={busyId === c.id}
                        className="p-2 text-gray-2 hover:text-pink rounded disabled:opacity-40"
                        title={c.is_active ? "Desativar" : "Reativar"}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReset(c.id)}
                        disabled={busyId === c.id}
                        className="p-2 text-gray-2 hover:text-pink rounded disabled:opacity-40"
                        title="Zerar contador"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
