/**
 * Response envelope — stamps every JSON response with metadata
 * (request_id, methodology_version, api_version) so clients can
 * detect protocol drift and report bugs unambiguously.
 */

import type { MiddlewareHandler } from 'hono';
import { nanoid } from 'nanoid';
import type { Env } from '../env';

export function responseEnvelope(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const requestId = nanoid(12);
    c.set('request_id', requestId);

    await next();

    // Only wrap JSON responses
    const contentType = c.res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return;

    try {
      const body = await c.res.clone().json<unknown>();

      // If already enveloped (e.g. health check), leave alone but stamp meta
      if (
        body !== null &&
        typeof body === 'object' &&
        ('data' in (body as Record<string, unknown>) ||
          'errors' in (body as Record<string, unknown>))
      ) {
        const enveloped = body as { data?: unknown; errors?: unknown[]; meta?: Record<string, unknown> };
        enveloped.meta = {
          request_id: requestId,
          methodology_version: c.env.METHODOLOGY_VERSION,
          api_version: c.env.API_VERSION,
          ...(enveloped.meta ?? {}),
        };
        c.res = new Response(JSON.stringify(enveloped), {
          status: c.res.status,
          headers: c.res.headers,
        });
        return;
      }

      // Otherwise wrap raw body as data
      const wrapped = {
        data: body,
        errors: [],
        meta: {
          request_id: requestId,
          methodology_version: c.env.METHODOLOGY_VERSION,
          api_version: c.env.API_VERSION,
        },
      };
      c.res = new Response(JSON.stringify(wrapped), {
        status: c.res.status,
        headers: c.res.headers,
      });
    } catch {
      // Body wasn't JSON after all — leave alone
    }
  };
}
