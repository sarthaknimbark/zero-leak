import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const transactionsRouter = Router();

const txType = z.enum(['income', 'expense', 'adjustment']);

const createSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  type: txType,
  amount: z.number().positive(),
  date: z.string().min(1),
  time: z.string().min(1),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
});

const updateSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  type: txType,
  amount: z.number().positive(),
  date: z.string().min(1),
  time: z.string().min(1),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().nullable().optional(),
});

transactionsRouter.use(requireAuth);

transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const {
      type,
      account_id,
      category_id,
      date_from,
      date_to,
      min_amount,
      max_amount,
      search,
      sort,
    } = req.query;

    let q = sb
      .from('transactions')
      .select(
        '*, account:accounts(id,name,type,color,icon), category:categories(id,name,color,icon)'
      )
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (typeof type === 'string' && type) q = q.eq('type', type);
    if (typeof account_id === 'string' && account_id) q = q.eq('account_id', account_id);
    if (typeof category_id === 'string' && category_id) q = q.eq('category_id', category_id);
    if (typeof date_from === 'string' && date_from) q = q.gte('date', date_from);
    if (typeof date_to === 'string' && date_to) q = q.lte('date', date_to);
    if (typeof min_amount === 'string' && min_amount !== '') {
      q = q.gte('amount', Number(min_amount));
    }
    if (typeof max_amount === 'string' && max_amount !== '') {
      q = q.lte('amount', Number(max_amount));
    }
    if (typeof search === 'string' && search) {
      q = q.or(`description.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    if (sort === 'amount_desc') q = q.order('amount', { ascending: false });
    else if (sort === 'amount_asc') q = q.order('amount', { ascending: true });
    else if (sort === 'date_asc') {
      q = q.order('date', { ascending: true }).order('created_at', { ascending: true });
    }

    const { data, error } = await q.limit(500);
    if (error) throw new AppError(400, error.message);
    res.json(data ?? []);
  })
);

transactionsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.rpc('apply_transaction', {
      p_account_id: body.account_id,
      p_category_id: body.category_id ?? null,
      p_type: body.type,
      p_amount: body.amount,
      p_date: body.date,
      p_time: body.time,
      p_description: body.description ?? null,
      p_tags: body.tags ?? [],
      p_notes: body.notes ?? null,
      p_attachment_url: body.attachment_url ?? null,
    });
    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  })
);

transactionsRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb.rpc('update_transaction', {
      p_transaction_id: req.params.id,
      p_account_id: body.account_id,
      p_category_id: body.category_id ?? null,
      p_type: body.type,
      p_amount: body.amount,
      p_date: body.date,
      p_time: body.time,
      p_description: body.description ?? null,
      p_tags: body.tags ?? [],
      p_notes: body.notes ?? null,
    });
    if (error) throw new AppError(400, error.message);
    res.json(data ?? { ok: true });
  })
);

transactionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb.rpc('delete_transaction', {
      p_transaction_id: req.params.id,
    });
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
