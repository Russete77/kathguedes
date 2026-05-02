import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { processCheckout } from "@/lib/asaas/checkout";
import { NextRequest, NextResponse } from "next/server";
import type { PlanTier } from "@/lib/supabase/types";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/checkout/subscribe
 *
 * Creates a subscription for the authenticated user.
 *
 * Body:
 *   - plan: "start" | "pro" | "vip"
 *   - billingType: "PIX" | "BOLETO" | "CREDIT_CARD"
 *
 * Returns:
 *   - subscriptionId: string
 *   - customerId: string
 */

interface SubscribeRequest {
  plan: Exclude<PlanTier, "free">;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
}

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

    // Rate limit: 5 subscribe attempts per minute per user
    const { allowed } = await checkRateLimitAsync(`subscribe:${userId}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde 1 minuto." },
        { status: 429 }
      );
    }

    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.emailAddresses[0]) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // 2. Parse request body
    const body = await req.json() as SubscribeRequest;
    const { plan, billingType } = body;

    if (!plan || !billingType) {
      return NextResponse.json(
        { error: "Missing plan or billingType" },
        { status: 400 }
      );
    }

    if (!["start", "pro", "vip"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType)) {
      return NextResponse.json(
        { error: "Invalid billingType" },
        { status: 400 }
      );
    }

    // 3. Get user profile to retrieve full_name
    const supabase = await createServerSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const fullName = profile.full_name;
    const email = clerkUser.emailAddresses[0].emailAddress;

    // 4. Process checkout
    const result = await processCheckout({
      userId,
      fullName,
      email,
      plan,
      billingType,
    });

    // 5. Salvar subscription ID — o plan_tier será atualizado pelo webhook
    // quando o pagamento for confirmado pelo Asaas (PAYMENT_CONFIRMED)
    // Para cartão de crédito, a confirmação é quase imediata.
    // Para PIX/Boleto, aguarda o pagamento ser processado.

    return NextResponse.json({
      subscriptionId: result.subscriptionId,
      customerId: result.customerId,
      invoiceUrl: result.invoiceUrl,
      billingType: result.billingType,
      pixQrCode: result.pixQrCode,
      pixPayload: result.pixPayload,
      message: "Assinatura criada! Aguardando confirmação do pagamento.",
    });
  } catch (error) {
    console.error("[checkout/subscribe]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
