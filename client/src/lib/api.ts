import { supabase } from '@/lib/supabase';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

/** When set, data calls go through the secured Express backend instead of direct Supabase. */
export function isApiEnabled() {
  return Boolean(API_BASE);
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) {
    throw new Error('VITE_API_URL is not configured');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...init.headers,
    },
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as { error?: string } & T) : (null as T | null);

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error
        ? String(body.error)
        : res.statusText || 'Request failed';
    throw new Error(message);
  }

  return body as T;
}

export function toQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
