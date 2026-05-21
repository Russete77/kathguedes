"use client";

import { useEffect, useState } from "react";

/**
 * Registra Service Worker e subscribes para push notifications.
 * Chama /api/push/subscribe para salvar o token no Supabase.
 */
export function usePushSubscribe() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[push] Not supported");
      return false;
    }

    try {
      // 1. Pedir permissão
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // 2. Registrar SW
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 3. Subscribe no push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("[push] VAPID key not configured");
        return false;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      // 4. Enviar subscription pro backend
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] Subscribe failed:", err);
      return false;
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await fetch("/api/push/subscribe", { method: "DELETE" });
      setSubscribed(false);
    } catch (err) {
      console.error("[push] Unsubscribe failed:", err);
    }
  }

  return { permission, subscribed, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
