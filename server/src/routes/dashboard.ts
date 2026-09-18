import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [accountsRes, txRes, transfersRes, monthTxRes] = await Promise.all([
      sb.from('accounts').select('*').eq('status', 'active'),
      sb
        .from('transactions')
        .select(
          '*, account:accounts(id,name,type,color,icon), category:categories(id,name,color,icon)'
        )
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      sb
        .from('transfers')
        .select(
          '*, from_account:accounts!from_account_id(id,name,type,color,icon), to_account:accounts!to_account_id(id,name,type,color,icon)'
        )
        .order('date', { ascending: false })
        .limit(20),
      sb
        .from('transactions')
        .select('type, amount')
        .gte('date', monthStart),
    ]);

    if (accountsRes.error) throw new AppError(400, accountsRes.error.message);
    if (txRes.error) throw new AppError(400, txRes.error.message);
    if (transfersRes.error) throw new AppError(400, transfersRes.error.message);
    if (monthTxRes.error) throw new AppError(400, monthTxRes.error.message);

    const accounts = accountsRes.data ?? [];
    const transactions = txRes.data ?? [];
    const transfers = transfersRes.data ?? [];
    const monthTx = monthTxRes.data ?? [];

    const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
    const cashBalance = accounts
      .filter((a) => a.type === 'cash')
      .reduce((s, a) => s + Number(a.current_balance), 0);
    const bankBalance = accounts
      .filter((a) => a.type === 'bank')
      .reduce((s, a) => s + Number(a.current_balance), 0);
    const walletBalance = accounts
      .filter((a) => a.type === 'wallet')
      .reduce((s, a) => s + Number(a.current_balance), 0);
    const investmentBalance = accounts
      .filter((a) => a.type === 'investment')
      .reduce((s, a) => s + Number(a.current_balance), 0);

    const monthIncome = monthTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = monthTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);

    res.json({
      accounts,
      transactions,
      transfers,
      totalBalance,
      cashBalance,
      bankBalance,
      walletBalance,
      investmentBalance,
      monthIncome,
      monthExpense,
      savings: monthIncome - monthExpense,
      netWorth: totalBalance,
    });
  })
);
