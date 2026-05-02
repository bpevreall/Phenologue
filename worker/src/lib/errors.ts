/**
 * Shared response helpers — keep route modules lean and consistent.
 */

import type { Context } from 'hono';

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export function errorResponse<C extends Context>(
  c: C,
  status: number,
  errors: ApiError[]
): Response {
  return c.json({ data: null, errors }, status as never);
}

export function badRequest<C extends Context>(c: C, message: string, field?: string) {
  return errorResponse(c, 400, [{ code: 'bad_request', message, ...(field ? { field } : {}) }]);
}

export function notFound<C extends Context>(c: C, message = 'Not found') {
  return errorResponse(c, 404, [{ code: 'not_found', message }]);
}

export function unauthorized<C extends Context>(c: C, message = 'Unauthorized') {
  return errorResponse(c, 401, [{ code: 'unauthenticated', message }]);
}

export function methodologyViolation<C extends Context>(c: C, message: string) {
  return errorResponse(c, 422, [{ code: 'methodology_violation', message }]);
}

export function conflict<C extends Context>(c: C, code: string, message: string) {
  return errorResponse(c, 409, [{ code, message }]);
}
