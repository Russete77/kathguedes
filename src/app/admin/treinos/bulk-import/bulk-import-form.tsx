"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  parseBulkText,
  commitBulkImport,
  type ParsedExercise,
} from "./actions";

const PLACEHOLDER = `INICIANTE
TREINO 01:
- https://youtube.com/shorts/rr83mNOWE58
- https://youtube.com/shorts/oyCFhXHNWwI
TREINO 02:
- https://youtube.com/shorts/T9cyDNQRAgQ

INTERMEDIARIO
TREINO 01:
- https://youtube.com/shorts/AiSKeBkQH4k

AVANCADO
TREINO 01:
- https://youtube.com/shorts/YvedZPrsj_E
`;

const LEVEL_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediario",
  avancado: "Avancado",
};

export function BulkImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedExercise[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [result, setResult] = useState<
    { inserted: number; skipped: number; errors: string[] } | null
  >(null);

  async function handlePreview() {
    if (!text.trim()) {
      toast.error("Cole a lista de treinos antes");
      return;
    }
    setBusy(true);
    try {
      const r = await parseBulkText(text);
      setParsed(r.exercises);
      setWarnings(r.warnings);
      setResult(null);
      if (r.exercises.length === 0) {
        toast.error("Nenhum video reconhecido. Confira o formato.");
      } else {
        toast.success(`${r.exercises.length} videos prontos para importar`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no parse");
    } finally {
      setBusy(false);
    }
  }

  function requestImport() {
    if (!parsed || parsed.length === 0) return;
    setNeedsConfirm(true);
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setNeedsConfirm(false);
    setBusy(true);
    try {
      const r = await commitBulkImport(parsed);
      setResult({
        inserted: r.inserted,
        skipped: r.skipped_existing,
        errors: r.errors,
      });
      if (r.errors.length > 0) {
        toast.error(
          `Importou ${r.inserted}, ${r.errors.length} erro(s): ${r.errors.join("; ").slice(0, 200)}`,
          { duration: 9000 },
        );
      } else {
        toast.success(
          `${r.inserted} videos criados${r.skipped_existing > 0 ? `, ${r.skipped_existing} ja existiam` : ""}`,
          { duration: 5000 },
        );
        setParsed(null);
        setText("");
        // Força revalidação para /admin/treinos refletir os novos rascunhos
        router.refresh();
      }
    } catch (e) {
      console.error("[bulk import] failed", e);
      toast.error(
        e instanceof Error
          ? `Erro na importacao: ${e.message}`
          : "Erro na importacao",
        { duration: 9000 },
      );
    } finally {
      setBusy(false);
    }
  }

  const byLevelWorkout = parsed
    ? parsed.reduce<Record<string, ParsedExercise[]>>((acc, ex) => {
        const k = `${ex.level}|${ex.workoutNumber}`;
        (acc[k] = acc[k] || []).push(ex);
        return acc;
      }, {})
    : {};

  return (
    <div className="space-y-6">
      {/* Textarea */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 space-y-3">
        <label className="text-xs font-mono text-gray-3 uppercase tracking-wider">
          Lista de treinos (formato textual)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={PLACEHOLDER}
          className="w-full bg-bg-2 border border-gray-4 text-white rounded-md px-3 py-2 text-[13px] font-mono resize-y focus:outline-none focus:border-pink"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            type="button"
            onClick={handlePreview}
            disabled={busy || !text.trim()}
            variant="secondary"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin mr-1" />
            ) : null}
            Pre-visualizar
          </Button>
          {parsed && parsed.length > 0 && (
            <Button
              type="button"
              onClick={requestImport}
              disabled={busy || needsConfirm}
              className="bg-pink"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin mr-1" />
              ) : (
                <Upload size={16} className="mr-1" />
              )}
              Importar {parsed.length} videos (rascunho)
            </Button>
          )}
        </div>
      </div>

      {/* Confirmação inline (mobile-friendly — sem depender de confirm() nativo) */}
      {needsConfirm && parsed && parsed.length > 0 && (
        <div className="bg-pink/10 border-2 border-pink rounded-[14px] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="stroke-pink shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-white font-semibold">
                Confirmar importação?
              </div>
              <p className="text-gray-2 text-sm mt-1">
                {parsed.length} vídeos serão criados como RASCUNHO
                (não publicados). Você poderá editar nome/categoria depois
                em /admin/treinos.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setNeedsConfirm(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={busy}
              className="bg-pink"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin mr-1" />
              ) : (
                <Upload size={16} className="mr-1" />
              )}
              Confirmar e importar
            </Button>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-[14px] p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="stroke-yellow-400" />
            <span className="text-yellow-400 font-semibold text-sm">
              Avisos ({warnings.length})
            </span>
          </div>
          <ul className="text-yellow-200/80 text-xs font-mono space-y-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Result do import */}
      {result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-[14px] p-5 space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="stroke-green-400" />
            <span className="text-green-400 font-semibold text-sm">
              Importacao concluida
            </span>
          </div>
          <p className="text-green-200/80 text-sm">
            {result.inserted} videos criados em rascunho.
            {result.skipped > 0 &&
              ` ${result.skipped} ja existiam (skipped).`}
          </p>
          {result.errors.length > 0 && (
            <div className="text-red-300 text-xs mt-2 font-mono">
              {result.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
          <p className="text-gray-2 text-xs mt-2">
            Va para <a href="/admin/treinos" className="text-pink underline">/admin/treinos</a> para editar nome/categoria de cada video e publicar.
          </p>
        </div>
      )}

      {/* Preview agrupado */}
      {parsed && parsed.length > 0 && !result && (
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">
            Pre-visualizacao ({parsed.length} videos)
          </h3>
          {Object.entries(byLevelWorkout).map(([key, exs]) => {
            const [level, workout] = key.split("|");
            return (
              <div key={key} className="space-y-1.5">
                <div className="text-pink font-mono text-[11px] uppercase tracking-wider">
                  {LEVEL_LABEL[level] ?? level} — Treino {String(workout).padStart(2, "0")} ({exs.length})
                </div>
                <ul className="space-y-1">
                  {exs.map((e, i) => (
                    <li
                      key={`${e.youtube_id}-${i}`}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-gray-3 shrink-0">
                          #{String(e.exerciseNumber).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-white truncate">
                          {e.youtube_id}
                        </span>
                        {e.note && (
                          <span className="text-yellow-400 text-[10px] italic truncate">
                            ({e.note})
                          </span>
                        )}
                      </div>
                      <a
                        href={e.rawUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-3 hover:text-pink shrink-0 text-[10px]"
                      >
                        abrir ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
