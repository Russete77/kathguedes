"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateConsultationDraftAction } from "./notify-actions";

const REASONS: Record<string, string> = {
  no_anamnesis: "Anamnese ainda não preenchida.",
  already_delivered: "Consultoria já entregue — não sobrescrevo.",
  empty_library: "Biblioteca de vídeos vazia.",
  ai_unavailable: "IA indisponível (verifique OPENAI_API_KEY).",
  ai_invalid_json: "A IA retornou um formato inválido. Tente de novo.",
  ai_schema_invalid: "O plano gerado não passou na validação. Tente de novo.",
  db_update_failed: "Falha ao salvar o rascunho.",
  consultation_not_found: "Consultoria não encontrada.",
};

export function AiDraftButton({
  consultationId,
  hasDraft,
  flags,
}: {
  consultationId: string;
  hasDraft: boolean;
  flags: string[];
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const r = await generateConsultationDraftAction(consultationId);
      if (r.ok) {
        toast.success(
          r.flags.length
            ? `Rascunho gerado com ${r.flags.length} ponto(s) de atenção. Recarregando…`
            : "Rascunho gerado! Recarregando para você revisar…",
          { style: { borderLeft: "3px solid #00FF88" } },
        );
        // Reload completo: o editor da consultoria inicializa o estado uma vez,
        // então um refresh "soft" não traz o plano novo. Recarregar remonta o
        // editor já com o rascunho gravado, pronto pra revisar/editar.
        setTimeout(() => window.location.reload(), 700);
        return;
      } else {
        toast.error(REASONS[r.reason ?? ""] ?? "Não foi possível gerar o rascunho.");
      }
    } catch {
      toast.error("Erro ao gerar o rascunho.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-bg-1 border border-pink/30 rounded-[14px] p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 bg-pink-dim rounded-full flex items-center justify-center shrink-0 border border-pink/20">
          <Sparkles size={22} className="stroke-pink" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg text-white">
            RASCUNHO COM <span className="text-pink">IA</span>
          </h3>
          <p className="text-gray-2 text-sm mt-0.5">
            {hasDraft
              ? "Já existe um rascunho da IA carregado abaixo. Você pode regenerar ou editar manualmente."
              : "Gera um rascunho do plano a partir da anamnese. Você revisa e edita antes de entregar."}
          </p>
        </div>
        <Button onClick={handleClick} disabled={loading} className="shrink-0">
          <Sparkles size={14} />
          {loading ? "Gerando…" : hasDraft ? "Regenerar" : "Gerar com IA"}
        </Button>
      </div>

      {flags.length > 0 && (
        <ul className="space-y-1 border-t border-gray-4/40 pt-3">
          {flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-yellow">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
