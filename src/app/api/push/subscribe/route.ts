import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * POST /api/push/subscribe
 * Salva push subscription do browser no Supabase.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let subscription: unknown;
  try {
    const body = await req.json();
    subscription = body.subscription;
    if (!subscription) throw new Error("Missing subscription");
  } catch {
    return NextResponse.json({ error: "subscription obrigatório" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Upsert — evitar duplicatas do mesmo endpoint
  const sub = subscription as { endpoint: string };
  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("subscription->>endpoint", sub.endpoint)
    .single();

  if (!existing) {
    await supabase.from("push_subscriptions").insert({
      user_id: userId,
      subscription: subscription as unknown as Json,
    });
  }

  return NextResponse.json({ subscribed: true });
}

/**
 * DELETE /api/push/subscribe
 * Remove push subscription.
 */
export async function DELETE(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

  return NextResponse.json({ unsubscribed: true });
}
