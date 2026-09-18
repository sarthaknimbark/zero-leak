import { Router } from 'express';
import { z } from 'zod';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const adminRouter = Router();

const disabledSchema = z.object({
  disabled: z.boolean(),
});

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.rpc('admin_stats');
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const sb = createUserClient(req.accessToken!);
    let q = sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (search) {
      q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }
    const { data, error } = await q.limit(100);
    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

adminRouter.patch(
  '/users/:id/disabled',
  validateBody(disabledSchema),
  asyncHandler(async (req, res) => {
    const { disabled } = req.body as z.infer<typeof disabledSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .update({ disabled })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    if (userId === req.user!.id) {
      throw new AppError(400, 'Cannot delete your own account via admin API');
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
