"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { notifyUser } from "@/lib/notifications";
import { planTierSchema } from "@/lib/validations";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Lista usuários com info essencial para a tabela de testes de tier.
 */
export async function listUsersForTierTest(limit: number = 100): Promise<
  Array<{
    id: string;
    full_name: string | null;
    plan_tier: string | null;
    subscription_status: string | null;
    onboarding_completed: boolean | null;
    created_at: string;
    asaas_customer_id: string | null;
  }>
> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, plan_tier, subscription_status, onboarding_completed, created_at, asaas_customer_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<{
    id: string;
    full_name: string | null;
    plan_tier: string | null;
    subscription_status: string | null;
    onboarding_completed: boolean | null;
    created_at: string;
    asaas_customer_id: string | null;
  }>;
}

const setTierSchema = z.object({
  user_id: z.string().min(1),
  tier: planTierSchema,
});

/**
 * Aplica plan_tier em um user — espelha o efeito do webhook Asaas
 * PAYMENT_CONFIRMED (sem cobrar) para testes em produção.
 *
 * Efeitos:
 *  - profiles.plan_tier ← tier
 *  - profiles.subscription_status ← 'active' (ou 'canceled' se free)
 *  - consultations: cria se tier requer (plano2/3/atleta) e não tem ativa
 *  - notificação ao user
 *
 * NÃO cobra cartão, NÃO cria cobrança Asaas, NÃO mexe em wallet/cashback.
 * Use apenas para testar gates de UI e features por tier. Para validar o
 * fluxo financeiro completo, faça um pagamento real via /planos.
 */
export async function setTestUserTier(input: {
  user_id: string;
  tier: PlanTier;
}): Promise<{ ok: true; previousTier: string | null; newTier: PlanTier }> {
  await requireAdmin();
  const data = setTierSchema.parse(input);
  const supabase = createAdminSupabaseClient();

  // Snapshot anterior para audit
  const { data: prevProfile } = await supabase
    .from("profiles")
    .select("plan_tier, full_name")
    .eq("id", data.user_id)
    .single();
  const prevTier = (prevProfile as { plan_tier: string | null } | null)?.plan_tier ?? null;

  // Update profile — no modelo de 4 tiers, todos são pagos por design.
  // Seta também subscription_ends_at (futuro): os gates derivam acesso de
  // hasActiveAccess (status active OU ends_at futuro). Sem isso, telas que
  // checam ends_at consideram o user expirado mesmo com status 'active'.
  const endsAt = new Date();
  endsAt.setFullYear(endsAt.getFullYear() + 1);
  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      plan_tier: data.tier,
      subscription_status: "active",
      subscription_ends_at: endsAt.toISOString(),
    })
    .eq("id", data.user_id);
  if (updErr) throw new Error(updErr.message);

  // Consultoria automática (espelha webhook ensureConsultationForTier)
  const tierToPackage: Partial<Record<PlanTier, "mensal" | "premium">> = {
    evolucao: "mensal",
    saude_completa: "mensal",
    atleta: "premium",
  };
  const packageType = tierToPackage[data.tier];
  if (packageType) {
    const { data: existing } = await supabase
      .from("consultations")
      .select("id")
      .eq("user_id", data.user_id)
      .in("status", ["pending", "in_progress"])
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      await supabase.from("consultations").insert({
        user_id: data.user_id,
        package_type: packageType,
        status: "pending",
        valid_until: validUntil.toISOString(),
      });
    }
  }

  // Notif ao user (não bloqueia)
  notifyUser(data.user_id, {
    title: "Seu plano foi atualizado",
    body: `Agora você está no plano ${data.tier} (teste do admin).`,
    icon: "Crown",
    url: "/planos",
  }).catch(() => {});

  // Revalida páginas que dependem do tier do user — layout-level revalida tambem
  // /perfil, /dashboard, /fitness etc, que de outro modo ficam com client cache antigo.
  revalidatePath("/admin/users");
  revalidatePath("/admin/assinantes");
  revalidatePath("/", "layout");

  return { ok: true, previousTier: prevTier, newTier: data.tier };
}
