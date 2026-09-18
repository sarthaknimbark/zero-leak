import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tag, X } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useActiveAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/components/ui/Toast';
import type { Transaction, TransactionType } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
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

export function TransactionFormModal({ open, onClose, transaction }: { open: boolean; onClose: () => void; transaction?: Transaction | null }) {
  const { data: accounts } = useActiveAccounts();
  const { data: allCategories } = useCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const { showToast } = useToast();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

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

  const type = watch('type');

  useEffect(() => {
    if (open) {
      if (transaction) {
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
        reset({
          type: 'expense',
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
    }
  }, [open, transaction, reset]);

  const categories = (allCategories ?? []).filter((c) =>
    type === 'adjustment' ? false : c.type === type
  );

  const onSubmit = async (data: FormData) => {
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

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const types: { value: TransactionType; label: string; color: string }[] = [
    { value: 'income', label: 'Income', color: 'success' },
    { value: 'expense', label: 'Expense', color: 'error' },
    { value: 'adjustment', label: 'Adjustment', color: 'indigo' },
  ];

  const isPending = createTx.isPending || updateTx.isPending;

  return (
    <Modal open={open} onClose={onClose} title={transaction ? "Edit Transaction" : "New Transaction"} description={transaction ? "Update transaction details." : "Record income, expense, or balance adjustment."}>
      {accounts && accounts.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">You need an account first to add transactions.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue('type', t.value)}
                className={cn(
                  'rounded-xl border py-2.5 text-sm font-semibold transition',
                  type === t.value
                    ? t.color === 'success' ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : t.color === 'error' ? 'border-rose-400 bg-rose-50 text-rose-700'
                    : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

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

          {type !== 'adjustment' && (
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
                  <span key={t} className="badge bg-indigo-50 text-indigo-700">
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
    </Modal>
  );
}
