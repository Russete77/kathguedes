import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { submitAnamneseSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import type { Json } from "@/lib/supabase/database.types";

/**
 * POST /api/consultoria/anamnese
 * Salva anamnese na consultoria e muda status pra in_progress.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    // Gate de tamanho total — defesa de profundidade contra payload abusivo,
    // já que o schema usa passthrough() (form evolui).
    try {
      const size = JSON.stringify(raw).length;
      if (size > 80_000) {
        return NextResponse.json(
          { error: "Payload de anamnese muito grande" },
          { status: 413 }
        );
      }
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = submitAnamneseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { consultationId, anamnesis } = parsed.data;
    const supabase = createAdminSupabaseClient();

    const { data: consultation } = await supabase
      .from("consultations")
      .select("id, user_id")
      .eq("id", consultationId)
      .eq("user_id", userId)
      .single();

    if (!consultation) {
      return NextResponse.json({ error: "Consultoria não encontrada" }, { status: 404 });
    }

    const submitted = {
      ...anamnesis,
      submittedAt: anamnesis.submittedAt ?? new Date().toISOString(),
    };

    const { error } = await supabase
      .from("consultations")
      .update({
        anamnesis: submitted as unknown as Json,
        status: "in_progress",
      })
      .eq("id", consultationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Gatilho da IA: gera o rascunho da consultoria (best-effort, não bloqueia a
    // resposta ao aluno). Se isto não completar no serverless, o cron
    // /api/cron/consultoria-draft pega as anamneses sem rascunho e gera depois.
    void import("@/lib/consultoria/draft")
      .then((m) => m.runConsultationDraft(consultationId))
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "POST /api/consultoria/anamnese");
  }
}
