import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

notificationsRouter.patch(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user!.id)
      .eq('read', false);

    if (error) throw new AppError(400, error.message);
    res.json({ ok: true });
  })
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id);

    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
