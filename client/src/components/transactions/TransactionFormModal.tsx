import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tag, X, TrendingUp, TrendingDown, ArrowDownLeft, Plus, Check } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useActiveAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { useCreateInvestment } from '@/hooks/useInvestments';
import { useToast } from '@/components/ui/Toast';
import type { Transaction, TransactionType } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

const schema = z.object({
  type: z.enum(['income', 'expense', 'adjustment']),
  account_id: z.string().min(1, 'Select an account'),
  category_id: z.string().optional(),
  amount: z.string().min(1, 'Amount is required').refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be positive'),
  date: z.string().min(1),
  time: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type TabOption = TransactionType | 'investment';

export function TransactionFormModal({
  open,
  onClose,
  transaction,
  initialType,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  initialType?: TabOption;
}) {
  const { data: accounts } = useActiveAccounts();
  const { data: allCategories } = useCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const createInvestment = useCreateInvestment();
  const createAccount = useCreateAccount();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabOption>('expense');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // ─── Investment state ────────────────────────────────────────────────────────
  const [investAction, setInvestAction] = useState<'invest' | 'withdraw'>('invest');
  const [investFromAccount, setInvestFromAccount] = useState('');
  const [investTargetAccount, setInvestTargetAccount] = useState('');
  const [investAmount, setInvestAmount] = useState('');
  const [withdrawInvestedAmount, setWithdrawInvestedAmount] = useState('');
  const [withdrawReceivedAmount, setWithdrawReceivedAmount] = useState('');
  const [isFullSettlement, setIsFullSettlement] = useState(false);
  const [investDate, setInvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [investTime, setInvestTime] = useState(new Date().toTimeString().slice(0, 5));
  const [investDesc, setInvestDesc] = useState('');
  const [investNotes, setInvestNotes] = useState('');

  // Inline quick create investment account state
  const [showCreateInvAcc, setShowCreateInvAcc] = useState(false);
  const [newInvAccName, setNewInvAccName] = useState('');
  const [newInvAccInst, setNewInvAccInst] = useState('');

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
    },
  });

  const standardType = watch('type');

  useEffect(() => {
    if (open) {
      if (transaction) {
        setActiveTab(transaction.type);
        reset({
          type: transaction.type,
          account_id: transaction.account_id,
          category_id: transaction.category_id || '',
          amount: transaction.amount.toString(),
          date: transaction.date,
          time: transaction.time.slice(0, 5),
          description: transaction.description || '',
          notes: transaction.notes || '',
        });
        setTags(transaction.tags || []);
      } else {
        const defaultTab = initialType || 'expense';
        setActiveTab(defaultTab);
        reset({
          type: defaultTab === 'investment' ? 'expense' : defaultTab,
          account_id: '',
          category_id: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          description: '',
          notes: '',
        });
        setTags([]);
      }
      setTagInput('');
      setInvestAction('invest');
      setInvestAmount('');
      setWithdrawInvestedAmount('');
      setWithdrawReceivedAmount('');
      setInvestDesc('');
      setInvestNotes('');
      setIsFullSettlement(false);
      setShowCreateInvAcc(false);
      setNewInvAccName('');
      setNewInvAccInst('');
    }
  }, [open, transaction, initialType, reset]);

  // Set default accounts for investment when accounts load or tab changes
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const invAccs = accounts.filter((a) => a.type === 'investment');
      const nonInvAccs = accounts.filter((a) => a.type !== 'investment');

      if (!investTargetAccount && invAccs.length > 0) {
        setInvestTargetAccount(invAccs[0].id);
      }
      if (!investFromAccount && nonInvAccs.length > 0) {
        setInvestFromAccount(nonInvAccs[0].id);
      }
    }
  }, [accounts, investTargetAccount, investFromAccount]);

  const categories = (allCategories ?? []).filter((c) =>
    standardType === 'adjustment' ? false : c.type === standardType
  );

  const investmentAccounts = (accounts ?? []).filter((a) => a.type === 'investment');
  const fundingAccounts = (accounts ?? []).filter((a) => a.type !== 'investment');

  const onTabSelect = (tab: TabOption) => {
    setActiveTab(tab);
    if (tab !== 'investment') {
      setValue('type', tab);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  // Quick inline creation of an Investment Account
  const handleQuickCreateInvAccount = async () => {
    const name = newInvAccName.trim();
    if (!name) return;
    try {
      const created = await createAccount.mutateAsync({
        name,
        type: 'investment',
        institution: newInvAccInst.trim() || undefined,
        opening_balance: 0,
        color: '#8b5cf6',
        icon: 'trending-up',
      });
      showToast(`Investment account "${created.name}" created`, 'success');
      setInvestTargetAccount(created.id);
      setShowCreateInvAcc(false);
      setNewInvAccName('');
      setNewInvAccInst('');
    } catch (err) {
      showToast((err as Error).message || 'Failed to create investment account', 'error');
    }
  };

  // Submit standard transaction (Income, Expense, Adjustment)
  const onSubmitStandard = async (data: FormData) => {
    try {
      if (transaction) {
        await updateTx.mutateAsync({
          id: transaction.id,
          account_id: data.account_id,
          category_id: data.category_id || null,
          type: data.type,
          amount: parseFloat(data.amount),
          date: data.date,
          time: data.time,
          description: data.description || '',
          tags,
          notes: data.notes || '',
        });
        showToast('Transaction updated successfully', 'success');
      } else {
        await createTx.mutateAsync({
          account_id: data.account_id,
          category_id: data.category_id || null,
          type: data.type,
          amount: parseFloat(data.amount),
          date: data.date,
          time: data.time,
          description: data.description || '',
          tags,
          notes: data.notes || '',
        });
        showToast('Transaction added successfully', 'success');
      }
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Failed to save transaction', 'error');
    }
  };

  // Submit investment (Invest or Withdraw)
  const onSubmitInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (investAction === 'invest') {
        const amt = parseFloat(investAmount);
        if (isNaN(amt) || amt <= 0) {
          showToast('Please enter a valid investment amount', 'error');
          return;
        }
        if (!investFromAccount) {
          showToast('Please select a payment source account', 'error');
          return;
        }
        if (!investTargetAccount) {
          showToast('Please select an investment account', 'error');
          return;
        }

        await createInvestment.mutateAsync({
          action: 'invest',
          from_account_id: investFromAccount,
          to_investment_account_id: investTargetAccount,
          amount: amt,
          date: investDate,
          time: investTime,
          description: investDesc || 'Investment Deposit',
          tags,
          notes: investNotes || undefined,
        });

        showToast(`Invested ${formatCurrency(amt)} successfully`, 'success');
      } else {
        // Withdraw
        const investedAmt = parseFloat(withdrawInvestedAmount);
        const receivedAmt = parseFloat(withdrawReceivedAmount);

        if (isNaN(investedAmt) || investedAmt <= 0) {
          showToast('Please enter the original invested amount', 'error');
          return;
        }
        if (isNaN(receivedAmt) || receivedAmt <= 0) {
          showToast('Please enter the amount withdrawn / received', 'error');
          return;
        }
        if (!investTargetAccount) {
          showToast('Please select the investment account being withdrawn from', 'error');
          return;
        }
        if (!investFromAccount) {
          showToast('Please select the account receiving the funds', 'error');
          return;
        }

        const diff = receivedAmt - investedAmt;
        const diffText = diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`;

        await createInvestment.mutateAsync({
          action: 'withdraw',
          from_investment_account_id: investTargetAccount,
          to_account_id: investFromAccount,
          invested_amount: investedAmt,
          withdrawn_amount: receivedAmt,
          is_full_settlement: isFullSettlement,
          date: investDate,
          time: investTime,
          description: investDesc || 'Investment Withdrawal',
          tags,
          notes: investNotes || undefined,
        });

        showToast(`Withdrawal of ${formatCurrency(receivedAmt)} recorded (${diff >= 0 ? 'Profit' : 'Loss'}: ${diffText})`, 'success');
      }
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Failed to process investment', 'error');
    }
  };

  const tabs: { value: TabOption; label: string; color: string }[] = [
    { value: 'income', label: 'Income', color: 'success' },
    { value: 'expense', label: 'Expense', color: 'error' },
    { value: 'investment', label: 'Investment', color: 'purple' },
    { value: 'adjustment', label: 'Adjustment', color: 'indigo' },
  ];

  const isPending = createTx.isPending || updateTx.isPending || createInvestment.isPending;

  // Selected accounts for preview
  const selectedSourceAccount = accounts?.find((a) => a.id === investFromAccount);
  const selectedInvestmentAccount = accounts?.find((a) => a.id === investTargetAccount);

  // Return calculation for withdrawal
  const numInvested = parseFloat(withdrawInvestedAmount) || 0;
  const numReceived = parseFloat(withdrawReceivedAmount) || 0;
  const returnDiff = Math.round((numReceived - numInvested) * 100) / 100;
  const returnPercent = numInvested > 0 ? (returnDiff / numInvested) * 100 : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        transaction
          ? 'Edit Transaction'
          : activeTab === 'investment'
          ? 'Investment Transaction'
          : 'New Transaction'
      }
      description={
        transaction
          ? 'Update transaction details.'
          : activeTab === 'investment'
          ? 'Record new investments or withdraw investments with returns tracking.'
          : 'Record income, expense, investment, or balance adjustment.'
      }
    >
      {accounts && accounts.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">You need an account first to record transactions or investments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 4 Option Selector */}
          {!transaction && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onTabSelect(t.value)}
                  className={cn(
                    'rounded-xl border py-2 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1.5',
                    activeTab === t.value
                      ? t.color === 'success'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600 shadow-sm'
                        : t.color === 'error'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-600 shadow-sm'
                        : t.color === 'purple'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-600 shadow-sm'
                        : 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-600 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  )}
                >
                  {t.value === 'investment' && <TrendingUp className="h-3.5 w-3.5" />}
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* INVESTMENT FORM                                                       */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'investment' && !transaction ? (
            <form onSubmit={onSubmitInvestment} className="space-y-4">
              {/* Invest vs Withdraw Direction Toggle */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 p-1">
                <button
                  type="button"
                  onClick={() => setInvestAction('invest')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition',
                    investAction === 'invest'
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  Invest (Deposit)
                </button>
                <button
                  type="button"
                  onClick={() => setInvestAction('withdraw')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition',
                    investAction === 'withdraw'
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  )}
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Withdraw (Redeem)
                </button>
              </div>

              {/* Quick create Investment Account inline if none exists or clicked */}
              {investmentAccounts.length === 0 && !showCreateInvAcc ? (
                <div className="rounded-xl border border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-4 text-center">
                  <p className="text-xs text-purple-900 dark:text-purple-200 font-medium">
                    You don't have an Investment Account yet. Create one to track your investments and reflect on your dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateInvAcc(true)}
                    className="btn-primary mt-2 text-xs py-1.5 px-3 bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Investment Account
                  </button>
                </div>
              ) : showCreateInvAcc ? (
                <div className="rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      New Investment Account
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreateInvAcc(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      className="input text-xs"
                      placeholder="Name (e.g. Mutual Funds, Stocks, Zerodha)"
                      value={newInvAccName}
                      onChange={(e) => setNewInvAccName(e.target.value)}
                    />
                    <input
                      className="input text-xs"
                      placeholder="Institution (optional, e.g. Groww, Vanguard)"
                      value={newInvAccInst}
                      onChange={(e) => setNewInvAccInst(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateInvAcc(false)}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreateInvAccount}
                      disabled={createAccount.isPending || !newInvAccName.trim()}
                      className="btn-primary text-xs py-1 px-3 bg-purple-600 hover:bg-purple-700"
                    >
                      {createAccount.isPending ? 'Creating...' : 'Create & Select'}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* ── Action: INVEST (Deposit) ────────────────────────── */}
              {investAction === 'invest' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Pay From (Source Account)</label>
                      <select
                        className="input"
                        value={investFromAccount}
                        onChange={(e) => setInvestFromAccount(e.target.value)}
                        required
                      >
                        <option value="">Select account...</option>
                        {fundingAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({formatCurrency(Number(a.current_balance))})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label !mb-0">Invest In</label>
                        {!showCreateInvAcc && (
                          <button
                            type="button"
                            onClick={() => setShowCreateInvAcc(true)}
                            className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="h-3 w-3" /> New
                          </button>
                        )}
                      </div>
                      <select
                        className="input"
                        value={investTargetAccount}
                        onChange={(e) => setInvestTargetAccount(e.target.value)}
                        required
                      >
                        <option value="">Select investment account...</option>
                        {investmentAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} (Current: {formatCurrency(Number(a.current_balance))})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Amount to Invest</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                      <input
                        className="input pl-8 font-semibold"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={investAmount}
                        onChange={(e) => setInvestAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Visual flow preview */}
                  {parseFloat(investAmount) > 0 && selectedSourceAccount && selectedInvestmentAccount && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/70 dark:border-purple-900/40 dark:bg-purple-950/20 p-3 text-xs text-purple-900 dark:text-purple-200">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{selectedSourceAccount.name} (-{formatCurrency(parseFloat(investAmount))})</span>
                        <span>➔</span>
                        <span>{selectedInvestmentAccount.name} (+{formatCurrency(parseFloat(investAmount))})</span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-80">
                        This investment moves money into your investment portfolio and reflects in your INVEST balance on the dashboard card.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* ── Action: WITHDRAW (Redeem) ────────────────────────── */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Withdraw From (Investment Account)</label>
                      <select
                        className="input"
                        value={investTargetAccount}
                        onChange={(e) => {
                          setInvestTargetAccount(e.target.value);
                          const acc = accounts?.find((a) => a.id === e.target.value);
                          if (acc && !withdrawInvestedAmount) {
                            setWithdrawInvestedAmount(acc.current_balance.toString());
                          }
                        }}
                        required
                      >
                        <option value="">Select investment account...</option>
                        {investmentAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} (Balance: {formatCurrency(Number(a.current_balance))})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Deposit To (Bank / Cash / Wallet)</label>
                      <select
                        className="input"
                        value={investFromAccount}
                        onChange={(e) => setInvestFromAccount(e.target.value)}
                        required
                      >
                        <option value="">Select destination account...</option>
                        {fundingAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({formatCurrency(Number(a.current_balance))})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Partial Withdrawal Percentage Buttons */}
                  {selectedInvestmentAccount && Number(selectedInvestmentAccount.current_balance) > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Partial Withdrawal Presets:
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Total: {formatCurrency(Number(selectedInvestmentAccount.current_balance))}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[25, 50, 75, 100].map((pct) => {
                          const total = Number(selectedInvestmentAccount.current_balance);
                          const computed = Math.round((total * (pct / 100)) * 100) / 100;
                          const isSelected = Math.abs(numInvested - computed) < 0.05 && (pct !== 100 || isFullSettlement);
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setWithdrawInvestedAmount(computed.toString());
                                setIsFullSettlement(pct === 100);
                              }}
                              className={cn(
                                'rounded-lg py-1.5 px-2 text-xs font-bold border transition text-center',
                                isSelected
                                  ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300 hover:text-purple-600'
                              )}
                            >
                              {pct === 100 ? '100% Full' : `${pct}%`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 100% Full Settlement Switch Card */}
                  <div
                    onClick={() => {
                      const nextVal = !isFullSettlement;
                      setIsFullSettlement(nextVal);
                      if (nextVal && selectedInvestmentAccount) {
                        setWithdrawInvestedAmount(Number(selectedInvestmentAccount.current_balance).toString());
                      }
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none',
                      isFullSettlement
                        ? 'border-purple-500 bg-purple-50/80 dark:border-purple-600 dark:bg-purple-950/30 ring-1 ring-purple-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isFullSettlement}
                      onChange={(e) => {
                        setIsFullSettlement(e.target.checked);
                        if (e.target.checked && selectedInvestmentAccount) {
                          setWithdrawInvestedAmount(Number(selectedInvestmentAccount.current_balance).toString());
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">100% Full Settlement</span>
                        {isFullSettlement && (
                          <span className="rounded-full bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                            Full Portfolio Exit
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Toggle ON if you are fully closing this position. If withdrawn amount is less than invested, the balance liquidates down to ₹0.00 as a realized loss. If OFF, dynamic partial balance is retained.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Invested Principal to Withdraw</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        <input
                          className="input pl-8 font-semibold"
                          type="number"
                          step="0.01"
                          placeholder="e.g. 10000.00"
                          value={withdrawInvestedAmount}
                          onChange={(e) => setWithdrawInvestedAmount(e.target.value)}
                          required
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Principal portion being liquidated</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label !mb-0">Amount Withdrawn / Received</label>
                        {numInvested > 0 && (
                          <button
                            type="button"
                            onClick={() => setWithdrawReceivedAmount(numInvested.toString())}
                            className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                          >
                            At Cost
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        <input
                          className="input pl-8 font-semibold"
                          type="number"
                          step="0.01"
                          placeholder="e.g. 12500.00"
                          value={withdrawReceivedAmount}
                          onChange={(e) => setWithdrawReceivedAmount(e.target.value)}
                          required
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Final value received upon liquidation</p>
                    </div>
                  </div>

                  {/* Quick Return Presets */}
                  {numInvested > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium">Quick Return:</span>
                      {[
                        { label: '0% (Cost)', mult: 1 },
                        { label: '+10%', mult: 1.10 },
                        { label: '+20%', mult: 1.20 },
                        { label: '+30%', mult: 1.30 },
                        { label: '+50%', mult: 1.50 },
                        { label: '-10%', mult: 0.90 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const val = Math.round((numInvested * preset.mult) * 100) / 100;
                            setWithdrawReceivedAmount(val.toString());
                          }}
                          className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300 hover:text-purple-600 transition"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dynamic Portfolio Balance Impact Box */}
                  {selectedInvestmentAccount && Number(selectedInvestmentAccount.current_balance) > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Current {selectedInvestmentAccount.name} Balance:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(Number(selectedInvestmentAccount.current_balance))}
                        </span>
                      </div>
                      {numInvested > 0 && (
                        <>
                          <div className="flex items-center justify-between text-[11px] text-purple-600 dark:text-purple-400">
                            <span>
                              Partial Withdrawal ({((numInvested / Number(selectedInvestmentAccount.current_balance)) * 100).toFixed(1)}%):
                            </span>
                            <span className="font-semibold">-{formatCurrency(numInvested)}</span>
                          </div>
                          <div className="border-t border-slate-200 dark:border-slate-800 pt-1.5 flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-800 dark:text-slate-200">Remaining Portfolio Balance:</span>
                            <span
                              className={cn(
                                'tabular-nums',
                                Number(selectedInvestmentAccount.current_balance) - numInvested < 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              )}
                            >
                              {formatCurrency(Math.max(0, Number(selectedInvestmentAccount.current_balance) - numInvested))}
                            </span>
                          </div>
                          {numInvested > Number(selectedInvestmentAccount.current_balance) && (
                            <p className="text-[11px] text-rose-500 font-semibold pt-1">
                              ⚠️ Withdrawal amount ({formatCurrency(numInvested)}) exceeds account balance ({formatCurrency(Number(selectedInvestmentAccount.current_balance))}).
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Live Return & Performance Breakdown */}
                  {numInvested > 0 && numReceived > 0 && (
                    <div
                      className={cn(
                        'rounded-xl border p-3.5 text-xs space-y-2 transition',
                        returnDiff > 0
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
                          : returnDiff < 0
                          ? 'border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'
                          : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200'
                      )}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          {returnDiff > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-300">Investment Gain (Profit)</span>
                            </>
                          ) : returnDiff < 0 ? (
                            <>
                              <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                              <span className="text-rose-700 dark:text-rose-300">
                                {isFullSettlement ? '100% Full Settlement Loss' : 'Partial Realized Loss'}
                              </span>
                            </>
                          ) : (
                            <span>Break-even Return</span>
                          )}
                        </span>
                        <span className="text-sm font-black tabular-nums">
                          {returnDiff >= 0 ? '+' : ''}{formatCurrency(returnDiff)} ({returnDiff >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%)
                        </span>
                      </div>

                      <p className="text-[11px] leading-relaxed opacity-90">
                        <strong>Performance Summary:</strong> Liquidating <strong>{formatCurrency(numInvested)}</strong> of your investment, which realized <strong>{formatCurrency(numReceived)}</strong> ({returnDiff >= 0 ? 'profit' : 'loss'} of <strong>{returnDiff >= 0 ? '+' : ''}{formatCurrency(returnDiff)}</strong>).
                      </p>

                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 text-[11px] space-y-1">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Individual Bank & Ledger Entries:</div>
                        <p className="flex justify-between">
                          <span>• Principal Returned to {selectedSourceAccount?.name || 'Bank'}:</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(returnDiff >= 0 ? numInvested : Math.min(numReceived, numInvested))}</span>
                        </p>
                        {returnDiff > 0 && (
                          <p className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>• Profit Income to {selectedSourceAccount?.name || 'Bank'}:</span>
                            <span className="font-bold tabular-nums">+{formatCurrency(returnDiff)}</span>
                          </p>
                        )}
                        {returnDiff < 0 && (
                          <p className="flex justify-between text-rose-600 dark:text-rose-400">
                            <span>• Realized Loss Recognized:</span>
                            <span className="font-bold tabular-nums">-{formatCurrency(Math.abs(returnDiff))}</span>
                          </p>
                        )}
                        <p className="flex justify-between border-t border-current/10 pt-1 font-bold">
                          <span>• Total Credited to {selectedSourceAccount?.name || 'Bank'}:</span>
                          <span className="tabular-nums">{formatCurrency(numReceived)}</span>
                        </p>
                        <p className="flex justify-between text-slate-500 pt-0.5">
                          <span>• Remaining Portfolio Balance:</span>
                          <span className="font-semibold tabular-nums">
                            {isFullSettlement
                              ? '₹0.00 (100% Settled)'
                              : formatCurrency(Math.max(0, Number(selectedInvestmentAccount?.current_balance || 0) - numInvested))}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input
                    className="input"
                    type="date"
                    value={investDate}
                    onChange={(e) => setInvestDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input
                    className="input"
                    type="time"
                    value={investTime}
                    onChange={(e) => setInvestTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <input
                  className="input"
                  placeholder={
                    investAction === 'invest'
                      ? 'e.g. Monthly SIP, Bought 10 shares of Reliance'
                      : 'e.g. Redeemed Mutual Funds, Sold TCS shares'
                  }
                  value={investDesc}
                  onChange={(e) => setInvestDesc(e.target.value)}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="label">Tags</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="Add tag (e.g. sip, stocks, long-term)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                  </div>
                  <button type="button" onClick={addTag} className="btn-secondary">
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="badge bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        {t}
                        <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input min-h-[50px]"
                  placeholder="e.g. NAV: ₹142.50, Units: 50, Folio No: 12345..."
                  value={investNotes}
                  onChange={(e) => setInvestNotes(e.target.value)}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {isPending ? 'Processing...' : investAction === 'invest' ? 'Record Investment' : 'Record Withdrawal'}
                </button>
              </div>
            </form>
          ) : (
            /* ═════════════════════════════════════════════════════════════════════ */
            /* STANDARD INCOME / EXPENSE / ADJUSTMENT FORM                           */
            /* ═════════════════════════════════════════════════════════════════════ */
            <form onSubmit={handleSubmit(onSubmitStandard)} className="space-y-4">
              <div>
                <label className="label">Account</label>
                <select className="input" {...register('account_id')}>
                  <option value="">Select account...</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {errors.account_id && <p className="mt-1 text-xs text-error-600">{errors.account_id.message}</p>}
              </div>

              {standardType !== 'adjustment' && (
                <div>
                  <label className="label">Category</label>
                  <select className="input" {...register('category_id')}>
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input className="input pl-8" type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                </div>
                {errors.amount && <p className="mt-1 text-xs text-error-600">{errors.amount.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date" {...register('date')} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input className="input" type="time" {...register('time')} />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="e.g. Grocery shopping" {...register('description')} />
              </div>

              <div>
                <label className="label">Tags</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                  </div>
                  <button type="button" onClick={addTag} className="btn-secondary">Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {t}
                        <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea className="input min-h-[50px]" placeholder="Additional notes..." {...register('notes')} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={isPending} className="btn-primary flex-1">
                  {isPending ? 'Saving...' : transaction ? 'Save Changes' : 'Save Transaction'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
