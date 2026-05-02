import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { sendPushToUser, sendPushBroadcast } from "@/lib/push/webpush";

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
 * Notifica assinantes de um plano específico ou superior.
 */
export async function notifyByPlan(
  minPlan: "free" | "start" | "pro" | "vip",
  params: NotifyParams
) {
  const supabase = createAdminSupabaseClient();
  const planOrder = ["free", "start", "pro", "vip"];
  const minIdx = planOrder.indexOf(minPlan);
  const eligiblePlans = planOrder.slice(minIdx);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("plan_tier", eligiblePlans);

  if (!profiles?.length) return;

  // Batch insert in-app notifications (instead of one-by-one)
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

  // Push notifications in parallel (fire and forget)
  const pushPromises = profiles.map((p) => sendPushToUser(p.id, params));
  Promise.allSettled(pushPromises).catch(() => {});
}
