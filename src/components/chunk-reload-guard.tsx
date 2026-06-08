"use client";

import { useEffect } from "react";

/**
 * Recupera o app de ChunkLoadError pós-deploy.
 *
 * Sintoma: depois de um deploy novo na Vercel, um app/aba que já estava aberto
 * (comum em PWA no celular) ainda referencia os chunks JS antigos, que foram
 * apagados → "Loading chunk failed" / módulo dinâmico não carrega → tela
 * quebrada até um refresh manual.
 *
 * Solução: ao detectar esse erro, recarrega a página UMA vez (trava por
 * sessionStorage pra nunca entrar em loop de reload).
 */
export function ChunkReloadGuard() {
  useEffect(() => {
    const RELOAD_KEY = "chunk-reload-ts";

    const isChunkError = (msg?: string | null) =>
      !!msg &&
      /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
        msg,
      );

    const maybeReload = (msg?: string | null) => {
      if (!isChunkError(msg)) return;
      // No máximo 1 reload a cada 15s — evita loop se o erro persistir.
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < 15000) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => maybeReload(e.message || e.error?.message);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      maybeReload(typeof r === "string" ? r : r?.message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
