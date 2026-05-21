"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveAllocations, markAllocationsPaid } from "../actions";

type Allocation = {
  id: string;
  amount_cents: number;
  pct: number;
  team_members: { full_name: string };
  revenue_streams: { type: string; category: string | null; occurred_at: string };
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function CommissionList({
  draftAllocations,
  approvedAllocations,
}: {
  draftAllocations: Allocation[];
  approvedAllocations: Allocation[];
}) {
  const [draftSel, setDraftSel] = useState<Set<string>>(new Set());
  const [approvedSel, setApprovedSel] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string, checked: boolean) {
    const next = new Set(set);
    if (checked) next.add(id);
    else next.delete(id);
    setSet(next);
  }

  function onApprove() {
    if (draftSel.size === 0) return;
    startTransition(async () => {
      try {
        const n = await approveAllocations(Array.from(draftSel));
        toast.success(`${n} alocação(ões) aprovada(s)`);
        setDraftSel(new Set());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao aprovar");
      }
    });
  }

  function onPay(formData: FormData) {
    if (approvedSel.size === 0 || !reference) {
      toast.error("Selecione e informe a referência");
      return;
    }
    formData.delete("ids[]");
    for (const id of approvedSel) formData.append("ids[]", id);
    startTransition(async () => {
      try {
        await markAllocationsPaid(formData);
        toast.success("Allocations marcadas como pagas");
        setApprovedSel(new Set());
        setReference("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao marcar pago");
      }
    });
  }

  return (
    <>
      <Section
        title={`Pendentes — draft (${draftAllocations.length})`}
        items={draftAllocations}
        selected={draftSel}
        onToggle={(id, c) => toggle(draftSel, setDraftSel, id, c)}
      >
        <Button size="sm" onClick={onApprove} disabled={pending || draftSel.size === 0}>
          Aprovar selecionados ({draftSel.size})
        </Button>
      </Section>

      <Section
        title={`Aprovadas — a pagar (${approvedAllocations.length})`}
        items={approvedAllocations}
        selected={approvedSel}
        onToggle={(id, c) => toggle(approvedSel, setApprovedSel, id, c)}
      >
        <form action={onPay} className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Referência do pagamento (ex: PIX 2026-05)"
            className="bg-bg-1 border border-gray-4 rounded-md px-3 py-1.5 text-sm text-white"
            required
            name="reference"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending || approvedSel.size === 0}>
            Marcar como pago ({approvedSel.size})
          </Button>
        </form>
      </Section>
    </>
  );
}

function Section({
  title,
  items,
  selected,
  onToggle,
  children,
}: {
  title: string;
  items: Allocation[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-3">Vazio.</p>
      ) : (
        <div className="rounded-[14px] border border-gray-4 bg-bg-1 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-2 border-b border-gray-4">
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-3">Sócio</th>
                <th className="py-3 px-3">Origem</th>
                <th className="py-3 px-3">Quando</th>
                <th className="py-3 px-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-gray-4">
                  <td className="py-2 px-3">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={(e) => onToggle(a.id, e.target.checked)}
                      className="accent-pink"
                    />
                  </td>
                  <td className="py-2 px-3 text-gray-1">{a.team_members.full_name}</td>
                  <td className="py-2 px-3 text-gray-2">
                    {a.revenue_streams.type}
                    {a.revenue_streams.category ? ` / ${a.revenue_streams.category}` : ""}
                  </td>
                  <td className="py-2 px-3 text-gray-3 text-xs">
                    {new Date(a.revenue_streams.occurred_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-1">
                    {formatBRL(a.amount_cents)} <span className="text-xs text-gray-3">({a.pct}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
