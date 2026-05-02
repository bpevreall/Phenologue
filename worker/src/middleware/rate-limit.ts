/**
 * Rate limiter — sliding-window approximated with KV TTL keys.
 * 60 req/min per IP for unauthenticated, 600 req/min per patient for authenticated.
 *
 * This is intentionally lightweight. For production scale, swap to
 * Durable Objects or Cloudflare Rate Limiting product.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';

const ANON_LIMIT_PER_MIN = 60;
const AUTH_LIMIT_PER_MIN = 600;
const WINDOW_SECONDS = 60;

export function rateLimit(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const patientId = c.get('patient_id') as string | undefined;
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    const key = patientId ? `rl:patient:${patientId}` : `rl:ip:${ip}`;
    const limit = patientId ? AUTH_LIMIT_PER_MIN : ANON_LIMIT_PER_MIN;

    // Read counter
    const raw = await c.env.CACHE.get(key);
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= limit) {
      return c.json(
        {
          data: null,
          errors: [{ code: 'rate_limited', message: 'Too many requests' }],
        },
        429
      );
    }

    // Increment with TTL
    await c.env.CACHE.put(key, String(count + 1), {
      expirationTtl: WINDOW_SECONDS,
    });

    await next();
  };
}
