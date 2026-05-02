import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt, assertSigningKey } from '../src/lib/jwt';

/**
 * JWT hardening tests — see lib/jwt.ts for the validation order.
 *
 * Coverage:
 *   - HS256 round-trip (signing + verification work end-to-end)
 *   - alg-confusion: alg='none' rejected (the classic CVE-2015-9235 pattern)
 *   - alg-confusion: alg='RS256' rejected (we are HS256-only)
 *   - tampered signature rejected
 *   - iat-in-future rejected (clock skew tolerance is 60s; we test +1h)
 *   - assertSigningKey rejects empty / short / dev-placeholder secrets
 */

const TEST_SECRET = 'a'.repeat(64); // 64-char dummy secret, well above 32 minimum

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build a JWT-shaped string with arbitrary header/claims and the supplied
 * raw signature bytes (b64url-encoded). Used to forge alg-confusion attacks
 * and tampered-signature tokens.
 */
function craftToken(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  rawSig: string
): string {
  const h = base64UrlEncode(JSON.stringify(header));
  const c = base64UrlEncode(JSON.stringify(claims));
  return `${h}.${c}.${rawSig}`;
}

describe('verifyJwt', () => {
  it('round-trips a valid HS256 token', async () => {
    const token = await signJwt('patient_abc', TEST_SECRET, 'jti_1');
    const claims = await verifyJwt(token, TEST_SECRET);
    expect(claims.sub).toBe('patient_abc');
    expect(claims.jti).toBe('jti_1');
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it("rejects alg='none' (classic alg-confusion)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = craftToken(
      { alg: 'none', typ: 'JWT' },
      { sub: 'attacker', iat: now, exp: now + 3600, jti: 'forged' },
      '' // typical alg=none attack uses an empty signature
    );
    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow();
  });

  it("rejects alg='RS256' (we are HS256-only)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Sign a valid HS256 signature first so the only failure point is the
    // alg check — confirms the alg gate runs BEFORE the signature check.
    const realToken = await signJwt('p1', TEST_SECRET, 'j1');
    const sig = realToken.split('.')[2]!;
    const token = craftToken(
      { alg: 'RS256', typ: 'JWT' },
      { sub: 'p1', iat: now, exp: now + 3600, jti: 'j1' },
      sig
    );
    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(/alg/i);
  });

  it('rejects a tampered signature', async () => {
    const token = await signJwt('p1', TEST_SECRET, 'j1');
    const parts = token.split('.');
    // Flip a character in the signature segment
    const sig = parts[2]!;
    const tampered =
      sig.charAt(0) === 'A'
        ? 'B' + sig.slice(1)
        : 'A' + sig.slice(1);
    const bad = `${parts[0]}.${parts[1]}.${tampered}`;
    await expect(verifyJwt(bad, TEST_SECRET)).rejects.toThrow();
  });

  it('rejects a token with iat in the future (beyond clock skew)', async () => {
    // We can't easily mint a future-dated valid HS256 token without
    // duplicating signing logic, so we re-sign a hand-crafted payload using
    // signJwt's internals via the public API: build it manually with the
    // real HMAC step.
    const now = Math.floor(Date.now() / 1000);
    const futureIat = now + 60 * 60; // 1h ahead, well past the 60s tolerance
    const header = { alg: 'HS256', typ: 'JWT' };
    const claims = {
      sub: 'p1',
      iat: futureIat,
      exp: futureIat + 3600,
      jti: 'j1',
    };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const claimsB64 = base64UrlEncode(JSON.stringify(claims));
    const signingInput = `${headerB64}.${claimsB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(TEST_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signingInput)
    );
    const sigB64 = base64UrlEncode(new Uint8Array(sig));
    const token = `${signingInput}.${sigB64}`;

    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(/iat/i);
  });

  it('rejects a malformed token (wrong number of parts)', async () => {
    await expect(verifyJwt('not.a.valid.token', TEST_SECRET)).rejects.toThrow();
    await expect(verifyJwt('only.two', TEST_SECRET)).rejects.toThrow();
  });
});

describe('assertSigningKey', () => {
  it('throws on undefined / empty key', () => {
    expect(() => assertSigningKey(undefined)).toThrow(/not set/i);
    expect(() => assertSigningKey('')).toThrow(/not set/i);
  });

  it('throws on a too-short key', () => {
    expect(() => assertSigningKey('a'.repeat(16))).toThrow(/too short/i);
  });

  it('throws on the dev placeholder', () => {
    expect(() =>
      assertSigningKey('local-dev-only-change-before-prod-aaaaaaaaaaaaaaaaaaaaaaaa')
    ).toThrow(/dev placeholder/i);
  });

  it('accepts a 32+ char non-placeholder key', () => {
    expect(() => assertSigningKey('a'.repeat(32))).not.toThrow();
    expect(() => assertSigningKey('x'.repeat(64))).not.toThrow();
  });
});
