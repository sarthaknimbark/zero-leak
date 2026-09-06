import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, Plus, Search, MoreVertical, Archive, Trash2, Edit3, Landmark, Banknote, PiggyBank, TrendingUp,
} from 'lucide-react';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { useToast } from '@/components/ui/Toast';
import type { Account, AccountType } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonGrid, QueryError as ErrorBox } from '@/components/ui';
import { AccountIcon, accountIcons } from '@/components/accounts/AccountIcon';
import { cn } from '@/lib/cn';

const accountColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
const typeLabels: Record<AccountType, string> = { cash: 'Cash', bank: 'Bank', wallet: 'Wallet', investment: 'Investment' };
const typeIcons: Record<AccountType, typeof Wallet> = { cash: Banknote, bank: Landmark, wallet: Wallet, investment: TrendingUp };

export function AccountsPage() {
  const { data: accounts, isLoading, isError, refetch } = useAccounts();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setEditAccount(null);
      setModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const filtered = (accounts ?? []).filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase()) ||
    (a.institution ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const active = filtered.filter((a) => a.status === 'active');
  const archived = filtered.filter((a) => a.status === 'archived');

  return (
    <div className="space-y-6" onClick={() => setMenuId(null)}>
      <PageHeader
        title="Accounts"
        subtitle="Manage your cash, banks, wallets, and investments"
        icon={Wallet}
        action={
          <button onClick={() => { setEditAccount(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Account</span>
          </button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <SkeletonGrid count={4} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No accounts yet"
          description="Create a cash wallet or bank account to start tracking your money."
          action={
            <button onClick={() => { setEditAccount(null); setModalOpen(true); }} className="btn-primary">
              <Plus className="h-4 w-4" /> Add Account
            </button>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-500">Active ({active.length})</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((acc, i) => (
                  <AccountCard key={acc.id} account={acc} index={i} onEdit={() => { setEditAccount(acc); setModalOpen(true); }} menuId={menuId} setMenuId={setMenuId} />
                ))}
              </div>
            </div>
          )}
          {archived.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-400">Archived ({archived.length})</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((acc, i) => (
                  <AccountCard key={acc.id} account={acc} index={i} onEdit={() => { setEditAccount(acc); setModalOpen(true); }} menuId={menuId} setMenuId={setMenuId} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AccountFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        account={editAccount}
      />
    </div>
  );
}

function AccountCard({
  account, index, onEdit, menuId, setMenuId,
}: {
  account: Account; index: number; onEdit: () => void; menuId: string | null; setMenuId: (id: string | null) => void;
}) {
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const { data: transactions } = useTransactions({ account_id: account.id });
  const { data: transfers } = useTransfers();
  const { showToast } = useToast();

  const txCount = (transactions ?? []).length;
  const transferCount = (transfers ?? []).filter(
    (t) => t.from_account_id === account.id || t.to_account_id === account.id
  ).length;

  const handleArchive = async () => {
    try {
      await updateAccount.mutateAsync({ id: account.id, status: account.status === 'active' ? 'archived' : 'active' });
      showToast(account.status === 'active' ? 'Account archived' : 'Account restored', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to update', 'error');
    }
    setMenuId(null);
  };

  const handleDelete = async () => {
    if (txCount > 0 || transferCount > 0) {
      showToast('Cannot delete an account with transactions. Archive it instead.', 'error');
      setMenuId(null);
      return;
    }
    if (confirm(`Delete "${account.name}"? This cannot be undone.`)) {
      try {
        await deleteAccount.mutateAsync(account.id);
        showToast('Account deleted', 'success');
      } catch (err) {
        showToast((err as Error).message || 'Failed to delete', 'error');
      }
    }
    setMenuId(null);
  };

  const TypeIcon = typeIcons[account.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="card card-hover relative overflow-hidden p-5"
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-5" style={{ backgroundColor: account.color }} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: account.color }}>
            <AccountIcon icon={account.icon} className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900">{account.name}</p>
            <p className="text-xs text-slate-400">{account.institution || typeLabels[account.type]}</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === account.id ? null : account.id); }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuId === account.id && (
            <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-float">
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Edit3 className="h-4 w-4" /> Edit
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleArchive(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Archive className="h-4 w-4" /> {account.status === 'active' ? 'Archive' : 'Unarchive'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-error-600 hover:bg-error-50">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="relative mt-4 text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(Number(account.current_balance))}</p>
      <div className="relative mt-3 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <TypeIcon className="h-3.5 w-3.5" /> {typeLabels[account.type]}
        </span>
        <span>{txCount + transferCount} activities</span>
      </div>
    </motion.div>
  );
}

function AccountFormModal({ open, onClose, account }: { open: boolean; onClose: () => void; account: Account | null }) {
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const { showToast } = useToast();
  const isEdit = !!account;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [institution, setInstitution] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [color, setColor] = useState(accountColors[0]);
  const [icon, setIcon] = useState('wallet');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName(account?.name ?? '');
      setType(account?.type ?? 'bank');
      setInstitution(account?.institution ?? '');
      setOpeningBalance(account ? String(account.opening_balance) : '0');
      setColor(account?.color ?? accountColors[0]);
      setIcon(account?.icon ?? 'wallet');
      setNotes(account?.notes ?? '');
    }
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newOpening = parseFloat(openingBalance) || 0;
    const payload: {
      name: string;
      type: AccountType;
      institution?: string;
      opening_balance: number;
      current_balance?: number;
      color: string;
      icon: string;
      notes?: string;
    } = {
      name,
      type,
      institution: institution || undefined,
      opening_balance: newOpening,
      color,
      icon,
      notes: notes || undefined,
    };
    try {
      if (isEdit && account) {
        const oldOpening = Number(account.opening_balance) || 0;
        const diff = newOpening - oldOpening;
        if (diff !== 0) {
          payload.current_balance = Math.round((Number(account.current_balance) + diff) * 100) / 100;
        }
        await updateAccount.mutateAsync({ id: account.id, ...payload });
        showToast('Account updated', 'success');
      } else {
        await createAccount.mutateAsync(payload);
        showToast('Account created', 'success');
      }
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Failed to save account', 'error');
    }
  };

  const submitting = createAccount.isPending || updateAccount.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Account' : 'New Account'} description="Set up a cash, bank, wallet, or investment account.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Account Name</label>
          <input className="input" placeholder="e.g. HDFC Savings" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="wallet">Wallet</option>
              <option value="investment">Investment</option>
            </select>
          </div>
          <div>
            <label className="label">Institution</label>
            <input className="input" placeholder="e.g. HDFC" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Opening Balance</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
            <input className="input pl-8" type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
          {isEdit && <p className="mt-1 text-xs text-slate-400">Updating opening balance will automatically adjust the current balance.</p>}
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {accountColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn('h-8 w-8 rounded-lg transition', color === c ? 'ring-2 ring-offset-2 ring-slate-400' : '')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Icon</label>
          <div className="flex flex-wrap gap-2">
            {accountIcons.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={cn('flex h-9 w-9 items-center justify-center rounded-lg border transition', icon === ic ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
              >
                <AccountIcon icon={ic} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input min-h-[60px]" placeholder="Account notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
