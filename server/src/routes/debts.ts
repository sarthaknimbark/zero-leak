import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const debtsRouter = Router();

const createSchema = z.object({
  friend_name: z.string().min(1).max(200),
  type: z.enum(['lent', 'borrowed']),
  amount: z.number().positive(),
  description: z.string().nullable().optional(),
  status: z.enum(['pending', 'settled']).optional().default('pending'),
  date: z.string().min(1),
});

const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required',
});

const statusSchema = z.object({
  status: z.enum(['pending', 'settled']),
});

debtsRouter.use(requireAuth);

debtsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('debts')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

debtsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.from('debts').insert(req.body).select().single();
    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

debtsRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('debts')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

debtsRouter.patch(
  '/:id/status',
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof statusSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('debts')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

debtsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.from('debts').delete().eq('id', req.params.id);
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
