import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 *
 * Health check endpoint para uptime monitoring (Vercel, Better Uptime, etc).
 *
 * Retorna 200 quando todos os checks passam, 503 quando algum falha.
 *
 * Não requer auth e não expõe dados sensíveis — apenas status booleano por
 * subsistema. Latências em ms para SLO tracking.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CheckResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
}

async function checkSupabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const supabase = createAdminSupabaseClient();
    // Query barata: count em uma tabela pequena, RLS bypassado pelo admin client.
    const { error } = await supabase
      .from("webhook_events")
      .select("payment_id", { count: "exact", head: true })
      .limit(1);
    if (error) throw new Error(error.message);
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  if (!process.env.REDIS_URL) {
    // Em dev, in-memory fallback é OK — health check passa.
    // Em prod, env.ts já garantiu via requiredInProduction.
    return { ok: true, latency_ms: 0, error: "in-memory fallback (no REDIS_URL)" };
  }
  try {
    // Lazy import para não inicializar Redis no module load do route.
    const Redis = (await import("ioredis")).default;
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    if (pong !== "PONG") throw new Error("PING did not return PONG");
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function GET() {
  const [supabase, redis] = await Promise.all([checkSupabase(), checkRedis()]);
  const ok = supabase.ok && redis.ok;

  const body = {
    status: ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    checks: {
      supabase,
      redis,
    },
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
