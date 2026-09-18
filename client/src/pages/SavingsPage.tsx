import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Plus, Trash2, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';
import { useSavingGoals, useCreateSavingGoal, useDeleteSavingGoal } from '@/hooks/useSavingGoals';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonGrid, QueryError as ErrorBox } from '@/components/ui';
import { cn } from '@/lib/cn';

export function SavingsPage() {
  const { data: items, isLoading, isError, refetch } = useSavingGoals();
  const { data: accounts } = useAccounts();
  const createItem = useCreateSavingGoal();
  const deleteItem = useDeleteSavingGoal();
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const totalBalance = useMemo(
    () =>
      (accounts ?? [])
        .filter((a) => a.status === 'active')
        .reduce((sum, a) => sum + Number(a.current_balance), 0),
    [accounts],
  );

  const openCreate = () => {
    setName('');
    setPrice('');
    setModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      showToast('Please enter a name and price', 'error');
      return;
    }
    const amount = Number(price);
    if (!(amount > 0)) {
      showToast('Price must be greater than zero', 'error');
      return;
    }

    try {
      await createItem.mutateAsync({
        name: name.trim(),
        target_amount: amount,
        color: '#6366f1',
        icon: 'gift',
        target_date: null,
        notes: null,
      });
      showToast('Added to wishlist', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message || 'Failed to add wishlist item', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteItem.mutateAsync(deleteId);
      showToast('Removed from wishlist', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to remove item', 'error');
    }
    setDeleteId(null);
  };

  const affordableCount =
    items?.filter((item) => totalBalance >= Number(item.target_amount)).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wishlist"
        subtitle="Add things you want — see what your accounts can cover"
        icon={Gift}
        action={
          <button type="button" onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" /> Add item
          </button>
        }
      />

      {(items?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Available in accounts
              </p>
              <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Manageable now
              </p>
              <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {affordableCount} / {items?.length ?? 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid count={3} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : items?.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-6 w-6" />}
          title="Wishlist is empty"
          description="Add something you want with its price to see if your accounts can cover it."
          action={
            <button type="button" onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" /> Add item
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items?.map((item) => {
            const priceValue = Number(item.target_amount);
            const manageable = totalBalance >= priceValue;
            const shortfall = Math.max(0, priceValue - totalBalance);
            const coverage =
              priceValue > 0 ? Math.min(100, Math.round((totalBalance / priceValue) * 100)) : 0;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card flex flex-col overflow-hidden"
              >
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </h3>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {formatCurrency(priceValue)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-error-600 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                      manageable
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
                    )}
                  >
                    {manageable ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Manageable
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" /> Need {formatCurrency(shortfall)} more
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>Account coverage</span>
                      <span className="tabular-nums">{coverage}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          manageable ? 'bg-emerald-500' : 'bg-amber-500',
                        )}
                        style={{ width: `${coverage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add to wishlist"
        description="Just the thing name and its price."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Thing name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. New headphones"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="label">Price *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            {price && Number(price) > 0 && (
              <p
                className={cn(
                  'mt-2 text-xs font-medium',
                  totalBalance >= Number(price)
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400',
                )}
              >
                {totalBalance >= Number(price)
                  ? `Manageable — accounts have ${formatCurrency(totalBalance)}`
                  : `Short by ${formatCurrency(Number(price) - totalBalance)} (accounts: ${formatCurrency(totalBalance)})`}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={createItem.isPending}>
              {createItem.isPending ? 'Adding…' : 'Add item'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove from wishlist"
        description="This will remove the item from your wishlist."
      >
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleDelete}>
            Remove
          </button>
        </div>
      </Modal>
    </div>
  );
}
