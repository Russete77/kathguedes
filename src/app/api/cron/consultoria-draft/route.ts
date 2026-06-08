import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runConsultationDraft } from "@/lib/consultoria/draft";

export const dynamic = "force-dynamic";
// Geração de IA pode levar alguns segundos por consultoria.
export const maxDuration = 60;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const BATCH = 10; // teto por execução (controle de custo/tempo)

/**
 * GET /api/cron/consultoria-draft
 *
 * Caminho CONFIÁVEL do rascunho de IA: pega consultorias com anamnese preenchida
 * que ainda não têm rascunho (ai_draft_generated_at null) e gera. Cobre os casos
 * em que o gatilho best-effort no envio da anamnese não completou (serverless).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: pending } = await supabase
      .from("consultations")
      .select("id")
      .eq("status", "in_progress")
      .not("anamnesis", "is", null)
      .is("ai_draft_generated_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH);

    const ids = (pending ?? []).map((c) => c.id);
    const results: { id: string; ok: boolean; reason?: string }[] = [];
    for (const id of ids) {
      const r = await runConsultationDraft(id);
      results.push({ id, ok: r.ok, reason: r.reason });
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/consultoria-draft");
  }
}
