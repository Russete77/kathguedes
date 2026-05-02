/// <reference lib="webworker" />

const SW_VERSION = "1.0.0";

// ── Push Notification Handler ──
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const { title, body, icon, url, tag } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: tag || "kathapp",
      data: { url: url || "/dashboard" },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Click handler — abre o app na URL ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Install ──
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activate ──
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
