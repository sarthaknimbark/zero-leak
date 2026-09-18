import type { RequestHandler } from 'express';
import type { User } from '@supabase/supabase-js';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import type { ProfileRow } from '../types/profile.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function extractBearer(req: { header: (name: string) => string | undefined }): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

type AuthCacheEntry = {
  user: User;
  profile: ProfileRow;
  expiresAt: number;
};

/** Short-lived cache so bursty page loads don't re-hit Auth on every request. */
const authCache = new Map<string, AuthCacheEntry>();
const AUTH_CACHE_TTL_MS = 45_000;
const AUTH_CACHE_MAX = 500;

function getCachedAuth(token: string): AuthCacheEntry | null {
  const entry = authCache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    authCache.delete(token);
    return null;
  }
  return entry;
}

function setCachedAuth(token: string, user: User, profile: ProfileRow) {
  if (authCache.size >= AUTH_CACHE_MAX) {
    const oldest = authCache.keys().next().value;
    if (oldest) authCache.delete(oldest);
  }
  authCache.set(token, {
    user,
    profile,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) {
    throw new AppError(401, 'Missing or invalid Authorization Bearer token');
  }

  const cached = getCachedAuth(token);
  if (cached) {
    if (cached.profile.disabled) {
      authCache.delete(token);
      throw new AppError(403, 'Account is disabled');
    }
    req.user = cached.user;
    req.accessToken = token;
    req.profile = cached.profile;
    next();
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new AppError(401, error?.message ?? 'Invalid or expired token');
  }

  // Always load profile with the caller's JWT so RLS works even if
  // SUPABASE_SERVICE_ROLE_KEY is misconfigured as the anon key.
  const sb = createUserClient(token);
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new AppError(400, profileError.message);
  }

  if (!profile) {
    throw new AppError(403, 'Profile not found');
  }

  const row = profile as ProfileRow;
  if (row.disabled) {
    throw new AppError(403, 'Account is disabled');
  }

  setCachedAuth(token, data.user, row);
  req.user = data.user;
  req.accessToken = token;
  req.profile = row;
  next();
});

export const requireAdmin: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.profile) {
    throw new AppError(401, 'Authentication required');
  }
  if (!req.profile.is_admin) {
    throw new AppError(403, 'Admin access required');
  }
  next();
});
