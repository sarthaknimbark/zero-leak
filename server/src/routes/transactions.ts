import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export function mapInvestmentTransferToTransaction(t: any) {
  const isDeposit = t.to_account?.type === 'investment';
  return {
    id: `transfer-${t.id}`,
    user_id: t.user_id,
    account_id: isDeposit ? t.from_account_id : t.to_account_id,
    category_id: null,
    type: 'investment' as const,
    amount: Number(t.amount),
    date: t.date,
    time: t.time || '00:00:00',
    description:
      t.description ||
      (isDeposit
        ? `Investment Deposit: ${t.to_account?.name || 'Investment'}`
        : `Principal Returned: ${t.from_account?.name || 'Investment'}`),
    tags: ['investment', isDeposit ? 'deposit' : 'principal-return'],
    notes: t.notes || (isDeposit ? `Invested into ${t.to_account?.name}` : `Returned from ${t.from_account?.name}`),
    created_at: t.created_at,
    account: isDeposit ? t.from_account : t.to_account,
    category: { id: 'inv', name: 'Investments', color: '#8b5cf6', icon: 'trending-up' },
  };
}

export function sortTransactionsChronological(items: any[]) {
  return [...items].sort((a: any, b: any) => {
    const c = b.date.localeCompare(a.date);
    if (c !== 0) return c;
    return (b.time || '').localeCompare(a.time || '');
  });
}

export const transactionsRouter = Router();

const txType = z.enum(['income', 'expense', 'adjustment']);

const createSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  type: txType,
  amount: z.number().positive(),
  date: z.string().min(1),
  time: z.string().nullable().optional(),
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
  time: z.string().nullable().optional(),
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

    if (type === 'investment') {
      q = q.or('tags.cs.{investment},description.ilike.%Investment%,notes.ilike.%Investment%');
    } else if (typeof type === 'string' && type) {
      q = q.eq('type', type);
    }
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

    let results = data ?? [];

    if (type === 'investment' || !type) {
      let tfQ = sb
        .from('transfers')
        .select(
          '*, from_account:accounts!from_account_id(id,name,type,color,icon), to_account:accounts!to_account_id(id,name,type,color,icon)'
        )
        .order('date', { ascending: false })
        .limit(100);

      if (typeof account_id === 'string' && account_id) {
        tfQ = tfQ.or(`from_account_id.eq.${account_id},to_account_id.eq.${account_id}`);
      }
      if (typeof date_from === 'string' && date_from) tfQ = tfQ.gte('date', date_from);
      if (typeof date_to === 'string' && date_to) tfQ = tfQ.lte('date', date_to);

      const { data: tfData } = await tfQ;
      if (tfData) {
        const invTransfers = tfData
          .filter(
            (t: any) =>
              t.from_account?.type === 'investment' ||
              t.to_account?.type === 'investment' ||
              (t.description || '').toLowerCase().includes('investment')
          )
          .map(mapInvestmentTransferToTransaction);

        results = sortTransactionsChronological([...results, ...invTransfers]);
      }
    }

    res.json(results);
  })
);

transactionsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const sb = createUserClient(req.accessToken!);
    let { data, error } = await sb.rpc('apply_transaction', {
      p_account_id: body.account_id,
      p_category_id: body.category_id ?? null,
      p_type: body.type,
      p_amount: body.amount,
      p_date: body.date,
      p_time: body.time || null,
      p_description: body.description ?? null,
      p_tags: body.tags ?? [],
      p_notes: body.notes ?? null,
      p_attachment_url: body.attachment_url ?? null,
    });
    // If PostgreSQL schema enforces NOT NULL on time, retry with default time format
    if (error && error.message?.includes('violates not-null constraint') && error.message?.includes('time')) {
      const retry = await sb.rpc('apply_transaction', {
        p_account_id: body.account_id,
        p_category_id: body.category_id ?? null,
        p_type: body.type,
        p_amount: body.amount,
        p_date: body.date,
        p_time: '00:00:00',
        p_description: body.description ?? null,
        p_tags: body.tags ?? [],
        p_notes: body.notes ?? null,
        p_attachment_url: body.attachment_url ?? null,
      });
      data = retry.data;
      error = retry.error;
    }
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
