import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight,
  Plus, Wallet, ArrowRightLeft, Sparkles, PieChart,
  Percent, CheckCircle2, AlertCircle, RefreshCw, Trash2,
} from 'lucide-react';
import { useInvestments, useDeleteInvestment } from '@/hooks/useInvestments';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { TransactionFormModal } from '@/components/transactions/TransactionFormModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonList, QueryError as ErrorBox } from '@/components/ui';
import { AccountIcon } from '@/components/accounts/AccountIcon';
import { cn } from '@/lib/cn';
import type { InvestmentHistoryItem } from '@/lib/types';

type HistoryFilter = 'all' | 'deposit' | 'withdrawal' | 'profit' | 'loss';

export function InvestmentsPage() {
  const { data: invData, isLoading, isError, refetch } = useInvestments();
  const { data: allAccounts } = useAccounts();
  const deleteInvestment = useDeleteInvestment();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialAction, setModalInitialAction] = useState<'invest' | 'withdraw'>('invest');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InvestmentHistoryItem | null>(null);

  const investmentAccounts = useMemo(() => {
    return (allAccounts ?? []).filter((a) => a.type === 'investment' && a.status === 'active');
  }, [allAccounts]);

  const totalPortfolioValue = invData?.totalPortfolioValue ?? investmentAccounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalInvested = invData?.totalInvested ?? 0;
  const totalWithdrawn = invData?.totalWithdrawn ?? 0;
  const totalProfit = invData?.totalProfit ?? 0;
  const totalLoss = invData?.totalLoss ?? 0;
  const netProfitLoss = invData?.netProfitLoss ?? (totalProfit - totalLoss);
  const totalROI = invData?.totalROI ?? (totalInvested > 0 ? (netProfitLoss / totalInvested) * 100 : 0);

  const history = invData?.history ?? [];
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    return history.filter((item) => item.type === historyFilter);
  }, [history, historyFilter]);

  const openModal = (action: 'invest' | 'withdraw') => {
    setModalInitialAction(action);
    setModalOpen(true);
  };

  const handleDeleteInvestment = async () => {
    if (!deleteConfirmItem) return;
    try {
      await deleteInvestment.mutateAsync(deleteConfirmItem.id);
      showToast('Investment entry deleted and balances restored', 'success');
      setDeleteConfirmItem(null);
    } catch (err) {
      showToast((err as Error).message || 'Failed to delete investment entry', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Investments"
          subtitle="Track your investment portfolio, returns, and realized profit & loss"
          icon={TrendingUp}
        />
        <SkeletonList count={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Investments"
          subtitle="Track your investment portfolio, returns, and realized profit & loss"
          icon={TrendingUp}
        />
        <ErrorBox onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <PageHeader
        title="Investments"
        subtitle="Track your investment portfolio, returns, and realized profit & loss"
        icon={TrendingUp}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModal('withdraw')}
              className="btn-secondary text-xs sm:text-sm"
            >
              <ArrowDownLeft className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Withdraw</span>
            </button>
            <button
              onClick={() => openModal('invest')}
              className="btn-primary text-xs sm:text-sm bg-purple-600 hover:bg-purple-700 border-purple-600"
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Invest</span>
            </button>
          </div>
        }
      />

      {/* ── Top Summary Metrics Cards ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Portfolio Value */}
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Portfolio Value
            </span>
            <div className="rounded-xl bg-purple-100 dark:bg-purple-950/60 p-2 text-purple-600 dark:text-purple-400">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-slate-50">
            {formatCurrency(totalPortfolioValue)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Across {investmentAccounts.length} active {investmentAccounts.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>

        {/* Realized Net Profit / Loss */}
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Realized P&L
            </span>
            <div
              className={cn(
                'rounded-xl p-2',
                netProfitLoss >= 0
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
              )}
            >
              {netProfitLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p
              className={cn(
                'text-2xl font-black tabular-nums',
                netProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {netProfitLoss >= 0 ? '+' : ''}{formatCurrency(netProfitLoss)}
            </p>
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums',
                netProfitLoss >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
              )}
            >
              {totalROI >= 0 ? '+' : ''}{totalROI.toFixed(1)}% ROI
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Profit: +{formatCurrency(totalProfit)} · Loss: -{formatCurrency(totalLoss)}
          </p>
        </div>

        {/* Capital Flows: Invested */}
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Invested
            </span>
            <div className="rounded-xl bg-indigo-100 dark:bg-indigo-950/60 p-2 text-indigo-600 dark:text-indigo-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatCurrency(totalInvested)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Cumulative principal deposits
          </p>
        </div>

        {/* Capital Flows: Withdrawn */}
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Withdrawn
            </span>
            <div className="rounded-xl bg-teal-100 dark:bg-teal-950/60 p-2 text-teal-600 dark:text-teal-400">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums text-teal-600 dark:text-teal-400">
            {formatCurrency(totalWithdrawn)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Principal redeemed back to bank
          </p>
        </div>
      </div>

      {/* ── Holdings & Accounts ────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-purple-600" />
            <span>Investment Holdings</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Total: {formatCurrency(totalPortfolioValue)}
          </span>
        </div>

        {investmentAccounts.length === 0 ? (
          <div className="card p-6 text-center space-y-3 border-dashed">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Investment Accounts Found</p>
              <p className="text-xs text-slate-400 mt-0.5">Create your first investment account (e.g. Stocks, Mutual Funds, Crypto, Gold) to begin tracking.</p>
            </div>
            <button
              onClick={() => openModal('invest')}
              className="btn-primary mx-auto text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Create Investment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {investmentAccounts.map((acc) => {
              const balance = Number(acc.current_balance || 0);
              const sharePercent = totalPortfolioValue > 0 ? (balance / totalPortfolioValue) * 100 : 0;

              return (
                <div
                  key={acc.id}
                  className="card p-4 flex flex-col justify-between hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: acc.color || '#8b5cf6' }}
                      >
                        <AccountIcon icon={acc.icon || 'trending-up'} className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{acc.name}</h3>
                        {acc.institution && (
                          <p className="text-[11px] text-slate-400 font-medium">{acc.institution}</p>
                        )}
                      </div>
                    </div>
                    <span className="badge bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {sharePercent.toFixed(1)}% of Portfolio
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Current Balance</p>
                      <p className="text-lg font-black tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(balance)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openModal('invest')}
                        className="rounded-lg px-2 py-1 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60 transition"
                      >
                        + Invest
                      </button>
                      {balance > 0 && (
                        <button
                          onClick={() => openModal('withdraw')}
                          className="rounded-lg px-2 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Investment Activity & History ───────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-purple-600" />
            <span>Investment Activity & Settlements</span>
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'all', label: 'All Activity' },
                { id: 'deposit', label: 'Deposits' },
                { id: 'withdrawal', label: 'Principal Returned' },
                { id: 'profit', label: 'Profits' },
                { id: 'loss', label: 'Losses' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setHistoryFilter(f.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap',
                  historyFilter === f.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="card p-8 text-center text-slate-400 text-xs">
            No investment activity matches the selected filter.
          </div>
        ) : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
            {filteredHistory.map((item) => {
              const isProfit = item.type === 'profit';
              const isLoss = item.type === 'loss';
              const isDeposit = item.type === 'deposit';
              const isWithdrawal = item.type === 'withdrawal';

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                >
                  {/* Activity Badge Icon */}
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                      isDeposit && 'bg-purple-600',
                      isWithdrawal && 'bg-indigo-600',
                      isProfit && 'bg-emerald-600',
                      isLoss && 'bg-rose-600'
                    )}
                  >
                    {isDeposit && <ArrowUpRight className="h-5 w-5" />}
                    {isWithdrawal && <ArrowDownLeft className="h-5 w-5" />}
                    {isProfit && <TrendingUp className="h-5 w-5" />}
                    {isLoss && <TrendingDown className="h-5 w-5" />}
                  </div>

                  {/* Title & Meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.description}
                      </p>
                      {item.is_full_settlement && (
                        <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-[10px] font-bold px-2 py-0.2 rounded-full">
                          100% Settled
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{item.account_name}</span>
                      {item.related_account_name && (
                        <>
                          <span>➔</span>
                          <span>{item.related_account_name}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDate(item.date)}</span>
                      <span>·</span>
                      <span>{formatTime(item.time)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-black tabular-nums',
                          isDeposit && 'text-purple-600 dark:text-purple-400',
                          isWithdrawal && 'text-indigo-600 dark:text-indigo-400',
                          isProfit && 'text-emerald-600 dark:text-emerald-400',
                          isLoss && 'text-rose-600 dark:text-rose-400'
                        )}
                      >
                        {isProfit ? '+' : isLoss ? '-' : ''}
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {isDeposit
                          ? 'Invested'
                          : isWithdrawal
                          ? 'Principal Return'
                          : isProfit
                          ? 'Gain Credited'
                          : 'Realized Loss'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmItem(item)}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition"
                      title="Delete investment entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirmation Modal for Delete ────────────────────────── */}
      <Modal
        open={!!deleteConfirmItem}
        onClose={() => setDeleteConfirmItem(null)}
        title="Delete Investment Entry"
        description="Are you sure you want to delete this investment record? Account balances will be automatically restored."
      >
        <div className="space-y-4 pt-2">
          {deleteConfirmItem && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20 p-3 text-xs text-rose-900 dark:text-rose-200">
              <p className="font-bold">{deleteConfirmItem.description}</p>
              <p className="mt-0.5 opacity-90">
                Amount: <strong>{formatCurrency(deleteConfirmItem.amount)}</strong> · {deleteConfirmItem.account_name}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmItem(null)}
              className="btn-secondary text-xs"
              disabled={deleteInvestment.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteInvestment}
              className="btn-danger text-xs flex items-center gap-1.5"
              disabled={deleteInvestment.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deleteInvestment.isPending ? 'Deleting...' : 'Delete Entry'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Transaction Modal for Invest / Withdraw ──────────────── */}
      <TransactionFormModal
        open={modalOpen}
        initialType="investment"
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
