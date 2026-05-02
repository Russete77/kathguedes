/**
 * Web Push — server-side.
 * Usa VAPID keys para enviar push notifications.
 *
 * Gerar VAPID keys: npx web-push generate-vapid-keys
 * Colocar no .env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=
 *   VAPID_PRIVATE_KEY=
 *   VAPID_EMAIL=mailto:contato@kathapp.com
 */

import webPush from "web-push";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

/**
 * Envia push notification para um subscription endpoint.
 * Usa a Web Push Protocol diretamente via fetch (sem dependência extra).
 */
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<boolean> {
  try {
    webPush.setVapidDetails(
      process.env.VAPID_EMAIL || "mailto:contato@kathapp.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
      process.env.VAPID_PRIVATE_KEY || ""
    );

    await webPush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error("[push] Failed to send:", err);
    return false;
  }
}

/**
 * Envia push para todos os subscriptions de um usuário.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
) {
  const supabase = createAdminSupabaseClient();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map((s) =>
      sendPushNotification(s.subscription as { endpoint: string; keys: { p256dh: string; auth: string } }, payload)
    )
  );
}

/**
 * Envia push para todos os assinantes de um plano ou mais.
 */
export async function sendPushBroadcast(payload: PushPayload) {
  const supabase = createAdminSupabaseClient();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  if (!subs?.length) return;

  // Envia em batches de 50 pra não sobrecarregar
  const batchSize = 50;
  for (let i = 0; i < subs.length; i += batchSize) {
    const batch = subs.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((s) =>
        sendPushNotification(
          s.subscription as { endpoint: string; keys: { p256dh: string; auth: string } },
          payload
        )
      )
    );
  }
}
