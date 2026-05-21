"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushSubscribe } from "@/hooks/use-push-subscribe";
import { Button } from "@/components/ui/button";

const VISIT_KEY = "kath:visit_count";
const DISMISSED_KEY = "kath:push_prompt_dismissed_at";
const MIN_VISITS = 2; // Só pede push depois da 2ª visita
const RE_PROMPT_AFTER_DAYS = 30; // Se dispensar, pergunta de novo só após 30 dias

/**
 * Prompt sutil para opt-in de push notifications.
 * Aparece após >= 2 visitas, se permissão ainda é "default" e usuário não dispensou recentemente.
 * Monta no (app)/layout.tsx — só usuários autenticados e onboarded chegam aqui.
 */
export function PushPrompt() {
  const { permission, subscribe } = usePushSubscribe();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (permission !== "default") return; // já decidiu (granted/denied) — não pedir de novo

    // Incrementar contador de visita
    const raw = Number(localStorage.getItem(VISIT_KEY) ?? "0");
    const visits = raw + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    // Verificar dismissal recente
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / 86400_000;
      if (days < RE_PROMPT_AFTER_DAYS) return;
    }

    if (visits >= MIN_VISITS) {
      // Pequeno delay pra não poluir o primeiro render
      const t = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(t);
    }
  }, [permission]);

  const handleEnable = async () => {
    setBusy(true);
    const ok = await subscribe();
    setBusy(false);
    if (ok) {
      setShow(false);
    } else {
      // Permission denied ou erro — não insistir
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Habilitar notificações"
      className="fixed bottom-24 left-4 right-4 z-50 max-w-sm mx-auto bg-bg-1 border border-pink/30 rounded-[14px] p-4 shadow-pink"
    >
      <button
        onClick={handleDismiss}
        aria-label="Fechar"
        className="absolute top-3 right-3 text-gray-3 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 bg-pink-dim border border-pink/30 rounded-[10px] flex items-center justify-center shrink-0">
          <Bell size={18} className="stroke-pink" />
        </div>
        <div className="flex-1">
          <div className="font-display text-[18px] text-white leading-tight mb-1">
            ATIVE OS AVISOS
          </div>
          <p className="text-[12.5px] text-gray-2 leading-relaxed mb-3">
            Receba novos treinos, cupons flash e atualizações da sua consultoria.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={busy} className="flex-1">
              {busy ? "Ativando..." : "Ativar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={busy}>
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
