import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const categoriesRouter = Router();

const categoryType = z.enum(['income', 'expense']);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: categoryType,
  color: z.string().min(1),
  icon: z.string().min(1),
});

const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required',
});

categoriesRouter.use(requireAuth);

categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const sb = createUserClient(req.accessToken!);
    let q = sb.from('categories').select('*').order('name');
    if (type === 'income' || type === 'expense') {
      q = q.eq('type', type);
    }
    const { data, error } = await q;
    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

categoriesRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.from('categories').insert(req.body).select().single();
    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

categoriesRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('categories')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

categoriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.from('categories').delete().eq('id', req.params.id);
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
