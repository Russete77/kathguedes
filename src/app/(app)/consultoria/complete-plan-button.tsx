"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Flame, Loader2 } from "lucide-react";

interface Props {
  /** Se o aluno já registrou treino hoje (vindo do last_workout_at). */
  completedToday: boolean;
  initialStreak: number;
}

/**
 * Botão "Treinei hoje" no plano da consultoria — registra o treino do dia e
 * mantém o streak (mesma lógica da biblioteca, via /api/consultoria/complete-day).
 */
export function CompletePlanButton({ completedToday, initialStreak }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(completedToday);
  const [streak, setStreak] = useState(initialStreak);
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/consultoria/complete-day", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao registrar");
      const data = (await res.json()) as { streak?: number };
      setDone(true);
      if (typeof data.streak === "number") setStreak(data.streak);
      toast.success("Treino registrado! 🔥", {
        style: { borderLeft: "3px solid #00FF88" },
      });
      router.refresh();
    } catch {
      toast.error("Não consegui registrar agora. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/30 text-success text-sm font-semibold">
        <CheckCircle2 size={16} />
        Treino de hoje registrado
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 text-pink ml-1">
            <Flame size={14} /> {streak}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-pink hover:bg-pink/90 text-white text-sm font-semibold transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
      Treinei hoje
    </button>
  );
}
