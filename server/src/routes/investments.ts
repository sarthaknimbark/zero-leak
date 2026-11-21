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
        .limit(30),
      sb
        .from('transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .contains('tags', ['investment'])
        .order('date', { ascending: false })
        .limit(30),
    ]);

    if (accountsRes.error) throw new AppError(400, accountsRes.error.message);

    const accounts = accountsRes.data ?? [];
    const totalInvested = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

    const invAccountIds = new Set(accounts.map((a) => a.id));
    const investmentTransfers = (transfersRes.data ?? []).filter(
      (t) => invAccountIds.has(t.from_account_id) || invAccountIds.has(t.to_account_id)
    );

    res.json({
      accounts,
      totalInvested,
      transfers: investmentTransfers,
      transactions: txRes.data ?? [],
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

      const invBalance = Number(invAcc.current_balance) || 0;

      let calcResult;
      try {
        calcResult = calculateWithdrawal({
          currentInvestmentBalance: invBalance,
          investedPrincipalToWithdraw: Number(body.invested_amount),
          withdrawnAmount: Number(body.withdrawn_amount),
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
        extraToDepositDestination: extraToDeposit,
      } = calcResult;

      const formattedDiff = (diff >= 0 ? '+' : '') + diff.toFixed(2);
      const formattedReturn = `${diff >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;

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

      if (diff >= 0) {
        // Profit or Break-even
        const transferAmt = Math.min(invBalance, invested);
        let transferId: string | null = null;

        if (transferAmt > 0) {
          const { data: tfData, error: tfErr } = await sb.rpc('apply_transfer', {
            p_from_account_id: body.from_investment_account_id,
            p_to_account_id: body.to_account_id,
            p_amount: transferAmt,
            p_fee: 0,
            p_date: body.date,
            p_time: timeStr,
            p_description: body.description || `Investment Return from ${invAcc.name}`,
            p_notes: `Invested: ₹${invested.toFixed(2)} → Withdrawn: ₹${withdrawn.toFixed(2)} | Net Return: ₹${formattedDiff} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
          });
          if (tfErr) throw new AppError(400, tfErr.message);
          transferId = tfData;
        }

        const profitToAdd = Math.round((withdrawn - transferAmt) * 100) / 100;
        let txId: string | null = null;

        if (profitToAdd > 0) {
          const { data: txData, error: txErr } = await sb.rpc('apply_transaction', {
            p_account_id: body.to_account_id,
            p_category_id: invCatId,
            p_type: 'income',
            p_amount: profitToAdd,
            p_date: body.date,
            p_time: timeStr,
            p_description: `Investment Gain: ${body.description || invAcc.name + ' Return'}`,
            p_tags: [...(body.tags || []), 'investment', 'profit'],
            p_notes: `Invested: ₹${invested.toFixed(2)} → Withdrawn: ₹${withdrawn.toFixed(2)} | Profit: ₹${formattedDiff} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
            p_attachment_url: null,
          });
          if (txErr) throw new AppError(400, txErr.message);
          txId = txData;
        }

        const remainingBal = Math.max(0, Math.round((invBalance - transferAmt) * 100) / 100);

        return res.status(201).json({
          ok: true,
          action: 'withdraw',
          invested_amount: invested,
          withdrawn_amount: withdrawn,
          profit_loss: diff,
          return_percentage: returnPct,
          remaining_balance: remainingBal,
          transfer_id: transferId,
          transaction_id: txId,
        });
      } else {
        // Realized Loss (withdrawn < invested)
        const loss = Math.abs(diff);
        const transferAmt = Math.min(invBalance, withdrawn);
        let transferId: string | null = null;

        if (transferAmt > 0) {
          const { data: tfData, error: tfErr } = await sb.rpc('apply_transfer', {
            p_from_account_id: body.from_investment_account_id,
            p_to_account_id: body.to_account_id,
            p_amount: transferAmt,
            p_fee: 0,
            p_date: body.date,
            p_time: timeStr,
            p_description: body.description || `Investment Withdrawal from ${invAcc.name}`,
            p_notes: `Invested: ₹${invested.toFixed(2)} → Withdrawn: ₹${withdrawn.toFixed(2)} | Net Loss: -₹${loss.toFixed(2)} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
          });
          if (tfErr) throw new AppError(400, tfErr.message);
          transferId = tfData;
        }

        // Deduct the loss from the investment account
        const remainingLossInInv = Math.min(invBalance - transferAmt, loss);
        let txId: string | null = null;

        if (remainingLossInInv > 0) {
          const { data: txData, error: txErr } = await sb.rpc('apply_transaction', {
            p_account_id: body.from_investment_account_id,
            p_category_id: null,
            p_type: 'expense',
            p_amount: remainingLossInInv,
            p_date: body.date,
            p_time: timeStr,
            p_description: `Investment Loss: ${body.description || invAcc.name + ' Loss'}`,
            p_tags: [...(body.tags || []), 'investment', 'loss'],
            p_notes: `Invested: ₹${invested.toFixed(2)} → Withdrawn: ₹${withdrawn.toFixed(2)} | Realized Loss: -₹${loss.toFixed(2)} (${formattedReturn})${body.notes ? `\n${body.notes}` : ''}`,
            p_attachment_url: null,
          });
          if (txErr) throw new AppError(400, txErr.message);
          txId = txData;
        }

        const extraToDeposit = Math.round((withdrawn - transferAmt) * 100) / 100;
        if (extraToDeposit > 0) {
          await sb.rpc('apply_transaction', {
            p_account_id: body.to_account_id,
            p_category_id: null,
            p_type: 'income',
            p_amount: extraToDeposit,
            p_date: body.date,
            p_time: timeStr,
            p_description: `Investment Withdrawal: ${body.description || invAcc.name}`,
            p_tags: [...(body.tags || []), 'investment'],
            p_notes: `Invested: ₹${invested.toFixed(2)} → Withdrawn: ₹${withdrawn.toFixed(2)}`,
            p_attachment_url: null,
          });
        }

        const remainingBal = Math.max(0, Math.round((invBalance - transferAmt) * 100) / 100);

        return res.status(201).json({
          ok: true,
          action: 'withdraw',
          invested_amount: invested,
          withdrawn_amount: withdrawn,
          profit_loss: diff,
          return_percentage: returnPct,
          remaining_balance: remainingBal,
          transfer_id: transferId,
          transaction_id: txId,
        });
      }
    }

    throw new AppError(400, 'Invalid action');
  })
);
