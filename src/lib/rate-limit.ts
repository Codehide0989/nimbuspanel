/**
 * In-memory sliding window rate limiter.
 * For production at scale, replace with Redis-based implementation.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const keys = Array.from(store.keys());
    for (const key of keys) {
      const entry = store.get(key);
      if (entry && entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
  passwordReset: { maxRequests: 5, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
  upload: { maxRequests: 5, windowMs: 60 * 1000 } as RateLimitConfig,
  api: { maxRequests: 60, windowMs: 60 * 1000 } as RateLimitConfig,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, retryAfterMs: 0 };
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
