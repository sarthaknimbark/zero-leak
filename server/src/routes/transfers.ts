import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const transfersRouter = Router();

const createSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  amount: z.number().positive(),
  fee: z.number().min(0).default(0),
  date: z.string().min(1),
  time: z.string().min(1),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema;

transfersRouter.use(requireAuth);

transfersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('transfers')
      .select(
        '*, from_account:accounts!from_account_id(id,name,type,color,icon), to_account:accounts!to_account_id(id,name,type,color,icon)'
      )
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

transfersRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.rpc('apply_transfer', {
      p_from_account_id: body.from_account_id,
      p_to_account_id: body.to_account_id,
      p_amount: body.amount,
      p_fee: body.fee,
      p_date: body.date,
      p_time: body.time,
      p_description: body.description ?? null,
      p_notes: body.notes ?? null,
    });
    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

transfersRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.rpc('update_transfer', {
      p_transfer_id: req.params.id,
      p_from_account_id: body.from_account_id,
      p_to_account_id: body.to_account_id,
      p_amount: body.amount,
      p_fee: body.fee,
      p_date: body.date,
      p_time: body.time,
      p_description: body.description ?? null,
      p_notes: body.notes ?? null,
    });
    if (error) throw new AppError(400, error.message);
    res.json(data ?? { ok: true });
  })
);

transfersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.rpc('delete_transfer', {
      p_transfer_id: req.params.id,
    });
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
