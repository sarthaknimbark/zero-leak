import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PiggyBank, Plus, TrendingUp, ArrowRightLeft, Calendar, Trash2, ShieldCheck, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import { useSavingGoals, useCreateSavingGoal, useDeleteSavingGoal, useDepositToGoal, useWithdrawFromGoal } from '@/hooks/useSavingGoals';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonGrid, QueryError as ErrorBox } from '@/components/ui';
import type { SavingGoal } from '@/lib/types';

export function SavingsPage() {
  const { data: goals, isLoading, isError, refetch } = useSavingGoals();
  const { data: accounts } = useAccounts();
  const createGoal = useCreateSavingGoal();
  const deleteGoal = useDeleteSavingGoal();
  const depositToGoal = useDepositToGoal();
  const withdrawFromGoal = useWithdrawFromGoal();
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Deposit / Withdraw states
  const [actionType, setActionType] = useState<'deposit' | 'withdraw' | null>(null);
  const [targetGoal, setTargetGoal] = useState<SavingGoal | null>(null);
  const [transferAccount, setTransferAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('piggy-bank');
  const [notes, setNotes] = useState('');

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#e02424', '#057a55'];
  const icons = ['piggy-bank', 'wallet', 'landmark', 'briefcase', 'gift', 'home', 'car', 'plane', 'graduation-cap'];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      await createGoal.mutateAsync({
        name,
        target_amount: Number(targetAmount),
        color,
        icon,
        target_date: targetDate || null,
        notes: notes || null,
      });
      showToast('Savings pot created successfully', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message || 'Failed to create savings goal', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteGoal.mutateAsync(deleteId);
      showToast('Savings pot deleted', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to delete saving goal', 'error');
    }
    setDeleteId(null);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGoal || !transferAccount || !transferAmount) return;

    const amount = Number(transferAmount);
    if (amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      if (actionType === 'deposit') {
        await depositToGoal.mutateAsync({
          goalId: targetGoal.id,
          accountId: transferAccount,
          amount,
        });
        showToast(`Deposited ${formatCurrency(amount)} into ${targetGoal.name}`, 'success');
      } else {
        await withdrawFromGoal.mutateAsync({
          goalId: targetGoal.id,
          accountId: transferAccount,
          amount,
        });
        showToast(`Withdrew ${formatCurrency(amount)} from ${targetGoal.name}`, 'success');
      }
      setActionType(null);
      setTargetGoal(null);
      setTransferAccount('');
      setTransferAmount('');
    } catch (err) {
      showToast((err as Error).message || 'Transaction failed', 'error');
    }
  };

  const totalSaved = goals?.reduce((sum, g) => sum + Number(g.current_amount), 0) || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saving Goals"
        subtitle="Manage virtual savings pots and grow your emergency funds"
        icon={PiggyBank}
        action={
          <button
            onClick={() => {
              setName('');
              setTargetAmount('');
              setTargetDate('');
              setColor('#6366f1');
              setIcon('piggy-bank');
              setNotes('');
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Create Pot
          </button>
        }
      />

      {/* Hero Stats Card */}
      {goals && goals.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 text-white shadow-xl border border-white/10">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-indigo-200">Total Virtual Savings</p>
              <h2 className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(totalSaved)}</h2>
              <p className="text-xs text-indigo-300/80 mt-0.5">These funds are isolated from your account ledgers to prevent accidental spending.</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid count={3} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : goals?.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No Savings Goals Yet"
          description="Create your first savings pot, e.g., 'Emergency Fund' or 'New Laptop' to start tracking your targets."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Create Saving Pot
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals?.map((goal) => {
            const percentage = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) || 0;
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: goal.color }}
                      >
                        <PiggyBank className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{goal.name}</h3>
                        <p className="text-xs text-slate-450 dark:text-slate-505 truncate mt-0.5">
                          Target: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(goal.target_amount)}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteId(goal.id)}
                      className="p-1.5 text-slate-350 hover:text-error-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Progress Indicator */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(goal.current_amount)}</span>
                      <span className="text-slate-500">{percentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: goal.color }}
                      />
                    </div>
                  </div>

                  {goal.target_date && (
                    <div className="flex items-center gap-1 text-xs text-slate-450 dark:text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Target Date: {formatDate(goal.target_date)}</span>
                    </div>
                  )}

                  {goal.notes && (
                    <p className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-2.5 line-clamp-2">
                      {goal.notes}
                    </p>
                  )}
                </div>

                {/* Transfer Actions */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 px-5 py-3 flex gap-2">
                  <button
                    onClick={() => {
                      setActionType('deposit');
                      setTargetGoal(goal);
                      setTransferAccount(accounts?.[0]?.id || '');
                      setTransferAmount('');
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:text-emerald-650 transition active:scale-95 shadow-sm"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Deposit
                  </button>
                  <button
                    onClick={() => {
                      setActionType('withdraw');
                      setTargetGoal(goal);
                      setTransferAccount(accounts?.[0]?.id || '');
                      setTransferAmount('');
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:text-indigo-650 transition active:scale-95 shadow-sm"
                    disabled={goal.current_amount <= 0}
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5 text-indigo-500" /> Withdraw
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Goal creation modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Saving Pot" description="Virtual pots allocate money without creating extra physical accounts.">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Pot Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. New Laptop, Vacation fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Target Amount *</label>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Target Date</label>
              <input
                type="date"
                className="input"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Select Theme Color</label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform border border-white dark:border-slate-900 ${
                    color === c ? 'scale-120 ring-2 ring-indigo-500/50' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notes / Goal Description</label>
            <textarea
              className="input h-20 resize-none"
              placeholder="Describe what this savings pot is for..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Pot
            </button>
          </div>
        </form>
      </Modal>

      {/* Deposit / Withdraw Funds Modal */}
      <Modal
        open={!!actionType}
        onClose={() => { setActionType(null); setTargetGoal(null); }}
        title={actionType === 'deposit' ? 'Deposit Funds to Pot' : 'Withdraw Funds from Pot'}
        description={actionType === 'deposit' ? 'Move money from your physical ledger accounts to the savings pot.' : 'Retrieve money from the savings pot to your ledger accounts.'}
      >
        {targetGoal && (
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200/40 dark:border-slate-800/40 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Savings Pot</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{targetGoal.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Current Saved</span>
                <span className="font-bold text-indigo-650 dark:text-indigo-400">{formatCurrency(targetGoal.current_amount)}</span>
              </div>
            </div>

            <div>
              <label className="label">Choose Account *</label>
              <select
                className="input"
                value={transferAccount}
                onChange={(e) => setTransferAccount(e.target.value)}
                required
              >
                <option value="" disabled>Select account</option>
                {(accounts ?? []).filter(a => a.status === 'active').map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.current_balance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Amount to Transfer *</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" className="btn-secondary" onClick={() => { setActionType(null); setTargetGoal(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!transferAccount || !transferAmount}>
                Complete Transfer
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Savings Pot" description="Are you sure you want to delete this savings pot? The virtual savings pot history will be lost.">
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete Pot</button>
        </div>
      </Modal>
    </div>
  );
}
