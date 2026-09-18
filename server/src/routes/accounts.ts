import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const accountsRouter = Router();

const accountType = z.enum(['cash', 'bank', 'wallet', 'investment']);
const accountStatus = z.enum(['active', 'archived']);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: accountType,
  institution: z.string().max(200).nullable().optional(),
  opening_balance: z.number(),
  current_balance: z.number().optional(),
  color: z.string().min(1),
  icon: z.string().min(1),
  notes: z.string().nullable().optional(),
  status: accountStatus.optional(),
});

const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required',
});

accountsRouter.use(requireAuth);

accountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

accountsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('accounts')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw new AppError(404, error.message);
    res.json(data);
  })
);

accountsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('accounts')
      .insert({
        ...body,
        current_balance: body.current_balance ?? body.opening_balance,
      })
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

accountsRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('accounts')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

accountsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.from('accounts').delete().eq('id', req.params.id);
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
