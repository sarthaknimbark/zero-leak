import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useActiveAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import { readExpenseChips, writeExpenseChips, type ExpenseChip } from '@/lib/expenseChips';

const emptyForm = {
  name: '',
  amount: '',
  accountId: '',
  categoryId: '',
  askAmount: false,
};

export function DailyExpenseChips() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: accounts } = useActiveAccounts();
  const { data: categories } = useCategories('expense');
  const createTx = useCreateTransaction();
  const { showToast } = useToast();

  const [chips, setChips] = useState<ExpenseChip[]>([]);

  useEffect(() => {
    if (!userId) return;
    setChips(readExpenseChips(userId));
  }, [userId]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [amountChip, setAmountChip] = useState<ExpenseChip | null>(null);
  const [promptAmount, setPromptAmount] = useState('');

  if (!userId) return null;

  const persist = (next: ExpenseChip[]) => {
    if (!userId) return;
    setChips(next);
    writeExpenseChips(userId, next);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      accountId: accounts?.[0]?.id ?? '',
    });
    setEditorOpen(true);
  };

  const openEdit = (chip: ExpenseChip) => {
    setEditingId(chip.id);
    setForm({
      name: chip.name,
      amount: String(chip.amount),
      accountId: chip.accountId,
      categoryId: chip.categoryId ?? '',
      askAmount: chip.askAmount,
    });
    setEditorOpen(true);
  };

  const saveChip = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const amount = Number(form.amount);
    if (!name || !form.accountId || (!form.askAmount && !(amount > 0))) {
      showToast('Add a name, account, and amount', 'error');
      return;
    }
    const chip: ExpenseChip = {
      id: editingId ?? crypto.randomUUID(),
      name,
      amount,
      accountId: form.accountId,
      categoryId: form.categoryId || null,
      askAmount: form.askAmount,
    };
    const next = editingId
      ? chips.map((item) => (item.id === editingId ? chip : item))
      : [...chips, chip];
    persist(next);
    setEditorOpen(false);
    showToast(editingId ? 'Chip updated' : 'Chip added', 'success');
  };

  const removeChip = (id: string) => {
    persist(chips.filter((chip) => chip.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
  };

  const logChip = async (chip: ExpenseChip, amount = chip.amount) => {
    if (!(amount > 0)) {
      showToast('Enter an amount', 'error');
      return;
    }
    setBusyId(chip.id);
    try {
      const now = new Date();
      await createTx.mutateAsync({
        account_id: chip.accountId,
        category_id: chip.categoryId,
        type: 'expense',
        amount,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().slice(0, 5),
        description: chip.name,
        tags: [],
        notes: '',
      });
      showToast(`${chip.name} logged`, 'success');
      setAmountChip(null);
      setPromptAmount('');
    } catch (err) {
      showToast((err as Error).message || 'Failed to log', 'error');
    }
    setBusyId(null);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Daily</p>
          <p className="text-[11px] text-slate-400">Tap a chip to log it</p>
        </div>
        <button type="button" onClick={openNew} className="btn-secondary px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add chip
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={busyId === chip.id}
            onClick={() => {
              if (chip.askAmount) {
                setAmountChip(chip);
                setPromptAmount('');
                return;
              }
              void logChip(chip);
            }}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 transition active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <span className="block max-w-[12rem] truncate">
              {chip.name}
              <span className="font-medium text-slate-500 dark:text-slate-400">
                {' '}
                · {chip.askAmount ? 'amount' : formatCurrency(chip.amount)}
              </span>
            </span>
          </button>
        ))}
        {chips.length === 0 && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-full border border-dashed border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-500 dark:border-slate-600"
          >
            Add a daily expense
          </button>
        )}
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit chip' : 'Add chip'}
        description="Set a daily expense so you can log it from the dashboard."
      >
        <form onSubmit={saveChip} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="Tea, Metro, Lunch"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Amount</label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required={!form.askAmount}
            />
          </div>
          <div>
            <label className="label">Account</label>
            <select
              className="input"
              value={form.accountId}
              onChange={(event) => setForm({ ...form, accountId: event.target.value })}
              required
            >
              <option value="">Select account</option>
              {(accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              <option value="">No category</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.askAmount}
              onChange={(event) => setForm({ ...form, askAmount: event.target.checked })}
            />
            Ask for the amount each time
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={() => setEditorOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1">{editingId ? 'Save chip' : 'Add chip'}</button>
          </div>
        </form>

        {chips.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Your chips</p>
            <div className="space-y-2">
              {chips.map((chip) => (
                <div key={chip.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{chip.name}</p>
                    <p className="text-xs text-slate-400">
                      {chip.askAmount ? 'Ask each time' : formatCurrency(chip.amount)}
                    </p>
                  </div>
                  <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => openEdit(chip)} aria-label={`Edit ${chip.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" onClick={() => removeChip(chip.id)} aria-label={`Remove ${chip.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!amountChip}
        onClose={() => setAmountChip(null)}
        title={amountChip ? amountChip.name : 'Amount'}
        description="Enter today's amount."
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (amountChip) void logChip(amountChip, Number(promptAmount));
          }}
        >
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={promptAmount}
            onChange={(event) => setPromptAmount(event.target.value)}
            autoFocus
            required
          />
          <button type="submit" className="btn-primary w-full" disabled={!!busyId}>
            {busyId ? 'Saving...' : 'Log expense'}
          </button>
        </form>
      </Modal>
    </section>
  );
}
