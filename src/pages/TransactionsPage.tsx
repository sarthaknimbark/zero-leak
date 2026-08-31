import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Search, Trash2, Filter, X,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, Pencil,
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
      setModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const { data: transactions, isLoading, isError, refetch } = useTransactions({ ...filters, search });
  const deleteTx = useDeleteTransaction();
  const createTx = useCreateTransaction();

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v != null && v !== '').length;
  const grouped = groupByDate(transactions ?? []);

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
          } catch (err) {
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
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="All your income, expenses, and adjustments"
        icon={TrendingUp}
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
          </button>
        }
      />

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
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-slate-500">{formatDate(date)}</p>
                <p className="text-xs text-slate-400">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
              </div>
              <div className="card divide-y divide-slate-100">
                {items.map((tx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group flex items-center gap-3 p-3.5 transition hover:bg-slate-50"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: tx.account?.color || '#6366f1' }}
                    >
                      <AccountIcon icon={tx.account?.icon || 'wallet'} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{tx.description || tx.category?.name || tx.type}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span>{tx.account?.name}</span>
                        {tx.category && (<><span>·</span><span>{tx.category.name}</span></>)}
                        <span>·</span>
                        <span>{formatTime(tx.time)}</span>
                      </div>
                      {tx.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tx.tags.map((t) => <span key={t} className="badge bg-slate-100 text-slate-600">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-bold tabular-nums',
                        tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-indigo-600'
                      )}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '±'}{formatCurrency(Number(tx.amount))}
                      </span>
                      <button
                        onClick={() => setEditTransaction(tx)}
                        className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-indigo-600 group-hover:opacity-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(tx.id)}
                        className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-error-50 hover:text-error-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
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
