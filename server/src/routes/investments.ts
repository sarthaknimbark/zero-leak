import { Router } from 'express';
import { z } from 'zod';
import { createUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { calculateWithdrawal } from '../lib/investmentLogic.js';

export const investmentsRouter = Router();

investmentsRouter.use(requireAuth);

const investmentSchema = z.object({
  action: z.enum(['invest', 'withdraw']),
  // For 'invest'
  from_account_id: z.string().uuid().optional(),
  to_investment_account_id: z.string().uuid().optional(),
  amount: z.number().positive().optional(),

  // For 'withdraw'
  from_investment_account_id: z.string().uuid().optional(),
  to_account_id: z.string().uuid().optional(),
  invested_amount: z.number().positive().optional(),
  withdrawn_amount: z.number().positive().optional(),
  is_full_settlement: z.boolean().optional().default(false),

  date: z.string().min(1),
  time: z.string().min(1),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().nullable().optional(),
});

investmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);

    const [accountsRes, transfersRes, txRes] = await Promise.all([
      sb.from('accounts').select('*').eq('type', 'investment').eq('status', 'active'),
      sb
        .from('transfers')
        .select('*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      sb
        .from('transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .or('tags.cs.{investment},description.ilike.%Investment%')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (accountsRes.error) throw new AppError(400, accountsRes.error.message);

    const accounts = accountsRes.data ?? [];
    const totalPortfolioValue = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
    const invAccountIds = new Set(accounts.map((a) => a.id));

    const investmentTransfers = (transfersRes.data ?? []).filter(
      (t) => invAccountIds.has(t.from_account_id) || invAccountIds.has(t.to_account_id)
    );
    const investmentTransactions = txRes.data ?? [];

    // Calculate metrics
    let totalInvested = 0;
    let totalWithdrawn = 0;

    for (const t of investmentTransfers) {
      if (invAccountIds.has(t.to_account_id)) {
        totalInvested += Number(t.amount || 0);
      }
      if (invAccountIds.has(t.from_account_id)) {
        totalWithdrawn += Number(t.amount || 0);
      }
    }

    let totalProfit = 0;
    let totalLoss = 0;

    for (const tx of investmentTransactions) {
      if (tx.type === 'income') {
        totalProfit += Number(tx.amount || 0);
      } else if (tx.type === 'expense') {
        totalLoss += Number(tx.amount || 0);
      }
    }

    const netProfitLoss = Math.round((totalProfit - totalLoss) * 100) / 100;
    const totalROI = totalInvested > 0 ? Math.round((netProfitLoss / totalInvested) * 10000) / 100 : 0;

    // Build unified chronological history
    const history: Array<{
      id: string;
      type: 'deposit' | 'withdrawal' | 'profit' | 'loss';
      date: string;
      time: string;
      amount: number;
      description: string;
      account_name: string;
      related_account_name?: string;
      roi?: number;
      is_full_settlement?: boolean;
      notes?: string;
    }> = [];

    // Map transfers
    for (const t of investmentTransfers) {
      const isDeposit = invAccountIds.has(t.to_account_id);
      history.push({
        id: `tf-${t.id}`,
        type: isDeposit ? 'deposit' : 'withdrawal',
        date: t.date,
        time: t.time || '00:00:00',
        amount: Number(t.amount),
        description: t.description || (isDeposit ? 'Investment Deposit' : 'Principal Return'),
        account_name: isDeposit ? (t.to_account?.name || 'Investment') : (t.from_account?.name || 'Investment'),
        related_account_name: isDeposit ? (t.from_account?.name || 'Bank') : (t.to_account?.name || 'Bank'),
        is_full_settlement: (t.notes || '').includes('100% Full Settlement'),
        notes: t.notes || undefined,
      });
    }

    // Map profit and loss transactions
    for (const tx of investmentTransactions) {
      const isProfit = tx.type === 'income';
      history.push({
        id: `tx-${tx.id}`,
        type: isProfit ? 'profit' : 'loss',
        date: tx.date,
        time: tx.time || '00:00:00',
        amount: Number(tx.amount),
        description: tx.description || (isProfit ? 'Investment Profit' : 'Investment Realized Loss'),
        account_name: tx.account?.name || 'Account',
        is_full_settlement: (tx.notes || '').includes('100% Full Settlement'),
        notes: tx.notes || undefined,
      });
    }

    // Sort descending by date and time
    history.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return (b.time || '').localeCompare(a.time || '');
    });

    res.json({
      accounts,
      totalPortfolioValue,
      totalInvested,
      totalWithdrawn,
      totalProfit,
      totalLoss,
      netProfitLoss,
      totalROI,
      transfers: investmentTransfers,
      transactions: investmentTransactions,
      history,
    });
  })
);

