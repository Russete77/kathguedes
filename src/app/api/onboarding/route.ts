import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding
 * Salva telefone + interesses no profile existente.
 * Marca onboarding como completo no Supabase e no Clerk (sessionClaims).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { phone: string; interests: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Profile já foi criado pelo layout — atualizar phone, interests e marcar onboarding completo
  const { error } = await supabase
    .from("profiles")
    .update({
      phone: body.phone,
      interests: body.interests,
      onboarding_completed: true,
    })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Atualizar publicMetadata do Clerk para que sessionClaims reflita onboarding_completed
  // Isso permite que o middleware saiba que o onboarding foi concluído
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const currentMetadata = (user.publicMetadata || {}) as Record<string, unknown>;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...currentMetadata,
        onboarding_completed: true,
      },
    });
  } catch (clerkErr) {
    // Não bloquear o onboarding se o Clerk falhar — o dado já está no Supabase
    console.error("[onboarding] Failed to update Clerk metadata:", clerkErr);
  }

  return NextResponse.json({ ok: true });
}
