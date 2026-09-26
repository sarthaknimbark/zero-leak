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

const settleSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

const settlePersonSchema = settleSchema.extend({
  friend_name: z.string().min(1).max(200),
});

type DebtRow = {
  id: string;
  friend_name: string;
  type: 'lent' | 'borrowed';
  amount: number | string;
  description: string | null;
  status: string;
  date: string;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}

async function applySettleTransaction(
  sb: ReturnType<typeof createUserClient>,
  opts: {
    accountId: string;
    type: 'lent' | 'borrowed';
    amount: number;
    friendName: string;
    notes?: string;
  }
) {
  const txType = opts.type === 'lent' ? 'income' : 'expense';
  const description =
    opts.type === 'lent'
      ? `Debt received from ${opts.friendName}`
      : `Debt paid to ${opts.friendName}`;

  const { error } = await sb.rpc('apply_transaction', {
    p_account_id: opts.accountId,
    p_category_id: null,
    p_type: txType,
    p_amount: opts.amount,
    p_date: todayDate(),
    p_time: nowTime(),
    p_description: description,
    p_tags: ['debt-settle'],
    p_notes:
      opts.notes ||
      (opts.type === 'lent'
        ? 'Money collected against a loan'
        : 'Money paid against a borrowed amount'),
    p_attachment_url: null,
  });
  if (error) throw new AppError(400, error.message);
}

async function applyAmountToDebts(
  sb: ReturnType<typeof createUserClient>,
  items: DebtRow[],
  amount: number,
  accountName?: string
) {
  let leftover = roundMoney(amount);
  const settledOn = todayDate();

  for (const item of items) {
    if (leftover <= 0) break;
    const itemAmount = roundMoney(Number(item.amount));
    const take = roundMoney(Math.min(itemAmount, leftover));
    leftover = roundMoney(leftover - take);
    const remaining = roundMoney(itemAmount - take);

    if (remaining <= 0) {
      let desc = item.description || '';
      if (accountName && !desc.includes(`Settled via ${accountName}`)) {
        desc = desc ? `${desc} • Settled via ${accountName}` : `Settled via ${accountName}`;
      }
      const updateData: { status: string; description?: string } = { status: 'settled' };
      if (desc) updateData.description = desc;

      const { error } = await sb.from('debts').update(updateData).eq('id', item.id);
      if (error) throw new AppError(400, error.message);
    } else {
      const { error: updateError } = await sb
        .from('debts')
        .update({ amount: remaining })
        .eq('id', item.id);
      if (updateError) throw new AppError(400, updateError.message);

      let partialDesc = item.description
        ? `Partial settle: ${item.description}`
        : 'Partial settlement';
      if (accountName && !partialDesc.includes(`Settled via ${accountName}`)) {
        partialDesc = `${partialDesc} • Settled via ${accountName}`;
      }

      const { error: insertError } = await sb.from('debts').insert({
        friend_name: item.friend_name,
        type: item.type,
        amount: take,
        description: partialDesc,
        status: 'settled',
        date: settledOn,
      });
      if (insertError) throw new AppError(400, insertError.message);
    }
  }

  if (leftover > 0.009) {
    throw new AppError(400, 'Settle amount is larger than the remaining debt');
  }
}

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

debtsRouter.post(
  '/settle-person',
  validateBody(settlePersonSchema),
  asyncHandler(async (req, res) => {
    const { friend_name, account_id, amount, notes } = req.body as z.infer<typeof settlePersonSchema>;
    const settleAmount = roundMoney(amount);
    const sb = createUserClient(req.accessToken!);

    const { data: pending, error: loadError } = await sb
      .from('debts')
      .select('*')
      .eq('friend_name', friend_name)
      .eq('status', 'pending')
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (loadError) throw new AppError(400, loadError.message);
    const items = (pending ?? []) as DebtRow[];
    if (items.length === 0) throw new AppError(404, 'No pending debts found for this person');

    let lent = 0;
    let borrowed = 0;
    for (const item of items) {
      if (item.type === 'lent') lent += Number(item.amount);
      else borrowed += Number(item.amount);
    }
    const net = roundMoney(lent - borrowed);
    if (net === 0) throw new AppError(400, 'This person is already settled');

    const direction: 'lent' | 'borrowed' = net > 0 ? 'lent' : 'borrowed';
    const pool = items.filter((item) => item.type === direction);
    const outstanding = roundMoney(pool.reduce((sum, item) => sum + Number(item.amount), 0));
    if (settleAmount > outstanding) {
      throw new AppError(400, `Amount cannot exceed remaining ${outstanding}`);
    }

    const { data: account } = await sb
      .from('accounts')
      .select('name')
      .eq('id', account_id)
      .maybeSingle();
    const accountName = account?.name;

    await applySettleTransaction(sb, {
      accountId: account_id,
      type: direction,
      amount: settleAmount,
      friendName: friend_name,
      notes,
    });
    await applyAmountToDebts(sb, pool, settleAmount, accountName);

    res.json({ ok: true, amount: settleAmount, direction, account_name: accountName });
  })
);

debtsRouter.post(
  '/:id/settle',
  validateBody(settleSchema),
  asyncHandler(async (req, res) => {
    const { account_id, amount, notes } = req.body as z.infer<typeof settleSchema>;
    const settleAmount = roundMoney(amount);
    const sb = createUserClient(req.accessToken!);

    const { data: debt, error: loadError } = await sb
      .from('debts')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (loadError || !debt) {
      throw new AppError(404, loadError?.message ?? 'Debt not found');
    }
    if (debt.status !== 'pending') {
      throw new AppError(400, 'Only pending debts can be settled');
    }

    const outstanding = roundMoney(Number(debt.amount));
    if (settleAmount > outstanding) {
      throw new AppError(400, `Amount cannot exceed remaining ${outstanding}`);
    }

    const { data: account } = await sb
      .from('accounts')
      .select('name')
      .eq('id', account_id)
      .maybeSingle();
    const accountName = account?.name;

    await applySettleTransaction(sb, {
      accountId: account_id,
      type: debt.type,
      amount: settleAmount,
      friendName: debt.friend_name,
      notes,
    });
    await applyAmountToDebts(sb, [debt as DebtRow], settleAmount, accountName);

    const { data } = await sb.from('debts').select('*').eq('id', req.params.id).maybeSingle();
    res.json(data ?? { ok: true });
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
