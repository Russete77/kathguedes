import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * POST /api/consultoria/anamnese
 * Salva anamnese na consultoria e muda status pra in_progress.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { consultationId: string; anamnesis: Record<string, unknown> };
  try {
    body = await req.json();
    if (!body.consultationId || !body.anamnesis) throw new Error();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Verificar que a consultoria pertence ao usuário
  const { data: consultation } = await supabase
    .from("consultations")
    .select("id, user_id")
    .eq("id", body.consultationId)
    .eq("user_id", userId)
    .single();

  if (!consultation) {
    return NextResponse.json({ error: "Consultoria não encontrada" }, { status: 404 });
  }

  // Salvar anamnese e mudar status
  const { error } = await supabase
    .from("consultations")
    .update({
      anamnesis: body.anamnesis as unknown as Json,
      status: "in_progress",
    })
    .eq("id", body.consultationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
