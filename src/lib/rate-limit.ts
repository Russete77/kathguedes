/**
 * Rate limiter com Redis (Railway) ou fallback in-memory.
 *
 * Usa ioredis para conectar ao Redis no Railway.
 * Se REDIS_URL não estiver configurado, usa Map() in-memory como fallback.
 *
 * Sliding window counter pattern — produção-ready com Redis.
 */

import Redis from "ioredis";

// ── Redis client (singleton) ──
let redis: Redis | null = null;
let redisAvailable = true;

function getRedis(): Redis | null {
  if (!redisAvailable) return null;

  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.warn("[rate-limit] REDIS_URL not set — using in-memory fallback");
      redisAvailable = false;
      return null;
    }

    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("[rate-limit] Redis error:", err.message);
    });

    // Connect async (non-blocking)
    redis.connect().catch(() => {
      console.warn("[rate-limit] Redis connection failed — using in-memory fallback");
      redisAvailable = false;
      redis = null;
    });
  }

  return redis;
}

// ── In-memory fallback ──
const tokenBuckets = new Map<string, { tokens: number; lastRefill: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
};

/**
 * Check rate limit for a given key.
 * Uses Redis if available, otherwise falls back to in-memory.
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedis();

  if (client && redisAvailable) {
    try {
      return await checkRedisRateLimit(client, key, config);
    } catch {
      // Redis failed — fallback to in-memory
      return checkMemoryRateLimit(key, config);
    }
  }

  return checkMemoryRateLimit(key, config);
}

/**
 * Synchronous rate limit check (in-memory only).
 * Keep for backward compat — routes that don't want async.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number } {
  return checkMemoryRateLimit(key, config);
}

// ── Redis sliding window ──
async function checkRedisRateLimit(
  client: Redis,
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `rl:${key}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Use pipeline for atomic operations
  const pipeline = client.pipeline();
  // Remove expired entries
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  // Count current entries
  pipeline.zcard(redisKey);
  // Add current request
  pipeline.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);
  // Set TTL
  pipeline.pexpire(redisKey, config.windowMs);

  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) || 0;

  if (count >= config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: config.maxRequests - count - 1 };
}

// ── In-memory token bucket (fallback) ──
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = tokenBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.maxRequests - 1, lastRefill: now };
    tokenBuckets.set(key, bucket);
    return { allowed: true, remaining: bucket.tokens };
  }

  const elapsed = now - bucket.lastRefill;
  const refillAmount = Math.floor(elapsed / config.windowMs) * config.maxRequests;

  if (refillAmount > 0) {
    bucket.tokens = Math.min(config.maxRequests, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0 };
  }

  bucket.tokens--;
  return { allowed: true, remaining: bucket.tokens };
}

// ── Cleanup in-memory (every 5 min) ──
if (typeof globalThis !== "undefined") {
  const CLEANUP_INTERVAL = 300_000;
  const globalKey = "__rateLimitCleanup";
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = setInterval(() => {
      const cutoff = Date.now() - CLEANUP_INTERVAL;
      for (const [key, bucket] of tokenBuckets) {
        if (bucket.lastRefill < cutoff) {
          tokenBuckets.delete(key);
        }
      }
    }, CLEANUP_INTERVAL);
  }
}
