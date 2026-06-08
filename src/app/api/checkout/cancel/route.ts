import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { cancelSubscription, AsaasApiError } from "@/lib/asaas/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/checkout/cancel
 *
 * Cancela a subscription do user no Asaas mas MANTÉM o acesso até `subscription_ends_at`
 * (o último ciclo já cobrado). O downgrade efetivo para `free` acontece quando o webhook
 * Asaas emite `SUBSCRIPTION_DELETED`/`PAYMENT_DELETED` ou quando um cron varre vencidos.
 *
 * Retorno:
 *   - { ok: true, accessUntil: ISO } — assinatura cancelada no Asaas; usuário mantém o tier
 *     até `accessUntil`.
 *   - 4xx: erro do Asaas (cancel já feito, subscription inexistente, etc.) com causa real.
 */

const SAFE_ASAAS_HINTS = ["subscription", "assinatura", "cancel"];

function safeAsaasMessage(err: AsaasApiError): string {
  const raw = err.description ?? "";
  const lower = raw.toLowerCase();
  if (SAFE_ASAAS_HINTS.some((h) => lower.includes(h))) return raw;
  return "Asaas recusou o cancelamento";
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: chama a API externa do Asaas — evitar loop de cancelamento.
    const { allowed } = await checkRateLimitAsync(`cancel:${userId}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("asaas_subscription_id, subscription_ends_at, plan_tier")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[checkout/cancel] profile lookup failed", {
        userId,
        code: profileError?.code,
        message: profileError?.message,
      });
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const subscriptionId = profile.asaas_subscription_id;
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    try {
      await cancelSubscription(subscriptionId);
    } catch (err) {
      if (err instanceof AsaasApiError) {
        return NextResponse.json(
          { error: safeAsaasMessage(err), code: "asaas_cancel_refused" },
          { status: err.status >= 400 && err.status < 500 ? err.status : 502 }
        );
      }
      throw err;
    }

    // Limpa o vínculo Asaas mas MANTÉM o tier e o ends_at. O usuário continua com o que
    // pagou até a data; depois o webhook (SUBSCRIPTION_DELETED já cobre) ou cron varrem
    // para `free`.
    await supabase
      .from("profiles")
      .update({
        subscription_status: "canceled",
        asaas_subscription_id: null,
      })
      .eq("id", userId);

    return NextResponse.json({
      ok: true,
      accessUntil: profile.subscription_ends_at,
      planTier: profile.plan_tier,
    });
  } catch (error) {
    return handleApiError(error, "checkout/cancel");
  }
}
