import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { updateWorkoutStreak } from "@/lib/billing/streak";

/**
 * POST /api/consultoria/complete-day
 * Marca um DIA do plano como concluído (✓ na consultoria) e mantém o streak.
 *
 * Body opcional: { dayKey: "w<semana>d<dia>" }. Quando enviado, registra o dia
 * em consultations.completed_days (idempotente). Sem dayKey, só atualiza streak.
 */
const schema = z.object({ dayKey: z.string().max(20).optional() });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let dayKey: string | undefined;
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (parsed.success) dayKey = parsed.data.dayKey;
  } catch {
    // sem body — segue só com streak
  }

  const supabase = createAdminSupabaseClient();

  // Streak atômico (RPC com fallback). Idempotente no mesmo dia.
  const newStreak = await updateWorkoutStreak(supabase, userId);

  let completedDays: string[] | undefined;
  if (dayKey) {
    // Marca o dia na consultoria ativa do aluno (mais recente não-expirada).
    const { data: consult } = await supabase
      .from("consultations")
      .select("id, completed_days")
      .eq("user_id", userId)
      .in("status", ["in_progress", "delivered"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (consult) {
      const current = Array.isArray(consult.completed_days)
        ? (consult.completed_days as string[])
        : [];
      const next = current.includes(dayKey) ? current : [...current, dayKey];
      completedDays = next;
      await supabase
        .from("consultations")
        .update({ completed_days: next })
        .eq("id", consult.id);
    }
  }

  return NextResponse.json({ completed: true, streak: newStreak, completedDays });
}
