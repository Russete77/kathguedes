"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Check } from "lucide-react";
import { notifyAnamnesePending } from "./notify-actions";

export function NotifyAnamneseButton({ consultationId }: { consultationId: string }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <button
      type="button"
      disabled={pending || sent}
      onClick={() =>
        start(async () => {
          try {
            await notifyAnamnesePending(consultationId);
            setSent(true);
            toast.success("Aluno notificado!");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao notificar");
          }
        })
      }
      className="shrink-0 self-start sm:self-auto inline-flex items-center justify-center gap-1.5 bg-yellow/15 hover:bg-yellow/25 border border-yellow/40 text-yellow text-[13px] font-semibold rounded-full px-4 py-2 transition-colors disabled:opacity-60"
    >
      {sent ? (
        <>
          <Check size={14} /> Notificado
        </>
      ) : (
        <>
          <Bell size={14} /> {pending ? "Enviando..." : "Notificar aluno"}
        </>
      )}
    </button>
  );
}
