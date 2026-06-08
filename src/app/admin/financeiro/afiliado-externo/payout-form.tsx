"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recordAffiliatePayout } from "../actions";

export function PayoutForm() {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await recordAffiliatePayout(formData);
        toast.success("Payout registrado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registrar");
      }
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3 max-w-md">
      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Plataforma</span>
        <select
          name="platform"
          required
          defaultValue="amazon"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        >
          <option value="amazon">Amazon</option>
          <option value="mercadolivre">Mercado Livre</option>
          <option value="shopee">Shopee</option>
          <option value="direto">Direto</option>
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Mês de competência (YYYY-MM)</span>
        <input
          name="year_month"
          required
          pattern="\d{4}-\d{2}"
          placeholder="2026-04"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Valor recebido (centavos)</span>
        <input
          name="amount_cents"
          type="number"
          min={1}
          required
          placeholder="ex: 420000 = R$ 4.200,00"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
        />
      </label>

      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="text-xs text-gray-2 mb-1">Slice por módulo (% — soma 100)</legend>
        <input
          name="fitness_pct"
          type="number"
          step="0.01"
          min={0}
          max={100}
          required
          placeholder="Fitness %"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        />
        <input
          name="moto_pct"
          type="number"
          step="0.01"
          min={0}
          max={100}
          required
          placeholder="Moto %"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        />
        <input
          name="geral_pct"
          type="number"
          step="0.01"
          min={0}
          max={100}
          required
          placeholder="Geral %"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        />
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Registrando..." : "Registrar payout"}
      </Button>
    </form>
  );
}
