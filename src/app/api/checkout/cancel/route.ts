import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelSubscription } from "@/lib/asaas/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/checkout/cancel
 *
 * Cancels the active subscription for the authenticated user.
 *
 * Returns:
 *   - ok: true
 */

export async function POST(req: NextRequest) {
  try {
    // 1. Verify auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get user profile
    const supabase = await createServerSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("asaas_subscription_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const subscriptionId = profile.asaas_subscription_id;
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // 3. Cancel subscription with Asaas
    await cancelSubscription(subscriptionId);

    // 4. Update profile
    await supabase
      .from("profiles")
      .update({
        plan_tier: "free",
        subscription_status: "canceled",
        asaas_subscription_id: null,
      })
      .eq("id", userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[checkout/cancel]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
