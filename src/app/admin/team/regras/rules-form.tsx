"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { upsertCommissionRule } from "../actions";

type Member = { id: string; full_name: string };

export function RulesForm({ members }: { members: Member[] }) {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await upsertCommissionRule(formData);
        toast.success("Regra salva");
        const form = document.getElementById("rules-form") as HTMLFormElement | null;
        form?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  return (
    <form id="rules-form" action={onSubmit} className="grid gap-3 max-w-md">
      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Sócio</span>
        <select
          name="team_member_id"
          required
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        >
          {members.length === 0 && <option value="">Nenhum sócio ativo</option>}
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Tipo de receita (vazio = qualquer)</span>
        <select
          name="applies_to_type"
          defaultValue=""
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        >
          <option value="">qualquer</option>
          <option value="mensalidade">mensalidade</option>
          <option value="loja">loja</option>
          <option value="afiliado_externo">afiliado_externo</option>
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-xs text-gray-2">
          Categoria (vazio = qualquer; ex: plano3, fitness, moto)
        </span>
        <input
          name="applies_to_category"
          maxLength={80}
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white font-mono text-sm"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs text-gray-2">% sobre líquido</span>
        <input
          name="pct"
          type="number"
          step="0.01"
          min={0}
          max={100}
          required
          placeholder="ex: 25"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white font-mono"
        />
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_active" defaultChecked className="accent-pink" />
        <span className="text-sm text-gray-1">Ativa</span>
      </label>

      <Button type="submit" disabled={pending || members.length === 0}>
        {pending ? "Salvando..." : "Salvar regra"}
      </Button>
    </form>
  );
}
