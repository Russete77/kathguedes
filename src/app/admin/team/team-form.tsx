"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { upsertTeamMember } from "./actions";

export function TeamForm() {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await upsertTeamMember(formData);
        toast.success("Membro salvo");
        const form = document.getElementById("team-form") as HTMLFormElement | null;
        form?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  return (
    <form id="team-form" action={onSubmit} className="grid gap-3 max-w-md">
      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Nome completo</span>
        <input
          name="full_name"
          required
          maxLength={120}
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Email</span>
        <input
          name="email"
          type="email"
          required
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white font-mono text-sm"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Role</span>
        <select
          name="role"
          required
          defaultValue="partner"
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        >
          <option value="partner">Partner</option>
          <option value="consultant">Consultant</option>
          <option value="owner">Owner</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-gray-2">Chave PIX (opcional)</span>
        <input
          name="pix_key"
          maxLength={120}
          className="bg-bg-1 border border-gray-4 rounded-md px-3 py-2 text-white"
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked
          className="accent-pink"
        />
        <span className="text-sm text-gray-1">Ativo</span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar membro"}
      </Button>
    </form>
  );
}
