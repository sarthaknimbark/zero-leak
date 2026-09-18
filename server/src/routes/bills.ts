import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const billsRouter = Router();

const billStatus = z.enum(['paid', 'unpaid', 'overdue']);
const recurrence = z.enum(['monthly', 'weekly', 'yearly']).nullable();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  due_date: z.string().min(1),
  due_time: z.string().optional().default('12:00:00'),
  category_id: z.string().uuid().nullable().optional(),
  status: billStatus.optional().default('unpaid'),
  is_recurring: z.boolean().optional().default(false),
  recurrence_interval: recurrence.optional().default(null),
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required',
});

const paySchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive().optional(),
  name: z.string().optional(),
  date: z.string().optional(),
});

billsRouter.use(requireAuth);

billsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    await sb.rpc('update_overdue_bills');

    const { data, error } = await sb
      .from('bills')
      .select('*, category:categories(id,name,color,icon)')
      .order('due_date', { ascending: true });

    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

billsRouter.post(
  '/sync-overdue',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.rpc('update_overdue_bills');
    if (error) throw new AppError(400, error.message);
    res.json({ ok: true });
  })
);

billsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.from('bills').insert(req.body).select().single();
    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

billsRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('bills')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

billsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.from('bills').delete().eq('id', req.params.id);
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);

billsRouter.post(
  '/:id/pay',
  validateBody(paySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof paySchema>;
    const sb = createUserClient(req.accessToken!);

    const { data: bill, error: billLoadError } = await sb
      .from('bills')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (billLoadError || !bill) {
      throw new AppError(404, billLoadError?.message ?? 'Bill not found');
    }

    const amount = body.amount ?? Number(bill.amount);
    const name = body.name ?? (bill.name as string);
    const date = body.date ?? new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    const categoryId = body.category_id !== undefined ? body.category_id : bill.category_id;

    const { error: txError } = await sb.rpc('apply_transaction', {
      p_account_id: body.account_id,
      p_category_id: categoryId ?? null,
      p_type: 'expense',
      p_amount: amount,
      p_date: date,
      p_time: time,
      p_description: `Paid: ${name}`,
      p_tags: ['bill-payment'],
      p_notes: 'Paid via Bills & Reminders panel',
      p_attachment_url: null,
    });
    if (txError) throw new AppError(400, txError.message);

    const { data, error: billError } = await sb
      .from('bills')
      .update({ status: 'paid' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (billError) throw new AppError(400, billError.message);
    res.json(data);
  })
);
