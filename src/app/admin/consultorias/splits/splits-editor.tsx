"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTrainingSplit, type TrainingSplit } from "./actions";

// Frequências cobertas (2 a 7 treinos/semana).
const FREQUENCIES = [2, 3, 4, 5, 6, 7];

export function SplitsEditor({ initial }: { initial: TrainingSplit[] }) {
  const router = useRouter();
  const byFreq = new Map(initial.map((s) => [s.frequency, s]));

  return (
    <div className="space-y-4">
      {FREQUENCIES.map((freq) => (
        <SplitRow key={freq} frequency={freq} current={byFreq.get(freq)} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}

function SplitRow({
  frequency,
  current,
  onSaved,
}: {
  frequency: number;
  current?: TrainingSplit;
  onSaved: () => void;
}) {
  const [slots, setSlots] = useState((current?.slots ?? []).join(", "));
  const [label, setLabel] = useState(current?.label ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveTrainingSplit({ frequency, slots, label });
      toast.success(`Split de ${frequency}x salvo!`, {
        style: { borderLeft: "3px solid #00FF88" },
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const count = slots.split(",").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-white">
          {frequency}× <span className="text-gray-3 text-sm">por semana</span>
        </h3>
        <span className="font-mono text-[11px] text-gray-3">
          {count} dia(s){count !== frequency ? ` · esperado ${frequency}` : ""}
        </span>
      </div>
      <Input
        label="Dias da divisão (separados por vírgula)"
        value={slots}
        onChange={(e) => setSlots(e.target.value)}
        placeholder="ex: gluteo, superior, quadriceps, posterior"
      />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Input
            label="Nome (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex: Foco em glúteo 4x"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
