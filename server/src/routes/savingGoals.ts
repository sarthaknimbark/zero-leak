import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const savingGoalsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  target_amount: z.number().positive(),
  color: z.string().min(1).optional().default('#6366f1'),
  icon: z.string().min(1).optional().default('piggy-bank'),
  target_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required',
});

const amountSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().positive(),
});

savingGoalsRouter.use(requireAuth);

savingGoalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('saving_goals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

savingGoalsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.from('saving_goals').insert(req.body).select().single();
    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

savingGoalsRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('saving_goals')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

savingGoalsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.from('saving_goals').delete().eq('id', req.params.id);
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);

savingGoalsRouter.post(
  '/:id/deposit',
  validateBody(amountSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof amountSchema>;
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.rpc('deposit_to_saving_goal', {
      p_goal_id: req.params.id,
      p_account_id: body.account_id,
      p_amount: body.amount,
    });
    if (error) throw new AppError(400, error.message);
    res.json({ ok: true });
  })
);

savingGoalsRouter.post(
  '/:id/withdraw',
  validateBody(amountSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof amountSchema>;
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.rpc('withdraw_from_saving_goal', {
      p_goal_id: req.params.id,
      p_account_id: body.account_id,
      p_amount: body.amount,
    });
    if (error) throw new AppError(400, error.message);
    res.json({ ok: true });
  })
);
