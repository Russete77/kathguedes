import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const CLERK_RETRY_ATTEMPTS = 3;
const CLERK_RETRY_BASE_MS = 250;

/**
 * POST /api/onboarding
 * Salva telefone + interesses no profile existente.
 * Marca onboarding como completo no Supabase e no Clerk (sessionClaims).
 *
 * Atomicidade: Supabase primeiro, depois Clerk com retry.
 * Se o Clerk falhar após retries, retornamos 502 — o middleware checa
 * sessionClaims, então sem update no Clerk o user fica em loop.
 * O cliente refaz o POST; Supabase update é idempotente.
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

  let lastClerkError: unknown = null;
  for (let attempt = 1; attempt <= CLERK_RETRY_ATTEMPTS; attempt++) {
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
      return NextResponse.json({ ok: true });
    } catch (clerkErr) {
      lastClerkError = clerkErr;
      if (attempt < CLERK_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, CLERK_RETRY_BASE_MS * 2 ** (attempt - 1)));
      }
    }
  }

  console.error("[onboarding] Clerk metadata update failed after retries", {
    userId,
    error: lastClerkError,
  });
  return NextResponse.json(
    { error: "Onboarding parcialmente salvo. Tente novamente." },
    { status: 502 },
  );
}
