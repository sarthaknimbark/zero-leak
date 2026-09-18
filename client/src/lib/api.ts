import { supabase } from '@/lib/supabase';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

if (!API_BASE) {
  throw new Error(
    'Missing VITE_API_URL. Frontend requires the backend API. Example: VITE_API_URL=http://localhost:3001'
  );
}

/** In-memory access token — avoids supabase.auth.getSession() on every request. */
let cachedAccessToken: string | null = null;
let wakePromise: Promise<void> | null = null;

export function setApiAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export function getApiAccessToken() {
  return cachedAccessToken;
}

/** Fire-and-forget ping so Render/local server is warm before real API calls. */
export function wakeApi(): Promise<void> {
  if (wakePromise) return wakePromise;
  wakePromise = fetch(`${API_BASE}/health/live`, {
    method: 'GET',
    cache: 'no-store',
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
  return wakePromise;
}

async function resolveToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;
  const { data } = await supabase.auth.getSession();
  cachedAccessToken = data.session?.access_token ?? null;
  return cachedAccessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    cachedAccessToken = null;
    return null;
  }
  cachedAccessToken = data.session.access_token;
  return cachedAccessToken;
}

async function parseBody<T>(res: Response): Promise<({ error?: string } & T) | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { error?: string } & T;
  } catch {
    throw new Error(res.ok ? 'Invalid JSON response' : res.statusText || 'Request failed');
  }
}

function errorMessage(body: { error?: string } | null, res: Response) {
  if (body && typeof body === 'object' && body.error) return String(body.error);
  return res.statusText || 'Request failed';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = await resolveToken();

  const doFetch = (accessToken: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });

  let res = await doFetch(token);
  let body = await parseBody<T>(res);

  // One refresh+retry on auth failure (expired JWT after idle).
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      res = await doFetch(token);
      body = await parseBody<T>(res);
    }
  }

  if (!res.ok) {
    throw new Error(errorMessage(body, res));
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

export const API_URL = API_BASE;
