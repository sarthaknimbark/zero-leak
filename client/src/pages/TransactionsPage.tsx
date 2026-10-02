import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Search, Trash2, Filter, X,
  ArrowDownCircle, ArrowUpCircle, Pencil, CalendarDays, CalendarClock,
} from 'lucide-react';
import { useTransactions, type TransactionFilters, useDeleteTransaction, useCreateTransaction } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import type { Transaction } from '@/lib/types';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { AccountIcon } from '@/components/accounts/AccountIcon';
import { PageHeader } from '@/components/ui/PageHeader';
import { TransactionFormModal } from '@/components/transactions/TransactionFormModal';
import { SkeletonList, QueryError as ErrorBox } from '@/components/ui';
import { cn } from '@/lib/cn';

// ─── helper: compute summary stats ───────────────────────────────────────────
function computeStats(txns: Transaction[]) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let todayExpense = 0, todayIncome = 0;
  let monthExpense = 0, monthIncome = 0;

  for (const tx of txns) {
    const amt = Number(tx.amount);
    if (tx.date === todayStr) {
      if (tx.type === 'expense') todayExpense += amt;
      else if (tx.type === 'income') todayIncome += amt;
    }
    if (tx.date.startsWith(thisMonthPrefix)) {
      if (tx.type === 'expense') monthExpense += amt;
      else if (tx.type === 'income') monthIncome += amt;
    }
  }
  return { todayExpense, todayIncome, monthExpense, monthIncome };
}

