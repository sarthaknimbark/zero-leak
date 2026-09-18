import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const profileRouter = Router();

const updateProfileSchema = z
  .object({
    full_name: z.string().min(1).max(200).optional(),
    avatar_url: z.string().url().nullable().optional(),
    pin_enabled: z.boolean().optional(),
    push_subscription: z.unknown().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

const avatarSchema = z.object({
  avatar_url: z.string().url(),
});

profileRouter.use(requireAuth);

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

profileRouter.patch(
  '/',
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .update(req.body)
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

profileRouter.post(
  '/avatar',
  validateBody(avatarSchema),
  asyncHandler(async (req, res) => {
    const { avatar_url } = req.body as z.infer<typeof avatarSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .update({ avatar_url })
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);
