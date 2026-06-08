"use client";

import { useEffect } from "react";

/**
 * Registra o Service Worker do PWA (`/sw.js`) no client.
 *
 * Importar no layout root pra habilitar:
 * - Push notifications no background (mesmo app fechado)
 * - Add-to-homescreen no iOS (requer SW + manifest)
 * - Cache offline básico do app shell
 *
 * No-op em SSR, dev e em browsers sem suporte. Atualizações automáticas
 * via `registration.update()` — SW novo entra na próxima navegação.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Em dev, pular SW pra não conflitar com HMR
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        // Tenta atualizar a cada page load (skip waiting do SW novo)
        registration.update().catch(() => {});
      } catch (err) {
        console.error("[PWA] SW register failed:", err);
      }
    };

    register();
  }, []);

  return null;
}
