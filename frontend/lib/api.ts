import { config } from './config';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  auth?: boolean;
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// One client for every backend call: attaches the current access token, enforces a timeout
// and turns error responses into ApiError with the server's stable error code.
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, query, timeoutMs = 15000, auth = true } = opts;
  const qs = query
    ? '?' + Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}/api${path}${qs === '?' ? '' : qs}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    throw new ApiError(0, aborted ? 'timeout' : 'network_error',
      aborted ? 'The server took too long to respond.' : 'Cannot reach EcoShare. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const e = payload?.error ?? {};
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, e.code ?? 'http_error', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return payload as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong.';
