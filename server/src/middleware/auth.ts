import type { RequestHandler } from 'express';
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

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) {
    throw new AppError(401, 'Missing or invalid Authorization Bearer token');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new AppError(401, error?.message ?? 'Invalid or expired token');
  }

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
