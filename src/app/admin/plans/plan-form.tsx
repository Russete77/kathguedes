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

      <div className="rounded-lg border border-gray-4 p-3 grid gap-3">
        <span className="text-xs font-semibold text-pink uppercase tracking-wide">Semestral (6 meses)</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-gray-2">/mês (centavos)</span>
            <input
              name="monthly_semestral_cents"
              type="number"
              min={0}
              required
              defaultValue={plan.monthly_semestral_cents}
              className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
            />
            <span className="text-xs text-gray-3">Ex: 3190 = R$ 31,90/mês (só display)</span>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-gray-2">Total à vista (R$)</span>
            <input
              name="asaas_value_semestral"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={plan.asaas_value_semestral}
              className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
            />
            <span className="text-xs text-gray-3">Valor cobrado no Asaas. Ex: 191.40</span>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-4 p-3 grid gap-3">
        <span className="text-xs font-semibold text-pink uppercase tracking-wide">Anual (12 meses)</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-gray-2">/mês (centavos)</span>
            <input
              name="monthly_anual_cents"
              type="number"
              min={0}
              required
              defaultValue={plan.monthly_anual_cents}
              className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
            />
            <span className="text-xs text-gray-3">Ex: 2590 = R$ 25,90/mês. É o &quot;a partir de&quot; do site.</span>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-gray-2">Total à vista (R$)</span>
            <input
              name="asaas_value_anual"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={plan.asaas_value_anual}
              className="bg-bg-2 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
            />
            <span className="text-xs text-gray-3">Valor cobrado no Asaas. Ex: 310.80</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          Chaves: workouts_preview, workouts, diet, supplements, juices,
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
