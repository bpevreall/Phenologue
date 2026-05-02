/**
 * Auth middleware — verifies JWT bearer token and binds patient_id into context.
 *
 * Cryptographic verification is delegated to lib/jwt#verifyJwt, which enforces
 * alg/typ header checks and exp/iat claim checks. This middleware enforces:
 *   - presence of an Authorization: Bearer header
 *   - presence and validity of JWT_SIGNING_KEY in env (asserted on first
 *     request via a memoised flag — Worker module-load doesn't have access
 *     to env, so we assert lazily once per isolate)
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import { verifyJwt, assertSigningKey } from '../lib/jwt';

let signingKeyValidated = false;

/**
 * Reset the memoised key-validation flag. Test-only — production code must
 * not call this. Exported here so unit tests can re-exercise the assertion.
 */
export function __resetSigningKeyValidationForTests(): void {
  signingKeyValidated = false;
}

export function requireAuth(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    if (!signingKeyValidated) {
      try {
        assertSigningKey(c.env.JWT_SIGNING_KEY);
        signingKeyValidated = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Signing key invalid';
        return c.json(
          {
            data: null,
            errors: [{ code: 'misconfigured', message }],
          },
          500
        );
      }
    }

    const authHeader = c.req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        {
          data: null,
          errors: [{ code: 'unauthenticated', message: 'Missing bearer token' }],
        },
        401
      );
    }

    const token = authHeader.slice(7);
    const signingKey = c.env.JWT_SIGNING_KEY!;

    try {
      const claims = await verifyJwt(token, signingKey);
      c.set('patient_id', claims.sub);
      c.set('claims', claims);
    } catch (err) {
      return c.json(
        {
          data: null,
          errors: [{ code: 'invalid_token', message: 'Token invalid or expired' }],
        },
        401
      );
    }

    await next();
  };
}
