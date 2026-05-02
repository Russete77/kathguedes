import { NextResponse } from "next/server";

/**
 * Centralized API error handler.
 * Logs em JSON estruturado (Vercel ingere stdout) e captura no Sentry quando configurado.
 *
 * Sentry: setar SENTRY_DSN no env e instalar `@sentry/nextjs`.
 * Quando o pacote nao estiver instalado, o handler degrada graciosamente
 * para console.error apenas (nao quebra o build em dev).
 */

type SentryCapture = (error: unknown, ctx?: { extra?: Record<string, unknown> }) => void;
let sentryCapture: SentryCapture | null = null;
let sentryLoadAttempted = false;

async function loadSentry(): Promise<SentryCapture | null> {
  if (sentryLoadAttempted) return sentryCapture;
  sentryLoadAttempted = true;
  if (!process.env.SENTRY_DSN) return null;
  try {
    // @ts-expect-error pacote opcional: instalar com `npm i @sentry/nextjs` em prod
    const mod = await import("@sentry/nextjs");
    sentryCapture = (error, ctx) => mod.captureException(error, ctx);
    return sentryCapture;
  } catch {
    return null;
  }
}

export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(JSON.stringify({
    level: "error",
    context,
    message,
    stack,
    timestamp: new Date().toISOString(),
  }));

  loadSentry().then((capture) => {
    if (capture) capture(error, { extra: { context } });
  }).catch(() => { /* swallow */ });

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
