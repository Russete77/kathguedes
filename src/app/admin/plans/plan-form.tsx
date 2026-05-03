"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/billing/plans";
import { updatePlan } from "./actions";

export function PlanForm({ plan }: { plan: Plan }) {
  const [features, setFeatures] = useState(JSON.stringify(plan.features, null, 2));
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updatePlan(formData);
        toast.success(`${plan.name} atualizado`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3">
      <input type="hidden" name="slug" value={plan.slug} />
      <input type="hidden" name="features_json" value={features} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Nome exibido</span>
          <input
            name="name"
            required
            defaultValue={plan.name}
            maxLength={120}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Descricao Asaas</span>
          <input
            name="asaas_description"
            defaultValue={plan.asaas_description}
            maxLength={200}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Preco (centavos)</span>
          <input
            name="price_cents"
            type="number"
            min={0}
            required
            defaultValue={plan.price_cents}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
          />
          <span className="text-xs text-gray-3">
            Ex: 9990 = R$ 99,90
          </span>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Asaas value (R$ decimal)</span>
          <input
            name="asaas_value"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={plan.asaas_value}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
          />
          <span className="text-xs text-gray-3">
            Valor enviado ao Asaas. Manter consistente com Preco.
          </span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Cashback %</span>
          <input
            name="cashback_pct"
            type="number"
            step="0.01"
            min={0}
            max={100}
            defaultValue={plan.cashback_pct}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Loja %</span>
          <input
            name="store_discount_pct"
            type="number"
            min={0}
            max={100}
            defaultValue={plan.store_discount_pct}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-gray-2">Estetica %</span>
          <input
            name="estetica_discount_pct"
            type="number"
            min={0}
            max={100}
            defaultValue={plan.estetica_discount_pct}
            className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white"
          />
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Features (JSON)</span>
        <textarea
          rows={6}
          value={features}
          onChange={e => setFeatures(e.target.value)}
          className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono text-xs"
        />
        <span className="text-xs text-gray-3">
          Chaves: workouts_preview, workouts, diet, supplements, juices, estetica_book_all,
          affiliate_clicks_per_month (number ou &quot;unlimited&quot;), chat_sla_h, reavaliation
          (&quot;monthly&quot;|&quot;biweekly&quot;), video_call_per_month
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={plan.is_active}
          className="accent-pink"
        />
        <span className="text-sm text-gray-1">Ativo (aparece na listagem publica)</span>
      </label>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