investmentsRouter.post(
  '/',
  validateBody(investmentSchema),
  asyncHandler(async (req, res) => {
    const sb = createUserClient(req.accessToken!);
    const body = req.body as z.infer<typeof investmentSchema>;

    if (body.action === 'invest') {
      if (!body.from_account_id) throw new AppError(400, 'Source account is required');
      if (!body.to_investment_account_id) throw new AppError(400, 'Investment account is required');
      if (!body.amount || body.amount <= 0) throw new AppError(400, 'Investment amount must be positive');
      if (body.from_account_id === body.to_investment_account_id) {
        throw new AppError(400, 'Source and investment account cannot be the same');
      }

      const { data, error } = await sb.rpc('apply_transfer', {
        p_from_account_id: body.from_account_id,
        p_to_account_id: body.to_investment_account_id,
        p_amount: body.amount,
        p_fee: 0,
        p_date: body.date,
        p_time: body.time || '00:00:00',
        p_description: body.description || 'Investment Deposit',
        p_notes: body.notes ? `${body.notes} [Investment]` : '[Investment]',
      });

      if (error) throw new AppError(400, error.message);

      return res.status(201).json({
        ok: true,
        action: 'invest',
        transfer_id: data,
        amount: body.amount,
        from_account_id: body.from_account_id,
        to_investment_account_id: body.to_investment_account_id,
      });
    }

    if (body.action === 'withdraw') {
      if (!body.from_investment_account_id) throw new AppError(400, 'Investment account is required');
      if (!body.to_account_id) throw new AppError(400, 'Destination account is required');
      if (!body.invested_amount || body.invested_amount <= 0) throw new AppError(400, 'Invested amount must be positive');
      if (!body.withdrawn_amount || body.withdrawn_amount <= 0) throw new AppError(400, 'Withdrawn amount must be positive');
      if (body.from_investment_account_id === body.to_account_id) {
        throw new AppError(400, 'Investment and destination account cannot be the same');
      }

      const { data: invAcc, error: invErr } = await sb
        .from('accounts')
        .select('*')
        .eq('id', body.from_investment_account_id)
        .single();
      if (invErr || !invAcc) throw new AppError(404, 'Investment account not found');

      const { data: destAcc, error: destErr } = await sb
        .from('accounts')
        .select('*')
        .eq('id', body.to_account_id)
        .single();
      if (destErr || !destAcc) throw new AppError(404, 'Destination bank account not found');

      const invBalance = Number(invAcc.current_balance) || 0;

      let calcResult;
      try {
        calcResult = calculateWithdrawal({
          currentInvestmentBalance: invBalance,
          investedPrincipalToWithdraw: Number(body.invested_amount),
          withdrawnAmount: Number(body.withdrawn_amount),
          isFullSettlement: body.is_full_settlement ?? false,
        });
      } catch (err) {
        throw new AppError(400, (err as Error).message);
      }

      const {
        investedPrincipal: invested,
        withdrawnAmount: withdrawn,
        profitLoss: diff,
        returnPercentage: returnPct,
        remainingInvestmentBalance: remainingBal,
        transferAmountFromInvestment: transferAmt,
        profitToCreditDestination: profitToAdd,
        lossToDeductFromInvestment: remainingLossInInv,
        isFullSettlement,
      } = calcResult;

      const formattedDiff = (diff >= 0 ? '+' : '') + diff.toFixed(2);
      const formattedReturn = `${diff >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
      const settlementLabel = isFullSettlement ? '100% Full Settlement' : 'Partial Withdrawal';

      let invCatId: string | null = null;
      if (diff > 0) {
        const { data: cat } = await sb
          .from('categories')
          .select('id')
          .eq('type', 'income')
          .ilike('name', 'Investments')
          .limit(1)
          .maybeSingle();
        if (cat) invCatId = cat.id;
      }

      const timeStr = body.time || '00:00:00';

      // ─── Entry 1: Principal Amount Returned to Bank ────────────────────────
      let transferId: string | null = null;
      if (transferAmt > 0) {
        const { data: tfData, error: tfErr } = await sb.rpc('apply_transfer', {
          p_from_account_id: body.from_investment_account_id,
          p_to_account_id: body.to_account_id,
          p_amount: transferAmt,
          p_fee: 0,
          p_date: body.date,
          p_time: timeStr,
          p_description: `Investment Principal Returned - ${invAcc.name}`,
          p_notes: `Principal return of ₹${transferAmt.toFixed(2)} (${settlementLabel}). Total liquidation: ₹${withdrawn.toFixed(2)} | Net Return: ₹${formattedDiff} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
        });
        if (tfErr) throw new AppError(400, tfErr.message);
        transferId = tfData;
      }

      // ─── Entry 2: Profit Credited Individually to Bank ─────────────────────
      let profitTxId: string | null = null;
      if (profitToAdd > 0) {
        const { data: txData, error: txErr } = await sb.rpc('apply_transaction', {
          p_account_id: body.to_account_id,
          p_category_id: invCatId,
          p_type: 'income',
          p_amount: profitToAdd,
          p_date: body.date,
          p_time: timeStr,
          p_description: `Investment Profit - ${invAcc.name}`,
          p_tags: [...(body.tags || []), 'investment', 'profit'],
          p_notes: `Realized profit on ${invAcc.name} (${settlementLabel}). Invested: ₹${invested.toFixed(2)} → Liquidated: ₹${withdrawn.toFixed(2)} | Profit: +₹${diff.toFixed(2)} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
          p_attachment_url: null,
        });
        if (txErr) throw new AppError(400, txErr.message);
        profitTxId = txData;
      }

      // ─── Entry 3: Loss Liquidated Individually from Investment Account ──────
      let lossTxId: string | null = null;
      if (remainingLossInInv > 0) {
        const { data: txData, error: txErr } = await sb.rpc('apply_transaction', {
          p_account_id: body.from_investment_account_id,
          p_category_id: null,
          p_type: 'expense',
          p_amount: remainingLossInInv,
          p_date: body.date,
          p_time: timeStr,
          p_description: `Investment Realized Loss - ${invAcc.name}`,
          p_tags: [...(body.tags || []), 'investment', 'loss'],
          p_notes: `Realized market loss on ${invAcc.name} (${settlementLabel}). Invested: ₹${invested.toFixed(2)} → Liquidated: ₹${withdrawn.toFixed(2)} | Net Loss: -₹${Math.abs(diff).toFixed(2)} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
          p_attachment_url: null,
        });
        if (txErr) throw new AppError(400, txErr.message);
        lossTxId = txData;
      }

      return res.status(201).json({
        ok: true,
        action: 'withdraw',
        is_full_settlement: isFullSettlement,
        invested_amount: invested,
        withdrawn_amount: withdrawn,
        profit_loss: diff,
        return_percentage: returnPct,
        remaining_balance: remainingBal,
        transfer_id: transferId,
        profit_transaction_id: profitTxId,
        loss_transaction_id: lossTxId,
      });
    }

    throw new AppError(400, 'Invalid action');
  })
);

investmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const sb = createUserClient(req.accessToken!);

    // Handle transfer entries (deposits and principal returns)
    if (rawId.startsWith('tf-') || rawId.startsWith('transfer-')) {
      const transferId = rawId.replace(/^(tf-|transfer-)/, '');
      const { error } = await sb.rpc('delete_transfer', {
        p_transfer_id: transferId,
      });
      if (error) throw new AppError(400, error.message);
      return res.status(204).send();
    }

    // Handle transaction entries (profits and losses)
    if (rawId.startsWith('tx-')) {
      const txId = rawId.replace(/^tx-/, '');
      const { error } = await sb.rpc('delete_transaction', {
        p_transaction_id: txId,
      });
      if (error) throw new AppError(400, error.message);
      return res.status(204).send();
    }

    // Direct UUID: try delete_transaction first, fallback to delete_transfer
    const { error: txErr } = await sb.rpc('delete_transaction', {
      p_transaction_id: rawId,
    });
    if (!txErr) {
      return res.status(204).send();
    }

    const { error: tfErr } = await sb.rpc('delete_transfer', {
      p_transfer_id: rawId,
    });
    if (tfErr) throw new AppError(400, tfErr.message || txErr.message);

    res.status(204).send();
  })
);
