import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Plus, Trash2, ArrowRight, AlertCircle, Pencil } from 'lucide-react';
import { useTransfers, useCreateTransfer, useDeleteTransfer, useUpdateTransfer } from '@/hooks/useTransfers';
import { useActiveAccounts } from '@/hooks/useAccounts';
import type { Transfer } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonList, QueryError as ErrorBox } from '@/components/ui';
import { AccountIcon } from '@/components/accounts/AccountIcon';
import { cn } from '@/lib/cn';

export function TransfersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTransfer, setEditTransfer] = useState<Transfer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: transfers, isLoading, isError, refetch } = useTransfers();
  const deleteTransfer = useDeleteTransfer();
  const createTransfer = useCreateTransfer();
  const { showToast } = useToast();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const tfToDelete = transfers?.find((t) => t.id === deleteId);
    try {
      await deleteTransfer.mutateAsync(deleteId);
      showToast('Deleted', 'success', tfToDelete ? {
        label: 'Undo',
        onClick: async () => {
          try {
            await createTransfer.mutateAsync({
              from_account_id: tfToDelete.from_account_id,
              to_account_id: tfToDelete.to_account_id,
              amount: Number(tfToDelete.amount),
              fee: Number(tfToDelete.fee),
              date: tfToDelete.date,
              time: tfToDelete.time,
              description: tfToDelete.description || '',
              notes: tfToDelete.notes || '',
            });
            showToast('Transfer restored', 'success');
          } catch (err) {
            showToast('Failed to restore transfer', 'error');
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
        title="Transfers"
        subtitle="Move money between your accounts"
        icon={ArrowLeftRight}
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Transfer</span>
          </button>
        }
      />

      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : (transfers ?? []).length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="h-6 w-6" />}
          title="No transfers yet"
          description="Move money between accounts — bank to cash, cash to bank, and more."
          action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Transfer</button>}
        />
      ) : (
        <div className="space-y-3">
          {(transfers ?? []).map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card card-hover group flex items-center gap-3 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: t.from_account?.color ?? '#64748b' }}>
                  <AccountIcon icon={t.from_account?.icon ?? 'wallet'} className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: t.to_account?.color ?? '#64748b' }}>
                  <AccountIcon icon={t.to_account?.icon ?? 'wallet'} className="h-4 w-4" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {t.from_account?.name} → {t.to_account?.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>{formatDate(t.date)}</span>
                  <span>·</span>
                  <span>{formatTime(t.time)}</span>
                  {t.fee > 0 && (<><span>·</span><span>Fee: {formatCurrency(Number(t.fee))}</span></>)}
                  {t.description && (<><span>·</span><span className="truncate">{t.description}</span></>)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(Number(t.amount))}</span>
                <button
                  onClick={() => setEditTransfer(t)}
                  className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-indigo-600 group-hover:opacity-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteId(t.id)}
                  className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-error-50 hover:text-error-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <TransferFormModal
        open={modalOpen || !!editTransfer}
        transfer={editTransfer}
        onClose={() => {
          setModalOpen(false);
          setEditTransfer(null);
        }}
      />

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Transfer?"
        description="This will reverse the balance changes on both accounts."
        size="sm"
      >
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={deleteTransfer.isPending} className="btn-danger flex-1">
            {deleteTransfer.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function TransferFormModal({ open, onClose, transfer }: { open: boolean; onClose: () => void; transfer?: Transfer | null }) {
  const { data: accounts } = useActiveAccounts();
  const createTransfer = useCreateTransfer();
  const updateTransfer = useUpdateTransfer();
  const { showToast } = useToast();

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (transfer) {
        setFromId(transfer.from_account_id);
        setToId(transfer.to_account_id);
        setAmount(transfer.amount.toString());
        setFee(transfer.fee.toString());
        setDate(transfer.date);
        setTime(transfer.time.slice(0, 5));
        setDescription(transfer.description || '');
        setNotes(transfer.notes || '');
        setError(null);
      } else {
        setFromId(''); setToId(''); setAmount(''); setFee('0');
        setDate(new Date().toISOString().split('T')[0]);
        setTime(new Date().toTimeString().slice(0, 5));
        setDescription(''); setNotes(''); setError(null);
      }
    }
  }, [open, transfer]);

  const fromAccount = (accounts ?? []).find((a) => a.id === fromId);
  const sameAccount = fromId === toId;

  // Balance sufficiency validation adjustments for editing:
  const currentDiff = transfer && transfer.from_account_id === fromId ? (transfer.amount + transfer.fee) : 0;
  const availableBalance = fromAccount ? (Number(fromAccount.current_balance) + currentDiff) : 0;
  const insufficient = fromAccount && parseFloat(amount) + (parseFloat(fee) || 0) > availableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fromId || !toId) { setError('Select both accounts'); return; }
    if (sameAccount) { setError('Source and destination must be different'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Amount must be positive'); return; }
    if (insufficient) { setError('Insufficient balance in source account'); return; }

    try {
      if (transfer) {
        await updateTransfer.mutateAsync({
          id: transfer.id,
          from_account_id: fromId,
          to_account_id: toId,
          amount: parseFloat(amount),
          fee: parseFloat(fee) || 0,
          date, time,
          description, notes,
        });
        showToast('Transfer updated successfully', 'success');
      } else {
        await createTransfer.mutateAsync({
          from_account_id: fromId,
          to_account_id: toId,
          amount: parseFloat(amount),
          fee: parseFloat(fee) || 0,
          date, time,
          description, notes,
        });
        showToast('Transfer completed successfully', 'success');
      }
      onClose();
    } catch (err) {
      const msg = (err as Error).message || 'Transfer failed';
      setError(msg);
      showToast(msg, 'error');
    }
  };

  const isPending = createTransfer.isPending || updateTransfer.isPending;

  return (
    <Modal open={open} onClose={onClose} title={transfer ? "Edit Transfer" : "New Transfer"} description={transfer ? "Update transfer details." : "Move money between accounts atomically."}>
      {accounts && accounts.length < 2 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">You need at least 2 accounts to make a transfer.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">From Account</label>
            <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)} required>
              <option value="">Select source...</option>
              {(accounts ?? []).map((a) => {
                const balanceDiff = transfer && transfer.from_account_id === a.id ? (transfer.amount + transfer.fee) : 0;
                const balance = Number(a.current_balance) + balanceDiff;
                return (
                  <option key={a.id} value={a.id}>{a.name} ({formatCurrency(balance)})</option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="label">To Account</label>
            <select className={cn('input', sameAccount && 'border-error-400')} value={toId} onChange={(e) => setToId(e.target.value)} required>
              <option value="">Select destination...</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {sameAccount && <p className="mt-1 text-xs text-error-600">Source and destination must be different</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                <input className="input pl-8" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              {insufficient && <p className="mt-1 text-xs text-error-600">Exceeds available balance</p>}
            </div>
            <div>
              <label className="label">Fee (optional)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                <input className="input pl-8" type="number" step="0.01" placeholder="0.00" value={fee} onChange={(e) => setFee(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Time</label>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <input className="input" placeholder="e.g. Move savings" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving...' : transfer ? 'Save Changes' : 'Transfer'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