// ─── summary card ──────────────────────────────────────────────────────────
function SummaryCard({
  label, amount, icon: Icon, accent, sub,
}: {
  label: string;
  amount: number;
  icon: React.ElementType;
  accent: 'rose' | 'emerald';
  sub: string;
}) {
  const isRose = accent === 'rose';
  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-2xl border p-4 overflow-hidden',
      isRose
        ? 'border-rose-100/70 bg-gradient-to-br from-rose-50/60 to-red-50/30 dark:border-rose-900/30 dark:from-rose-950/20 dark:to-red-950/10'
        : 'border-emerald-100/70 bg-gradient-to-br from-emerald-50/60 to-teal-50/30 dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-teal-950/10',
    )}>
      {/* decorative blob */}
      <div className={cn(
        'absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20',
        isRose ? 'bg-rose-400' : 'bg-emerald-400',
      )} />

      <div className={cn(
        'shrink-0 flex h-9 w-9 items-center justify-center rounded-xl',
        isRose
          ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <p className={cn(
          'mt-0.5 text-base font-black tabular-nums leading-tight truncate',
          isRose ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
        )}>
          {isRose ? '-' : '+'}{formatCurrency(amount)}
        </p>
        <p className="text-[9px] text-slate-400 mt-0.5 font-medium">{sub}</p>
      </div>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────
export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { showToast } = useToast();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setEditTransaction(null);
      setModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Fetch all transactions (no filters) to compute stats independently of filter selection
  const { data: allTransactions } = useTransactions({});
  const { data: transactions, isLoading, isError, refetch } = useTransactions({ ...filters, search });

  const deleteTx = useDeleteTransaction();
  const createTx = useCreateTransaction();

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v != null && v !== '').length;
  const grouped = groupByDate(transactions ?? []);

  // Compute today / month stats from the unfiltered data
  const stats = useMemo(() => computeStats(allTransactions ?? []), [allTransactions]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const txToDelete = transactions?.find((t) => t.id === deleteId);
    try {
      await deleteTx.mutateAsync(deleteId);
      showToast('Deleted', 'success', txToDelete ? {
        label: 'Undo',
        onClick: async () => {
          try {
            await createTx.mutateAsync({
              account_id: txToDelete.account_id,
              category_id: txToDelete.category_id || null,
              type: txToDelete.type,
              amount: Number(txToDelete.amount),
              date: txToDelete.date,
              time: txToDelete.time,
              description: txToDelete.description || '',
              tags: txToDelete.tags || [],
              notes: txToDelete.notes || '',
            });
            showToast('Transaction restored', 'success');
          } catch {
            showToast('Failed to restore transaction', 'error');
          }
        }
      } : undefined);
    } catch (err) {
      showToast((err as Error).message || 'Failed to delete', 'error');
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        subtitle="All your income, expenses, and adjustments"
        icon={TrendingUp}
        action={
          <button onClick={() => { setEditTransaction(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
          </button>
        }
      />

      {/* ── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <SummaryCard
          label="Today's Expenses"
          amount={stats.todayExpense}
          icon={TrendingDown}
          accent="rose"
          sub="Outgoing today"
        />
        <SummaryCard
          label="Today's Income"
          amount={stats.todayIncome}
          icon={TrendingUp}
          accent="emerald"
          sub="Incoming today"
        />
        <SummaryCard
          label="Month Expenses"
          amount={stats.monthExpense}
          icon={CalendarDays}
          accent="rose"
          sub="Outgoing this month"
        />
        <SummaryCard
          label="Month Income"
          amount={stats.monthIncome}
          icon={CalendarClock}
          accent="emerald"
          sub="Incoming this month"
        />
      </div>

      {/* ── Search + Filter bar ─────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Search description or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn('btn-secondary relative', activeFilterCount > 0 && 'border-indigo-300 text-indigo-600')}
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card overflow-hidden p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={filters.type ?? ''} onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}>
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div>
              <label className="label">Account</label>
              <select className="input" value={filters.account_id ?? ''} onChange={(e) => setFilters({ ...filters, account_id: e.target.value || undefined })}>
                <option value="">All</option>
                {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={filters.category_id ?? ''} onChange={(e) => setFilters({ ...filters, category_id: e.target.value || undefined })}>
                <option value="">All</option>
                {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sort</label>
              <select className="input" value={filters.sort ?? ''} onChange={(e) => setFilters({ ...filters, sort: e.target.value || undefined })}>
                <option value="">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input className="input" type="date" value={filters.date_from ?? ''} onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })} />
            </div>
            <div>
              <label className="label">To Date</label>
              <input className="input" type="date" value={filters.date_to ?? ''} onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })} />
            </div>
            <div>
              <label className="label">Min Amount</label>
              <input className="input" type="number" placeholder="0" value={filters.min_amount ?? ''} onChange={(e) => setFilters({ ...filters, min_amount: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className="label">Max Amount</label>
              <input className="input" type="number" placeholder="999999" value={filters.max_amount ?? ''} onChange={(e) => setFilters({ ...filters, max_amount: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters({})} className="mt-3 flex items-center gap-1 text-sm text-error-600 hover:text-error-700">
              <X className="h-3.5 w-3.5" /> Clear all filters
            </button>
          )}
        </motion.div>
      )}

      {/* ── Transaction List ───────────────────────────────── */}
      {isLoading ? (
        <SkeletonList count={6} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : (transactions ?? []).length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="No transactions found"
          description="Add your first transaction or adjust your filters."
          action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add Transaction</button>}
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, items]) => {
            // compute per-day total expense
            const dayExpense = items.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
            const dayIncome  = items.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);

            return (
              <div key={date}>
                {/* Date header with daily totals */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDate(date)}</p>
                    <span className="text-[10px] font-medium text-slate-400">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {dayExpense > 0 && (
                      <span className="flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                        <ArrowDownCircle className="h-3 w-3" />
                        -{formatCurrency(dayExpense)}
                      </span>
                    )}
                    {dayIncome > 0 && (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                        <ArrowUpCircle className="h-3 w-3" />
                        +{formatCurrency(dayIncome)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Transaction rows */}
                <div className="card divide-y divide-slate-100 dark:divide-slate-800/60">
                  {items.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group flex items-center gap-3 p-3 sm:p-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      {/* Account colour icon */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: tx.account?.color || '#6366f1' }}
                      >
                        <AccountIcon icon={tx.account?.icon || 'wallet'} className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>

                      {/* Description + meta */}
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {tx.description || tx.category?.name || tx.type}
                        </p>
                        {/* Single row of meta — wraps gracefully on mobile */}
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400 leading-tight mt-0.5">
                          {tx.account?.name && <span className="truncate max-w-[90px]">{tx.account.name}</span>}
                          {tx.category && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="truncate max-w-[80px]">{tx.category.name}</span>
                            </>
                          )}
                          <span className="text-slate-300">·</span>
                          <span className="whitespace-nowrap">{formatTime(tx.time)}</span>
                        </div>
                        {tx.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tx.tags.map((t) => (
                              <span key={t} className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] px-1.5 py-0.5 rounded-md">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Amount + actions — kept together, no wrap */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={cn(
                          'text-sm font-bold tabular-nums whitespace-nowrap',
                          tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400'
                          : tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400'
                          : 'text-indigo-600 dark:text-indigo-400',
                        )}>
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '±'}{formatCurrency(Number(tx.amount))}
                        </span>

                        {/* Edit/Delete — visible on hover (desktop) or always small on mobile */}
                        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:transition">
                          <button
                            onClick={() => setEditTransaction(tx)}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(tx.id)}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-error-50 dark:hover:bg-rose-950/30 hover:text-error-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TransactionFormModal
        open={modalOpen || !!editTransaction}
        transaction={editTransaction}
        onClose={() => {
          setModalOpen(false);
          setEditTransaction(null);
        }}
      />

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Transaction?"
        description="This will reverse the balance effect on the account."
        size="sm"
      >
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={deleteTx.isPending} className="btn-danger flex-1">
            {deleteTx.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    (acc[item.date] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
