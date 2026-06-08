"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertTriangle, ClipboardList, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deliverConsultationsBatch, type ReviewItem } from "./actions";

type Stage = "ai_draft" | "building" | "awaiting_anamnese";

function stageOf(c: ReviewItem): Stage {
  if (!c.has_anamnesis || c.status === "pending") return "awaiting_anamnese";
  if (c.ai_draft_generated_at) return "ai_draft";
  return "building";
}

const STAGE_META: Record<Stage, { label: string; variant: "pink" | "yellow" | "dark" }> = {
  ai_draft: { label: "Rascunho IA", variant: "pink" },
  building: { label: "Em montagem", variant: "dark" },
  awaiting_anamnese: { label: "Anamnese pendente", variant: "yellow" },
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "ai_draft", label: "Rascunho IA" },
  { value: "building", label: "Em montagem" },
  { value: "awaiting_anamnese", label: "Anamnese pendente" },
];

export function ReviewInbox({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const withStage = useMemo(
    () => items.map((c) => ({ ...c, stage: stageOf(c) })),
    [items],
  );

  const metrics = useMemo(
    () => ({
      total: withStage.length,
      aiDraft: withStage.filter((c) => c.stage === "ai_draft").length,
      withFlags: withStage.filter((c) => c.flags.length > 0).length,
      awaiting: withStage.filter((c) => c.stage === "awaiting_anamnese").length,
    }),
    [withStage],
  );

  const filtered =
    filter === "all" ? withStage : withStage.filter((c) => c.stage === filter);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deliver(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const r = await deliverConsultationsBatch({ ids });
      toast.success(`${r.delivered} consultoria(s) entregue(s).`, {
        style: { borderLeft: "3px solid #00FF88" },
      });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao entregar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Na fila" value={metrics.total} />
        <Metric label="Rascunho IA" value={metrics.aiDraft} accent />
        <Metric label="Com atenção" value={metrics.withFlags} />
        <Metric label="Anamnese pendente" value={metrics.awaiting} />
      </div>

      {/* Filtros + ação em lote */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.06em] transition-all border ${
                filter === f.value
                  ? "bg-pink text-white border-pink"
                  : "bg-bg-1 text-gray-3 border-gray-4 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <Button onClick={() => deliver(Array.from(selected))} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin mr-1" /> : <CheckCircle2 size={16} className="mr-1" />}
            Entregar {selected.size} selecionada(s)
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={48} className="stroke-gray-3 mx-auto mb-4" />
          <p className="text-gray-2">Nada na fila com esse filtro.</p>
        </div>
      ) : (
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] divide-y divide-gray-4/40">
          {filtered.map((c) => {
            const meta = STAGE_META[c.stage];
            const isSel = selected.has(c.id);
            return (
              <div
                key={c.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 transition-colors ${
                  isSel ? "bg-pink-dim" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(c.id)}
                  className="accent-pink shrink-0"
                  aria-label={`Selecionar ${c.full_name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[15px] font-medium truncate">
                    {c.full_name}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant={meta.variant} className="text-[10px]">
                      {meta.label}
                    </Badge>
                    {c.flags.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-yellow">
                        <AlertTriangle size={11} />
                        {c.flags.length} atenção
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-gray-3">
                      desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/consultorias/${c.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-pink hover:text-pink-light transition-colors"
                  >
                    {c.stage === "ai_draft" && <Sparkles size={14} />}
                    Revisar
                  </Link>
                  {c.stage !== "awaiting_anamnese" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deliver([c.id])}
                      disabled={busy}
                    >
                      Entregar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4">
      <div className={`font-display text-[28px] leading-none ${accent ? "text-pink" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[12px] text-gray-3 mt-1">{label}</div>
    </div>
  );
}
