import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/estetica/slots?date=YYYY-MM-DD&duration=60
 * Retorna horários disponíveis para a data informada.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const duration = Number(searchParams.get("duration") || "60");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase.rpc("get_available_slots", {
    p_date: date,
    p_duration_min: duration,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data || [] });
}
