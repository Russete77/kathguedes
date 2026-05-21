import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { processCheckout } from "@/lib/asaas/checkout";
import { ASAAS_CONFIG } from "@/lib/asaas/config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActivePlans } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/supabase/types";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

const billingTypeSchema = z.enum(["PIX", "BOLETO", "CREDIT_CARD"]);

// CPF (11 digitos) ou CNPJ (14 digitos). Aceita com mascara, normalizamos pra digitos puros.
const cpfCnpjSchema = z
  .string()
  .min(1, "CPF ou CNPJ obrigatorio")
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .refine((v) => v.length === 11 || v.length === 14, {
    message: "CPF deve ter 11 digitos ou CNPJ 14 digitos",
  });

const subscribeBodySchema = z.object({
  plan: z.string().min(1, "plan obrigatorio"),
  billingType: billingTypeSchema,
  // CPF opcional no body: se vier, atualiza profile.cpf; se nao, usa o que ja
  // estiver salvo no profile. Se ambos vazios, retorna 400.
  cpfCnpj: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await checkRateLimitAsync(`subscribe:${userId}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde 1 minuto." },
        { status: 429 },
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
    }
    const parsed = subscribeBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { plan, billingType, cpfCnpj: cpfFromBody } = parsed.data;

    const activePlans = await getActivePlans();
    const validPaidSlugs = activePlans
      .filter((p) => p.slug !== "free" && p.asaas_value > 0)
      .map((p) => p.slug);
    const matched = validPaidSlugs.find((slug) => slug === plan);
    if (!matched) {
      return NextResponse.json(
        { error: `Plano invalido. Disponiveis: ${validPaidSlugs.join(", ")}` },
        { status: 400 },
      );
    }

    if (!ASAAS_CONFIG.apiKey) {
      console.error("[subscribe] ASAAS_API_KEY ausente — configure no .env.local ou Vercel");
      return NextResponse.json(
        {
          error: "payment_provider_unavailable",
          message:
            "O processador de pagamento esta temporariamente indisponivel. Tente novamente em alguns minutos.",
        },
        { status: 503 },
      );
    }

    const clerkUser = await currentUser();
    if (!clerkUser?.emailAddresses[0]) {
      return NextResponse.json({ error: "Email nao encontrado" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, cpf")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Perfil nao encontrado" }, { status: 404 });
    }

    // Resolver CPF efetivo: prioriza o do body (recem-coletado),
    // fallback pra profile.cpf (ja persistido).
    let cpfRaw: string | null = null;
    if (cpfFromBody) {
      const cpfParsed = cpfCnpjSchema.safeParse(cpfFromBody);
      if (!cpfParsed.success) {
        return NextResponse.json(
          { error: cpfParsed.error.flatten() },
          { status: 400 },
        );
      }
      cpfRaw = cpfParsed.data;
    } else if (profile.cpf) {
      cpfRaw = profile.cpf.replace(/[^0-9]/g, "");
    }

    if (!cpfRaw) {
      return NextResponse.json(
        {
          error: "cpf_required",
          message: "CPF ou CNPJ obrigatorio para criar a cobranca.",
        },
        { status: 400 },
      );
    }

    // Se CPF veio do body, persiste antes do checkout (idempotente em re-tentativas)
    if (cpfFromBody && cpfRaw !== profile.cpf) {
      const admin = createAdminSupabaseClient();
      await admin.from("profiles").update({ cpf: cpfRaw }).eq("id", userId);
    }

    const email = clerkUser.emailAddresses[0].emailAddress;

    const result = await processCheckout({
      userId,
      fullName: profile.full_name,
      email,
      cpfCnpj: cpfRaw,
      plan: matched as Exclude<PlanTier, "free">,
      billingType,
    });

    return NextResponse.json({
      subscriptionId: result.subscriptionId,
      customerId: result.customerId,
      invoiceUrl: result.invoiceUrl,
      billingType: result.billingType,
      pixQrCode: result.pixQrCode,
      pixPayload: result.pixPayload,
      message: "Assinatura criada! Aguardando confirmacao do pagamento.",
    });
  } catch (err) {
    return handleApiError(err, "POST /api/checkout/subscribe");
  }
}
