import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { sendPushToUser, sendPushBroadcast } from "@/lib/push/webpush";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Sistema centralizado de notificações.
 * Dispara push + in-app notification de uma vez.
 * Usar em server actions, webhooks e API routes.
 */

interface NotifyParams {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

/**
 * Notifica um usuário específico (push + in-app).
 */
export async function notifyUser(userId: string, params: NotifyParams) {
  const supabase = createAdminSupabaseClient();

  // In-app notification
  await supabase.from("notifications").insert({
    user_id: userId,
    title: params.title,
    body: params.body,
    icon: params.icon || null,
    url: params.url || null,
  });

  // Push notification (fire and forget)
  sendPushToUser(userId, params).catch(() => {});
}

/**
 * Notifica todos os assinantes (push + in-app).
 */
export async function notifyAll(params: NotifyParams) {
  const supabase = createAdminSupabaseClient();

  // Buscar todos os profiles
  const { data: profiles } = await supabase.from("profiles").select("id");

  if (profiles?.length) {
    // In-app notifications em batch
    const notifs = profiles.map((p) => ({
      user_id: p.id,
      title: params.title,
      body: params.body,
      icon: params.icon || null,
      url: params.url || null,
    }));

    const batchSize = 100;
    for (let i = 0; i < notifs.length; i += batchSize) {
      await supabase.from("notifications").insert(notifs.slice(i, i + batchSize));
    }
  }

  // Push broadcast (fire and forget)
  sendPushBroadcast(params).catch(() => {});
}

/**
 * Notifica todos os membros admin ativos (owner + partner) — Kath, Russo, Sidney.
 * Usado pra alertar o time de eventos operacionais: novos signups, novos bookings,
 * novas mensagens VIP, fotos pendentes de aprovação, etc.
 *
 * Requisitos:
 *  - team_members.role IN ('owner', 'partner')
 *  - team_members.is_active = true
 *  - team_members.clerk_user_id NOT NULL (precisa ter user Clerk vinculado pra receber push)
 */
export async function notifyAdmins(params: NotifyParams) {
  const supabase = createAdminSupabaseClient();

  const { data: admins } = await supabase
    .from("team_members")
    .select("clerk_user_id")
    .in("role", ["owner", "partner"])
    .eq("is_active", true)
    .not("clerk_user_id", "is", null);

  if (!admins?.length) {
    console.warn("[notifyAdmins] nenhum admin com clerk_user_id encontrado");
    return;
  }

  // In-app + push em paralelo (cada admin recebe individualmente)
  const tasks = admins
    .filter((a): a is { clerk_user_id: string } => !!a.clerk_user_id)
    .map((a) => notifyUser(a.clerk_user_id, params));

  await Promise.allSettled(tasks);
}

/**
 * Notifica assinantes de um plano específico ou superior.
 * Ordem: free < acesso < plano1 < plano2 < plano3 < atleta.
 */
export async function notifyByPlan(
  minPlan: PlanTier,
  params: NotifyParams
) {
  const supabase = createAdminSupabaseClient();
  const planOrder: PlanTier[] = ["free", "acesso", "plano1", "plano2", "plano3", "atleta"];
  const minIdx = planOrder.indexOf(minPlan);
  const eligiblePlans = planOrder.slice(minIdx);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("plan_tier", eligiblePlans);

  if (!profiles?.length) return;

  const batchSize = 100;
  const notifs = profiles.map((p) => ({
    user_id: p.id,
    title: params.title,
    body: params.body,
    icon: params.icon || null,
    url: params.url || null,
  }));

  for (let i = 0; i < notifs.length; i += batchSize) {
    await supabase.from("notifications").insert(notifs.slice(i, i + batchSize));
  }

  const pushPromises = profiles.map((p) => sendPushToUser(p.id, params));
  Promise.allSettled(pushPromises).catch(() => {});
}
