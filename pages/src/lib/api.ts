/**
 * API client — thin wrapper that handles auth headers, response envelope,
 * and turns server errors into thrown ApiError instances.
 */

import { getToken, clearToken } from './auth';

const API_ROOT = '/api';

export interface ApiEnvelope<T> {
  data: T | null;
  errors: Array<{ code: string; message: string; field?: string }>;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  errors: Array<{ code: string; message: string; field?: string }>;
  constructor(status: number, errors: ApiEnvelope<unknown>['errors']) {
    super(errors[0]?.message ?? `HTTP ${status}`);
    this.status = status;
    this.errors = errors;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  raw?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(API_ROOT + path, location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });

  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, [{ code: 'http_error', message: res.statusText }]);
    return res as unknown as T;
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, [{ code: 'invalid_response', message: 'Server returned non-JSON' }]);
  }

  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, envelope.errors ?? [{ code: 'unknown', message: 'Request failed' }]);
  }

  return envelope.data as T;
}
