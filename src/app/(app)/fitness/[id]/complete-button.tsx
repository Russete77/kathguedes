"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  workoutId: string;
  alreadyCompleted?: boolean;
}

export function CompleteWorkoutButton({ workoutId, alreadyCompleted = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyCompleted);

  async function handleComplete() {
    setLoading(true);
    try {
      const res = await fetch("/api/workout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId }),
      });
      const data = await res.json();

      if (res.ok) {
        setDone(true);
        toast.success("Treino concluído!", {
          description: `+1 dia no streak · ${data.streak} dias consecutivos`,
          style: { borderLeft: "3px solid #00FF88" },
        });
      } else {
        toast.error(data.error || "Erro ao completar treino");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-success border-success/25 shrink-0">
        <Check size={16} className="stroke-success" />
        Concluído
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={handleComplete} disabled={loading} className="shrink-0">
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Check size={16} />
      )}
      {loading ? "Salvando..." : "Completar Treino"}
    </Button>
  );
}
