import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Bloco de treino = 6 semanas. Após esse período desde o rascunho entregue,
// abrimos a próxima fase (novo bloco) para revisão.
const RENEW_AFTER_DAYS = 42;
const BATCH = 20;

/**
 * GET /api/cron/consultoria-renew
 *
 * Renovação de bloco (a cada 6 semanas): para cada aluno com consultoria
 * ENTREGUE há >= 6 semanas e ainda dentro da validade, cria um follow-up
 * (status in_progress, copiando a anamnese) que o pipeline de rascunho de IA
 * (cron consultoria-draft) transforma na próxima fase e entra na fila de revisão.
 * Não sobrescreve o plano entregue; cria a próxima consultoria.
 *
 * Guarda contra duplicatas: pula alunos que já têm consultoria pending/in_progress.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  try {
    if (!authorize(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - RENEW_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    // Entregues há >= 6 semanas (pelo rascunho), ainda válidas. Mais recente primeiro.
    const { data: candidates } = await supabase
      .from("consultations")
      .select("id, user_id, package_type, anamnesis, ai_draft_generated_at")
      .eq("status", "delivered")
      .not("ai_draft_generated_at", "is", null)
      .lt("ai_draft_generated_at", cutoff)
      .gt("valid_until", nowIso)
      .order("ai_draft_generated_at", { ascending: false })
      .limit(100);

    const handled = new Set<string>();
    const created: string[] = [];

    for (const row of (candidates ?? []) as {
      id: string;
      user_id: string;
      package_type: string;
      anamnesis: Json | null;
    }[]) {
      if (created.length >= BATCH) break;
      if (handled.has(row.user_id)) continue;
      handled.add(row.user_id);

      // Já tem consultoria aberta? Então não cria outra.
      const { data: active } = await supabase
        .from("consultations")
        .select("id")
        .eq("user_id", row.user_id)
        .in("status", ["pending", "in_progress"])
        .limit(1)
        .maybeSingle();
      if (active) continue;

      const validUntil = new Date(nowMs + RENEW_AFTER_DAYS * 24 * 60 * 60 * 1000);
      const { data: inserted, error } = await supabase
        .from("consultations")
        .insert({
          user_id: row.user_id,
          package_type: row.package_type,
          status: "in_progress", // já tem anamnese → vai direto pro rascunho
          anamnesis: row.anamnesis,
          valid_until: validUntil.toISOString(),
        })
        .select("id")
        .single();
      if (error || !inserted) continue;

      created.push(inserted.id);
      notifyUser(row.user_id, {
        title: "Nova fase do seu treino chegando",
        body: "Você concluiu um bloco! A Kath já está preparando sua próxima fase.",
        icon: "Sparkles",
        url: "/consultoria",
      }).catch(() => {});
    }

    return NextResponse.json({ created: created.length, ids: created });
  } catch (err) {
    return handleApiError(err, "GET /api/cron/consultoria-renew");
  }
}
