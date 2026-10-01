import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { sendTestPush } from '../jobs/sendReminders.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

type Notice = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
};

type DueBill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  due_time: string | null;
  status: string;
};

function isDue(bill: DueBill, now: Date) {
  const time = (bill.due_time || '12:00:00').slice(0, 8);
  const dueAt = new Date(`${bill.due_date}T${time}`);
  return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() <= now.getTime();
}

async function syncDueBillNotices(sb: SupabaseClient, userId: string, existing: Notice[]) {
  const { data: bills, error } = await sb
    .from('bills')
    .select('id, name, amount, due_date, due_time, status')
    .neq('status', 'paid');

  if (error || !bills) return existing;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const merged = [...existing];

  for (const bill of bills as DueBill[]) {
    if (!isDue(bill, now)) continue;

    const title = bill.status === 'overdue' ? `Overdue: ${bill.name}` : `Bill due: ${bill.name}`;
    const already = merged.some(
      (n) => n.type === 'bill' && n.title === title && n.created_at.slice(0, 10) === today
    );
    if (already) continue;

    const row = {
      user_id: userId,
      title,
      body: `₹${bill.amount} was due ${bill.due_date}. Mark it paid to clear this reminder.`,
      type: 'bill',
      read: false,
    };

    const inserted = await sb.from('notifications').insert(row).select().maybeSingle();
    if (!inserted.error && inserted.data) {
      merged.unshift(inserted.data as Notice);
      continue;
    }

    merged.unshift({
      id: `due-${bill.id}`,
      ...row,
      created_at: now.toISOString(),
    });
  }

  return merged;
}

notificationsRouter.post(
  '/test',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .select('push_subscription')
      .eq('id', req.user!.id)
      .maybeSingle();

    if (error) throw new AppError(400, error.message);
    const subscription = data?.push_subscription;
    if (!subscription || typeof subscription !== 'object') {
      throw new AppError(400, 'Turn on bill reminders first');
    }

    try {
      await sendTestPush(subscription as Parameters<typeof sendTestPush>[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not deliver the test alert';
      throw new AppError(400, message);
    }

    res.json({ ok: true });
  })
);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const stored = error ? [] : ((data ?? []) as Notice[]);
    const notices = await syncDueBillNotices(sb, req.user!.id, stored);
    notices.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    res.json(notices.slice(0, 50));
  })
);

notificationsRouter.patch(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const { error } = await sb
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user!.id)
      .eq('read', false);

    if (error) throw new AppError(400, error.message);
    res.json({ ok: true });
  })
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    if (req.params.id.startsWith('due-')) {
      res.json({ ok: true });
      return;
    }

    const sb = createUserClient(req.accessToken!);
    const { data, error } = await sb
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  })
);

notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id.startsWith('due-')) {
      res.status(204).send();
      return;
    }

    const sb = createUserClient(req.accessToken!);
    const { error } = await sb
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id);

    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  })
);
