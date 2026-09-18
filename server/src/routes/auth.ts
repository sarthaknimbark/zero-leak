import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin, createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import type { ProfileRow } from '../types/profile.js';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function loadOrCreateProfile(
  userId: string,
  email: string,
  fullName?: string | null
): Promise<ProfileRow> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (selectError) throw new AppError(400, selectError.message);
  if (existing) return existing as ProfileRow;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userId,
      email,
      full_name: fullName ?? email.split('@')[0],
    })
    .select()
    .maybeSingle();

  if (insertError) throw new AppError(400, insertError.message);
  if (!inserted) throw new AppError(500, 'Failed to create profile');
  return inserted as ProfileRow;
}

authRouter.post(
  '/signup',
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = req.body as z.infer<typeof signupSchema>;

    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });

    if (error) throw new AppError(400, error.message);
    if (!data.user) throw new AppError(400, 'Signup failed');

    const profile = await loadOrCreateProfile(data.user.id, email, full_name);

    if (profile.disabled) {
      throw new AppError(403, 'Account is disabled');
    }

    res.status(201).json({
      user: data.user,
      profile,
      session: data.session,
    });
  })
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new AppError(401, error.message);
    if (!data.user || !data.session) throw new AppError(401, 'Login failed');

    const profile = await loadOrCreateProfile(
      data.user.id,
      data.user.email ?? email,
      (data.user.user_metadata as { full_name?: string } | undefined)?.full_name
    );

    if (profile.disabled) {
      throw new AppError(403, 'Account is disabled');
    }

    res.json({
      user: data.user,
      profile,
      session: data.session,
    });
  })
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.auth.signOut();
    if (error) throw new AppError(400, error.message);
    res.json({ ok: true });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.user,
      profile: req.profile,
      session: {
        access_token: req.accessToken,
        token_type: 'bearer',
      },
    });
  })
);
