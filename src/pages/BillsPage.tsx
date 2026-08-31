import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, Clock, Calendar, Check,
} from 'lucide-react';
import { useBills, useCreateBill, useUpdateBill, useDeleteBill, useMarkBillAsPaid } from '@/hooks/useBills';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList, QueryError as ErrorBox } from '@/components/ui';
import type { Bill } from '@/lib/types';

export function BillsPage() {
  const { data: bills, isLoading, isError, refetch } = useBills();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const markAsPaid = useMarkBillAsPaid();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Pay bill states
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [payAccount, setPayAccount] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [categoryId, setCategoryId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('monthly');
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setEditBill(null);
    setName('');
    setAmount('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setDueTime('12:00');
    setCategoryId('');
    setIsRecurring(false);
    setRecurrenceInterval('monthly');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (bill: Bill) => {
    setEditBill(bill);
    setName(bill.name);
    setAmount(String(bill.amount));
    setDueDate(bill.due_date);
    setDueTime(bill.due_time || '12:00');
    setCategoryId(bill.category_id || '');
    setIsRecurring(bill.is_recurring);
    setRecurrenceInterval(bill.recurrence_interval || 'monthly');
    setNotes(bill.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !dueDate || !dueTime) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    const payload = {
      name,
      amount: Number(amount),
      due_date: dueDate,
      due_time: dueTime,
      category_id: categoryId || null,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? (recurrenceInterval as 'weekly' | 'monthly' | 'yearly') : null,
      notes: notes || null,
      status: (editBill ? editBill.status : 'unpaid') as 'paid' | 'unpaid' | 'overdue',
    };

    try {
      if (editBill) {
        await updateBill.mutateAsync({ id: editBill.id, ...payload });
        showToast('Bill updated', 'success');
      } else {
        await createBill.mutateAsync(payload);
        showToast('Bill added', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message || 'Failed to save bill', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBill.mutateAsync(deleteId);
      showToast('Bill deleted', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to delete bill', 'error');
    }
    setDeleteId(null);
  };

  const handlePayBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBill || !payAccount) return;

    try {
      await markAsPaid.mutateAsync({
        billId: payBill.id,
        accountId: payAccount,
        categoryId: payBill.category_id,
        amount: payBill.amount,
        name: payBill.name,
        date: new Date().toISOString().split('T')[0],
      });
      showToast('Bill marked as paid and transaction logged', 'success');
      setPayBill(null);
      setPayAccount('');
    } catch (err) {
      showToast((err as Error).message || 'Failed to pay bill', 'error');
    }
  };

  // Process list logic and categorize unpaid vs overdue
  const nowStr = new Date().toISOString().split('T')[0];
  const processedBills = (bills ?? []).map(b => {
    if (b.status === 'unpaid' && b.due_date < nowStr) {
      return { ...b, status: 'overdue' as const };
    }
    return b;
  });

  const unpaid = processedBills.filter(b => b.status === 'unpaid' || b.status === 'overdue');
  const paid = processedBills.filter(b => b.status === 'paid');
  const overdueCount = unpaid.filter(b => b.status === 'overdue').length;

  const filtered = activeTab === 'unpaid' ? unpaid : activeTab === 'paid' ? paid : processedBills;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills & Reminders"
        subtitle="Track upcoming bills, due dates, and record payments automatically"
        icon={CalendarDays}
        action={
          <button onClick={openAddModal} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Bill
          </button>
        }
      />

      {/* Summary notifications banner */}
      {unpaid.length > 0 && (
        <div className={`flex items-center gap-3.5 rounded-2xl border p-4 shadow-sm ${
          overdueCount > 0 
            ? 'border-error-200 bg-error-50/50 dark:border-error-950/20 dark:bg-error-950/10 text-error-800 dark:text-error-450' 
            : 'border-warning-200 bg-warning-50/50 dark:border-warning-950/20 dark:bg-warning-950/10 text-warning-800 dark:text-warning-450'
        }`}>
          {overdueCount > 0 ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-error-600 dark:text-error-500" />
          ) : (
            <Clock className="h-5 w-5 shrink-0 text-warning-600 dark:text-warning-500" />
          )}
          <div className="flex-1 text-sm font-medium">
            {overdueCount > 0 ? (
              <p>Warning: You have <span className="font-bold">{overdueCount} overdue bill{overdueCount > 1 ? 's' : ''}</span>. Pay now to avoid fees!</p>
            ) : (
              <p>You have <span className="font-bold">{unpaid.length} upcoming bill{unpaid.length > 1 ? 's' : ''}</span> due soon.</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {(['unpaid', 'paid', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition -mb-px ${
              activeTab === tab
                ? 'border-indigo-650 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {tab === 'unpaid' && unpaid.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-650 dark:text-slate-400">
                {unpaid.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No bills found"
          description={
            activeTab === 'unpaid' 
              ? "Hooray! You don't have any pending bills to pay right now." 
              : "No recorded bills found in this tab."
          }
          action={
            activeTab === 'unpaid' ? (
              <button onClick={openAddModal} className="btn-primary">
                <Plus className="h-4 w-4" /> Add Bill
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bill) => (
            <motion.div
              key={bill.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card overflow-hidden flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{bill.name}</h3>
                    {bill.category && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bill.category.color }} />
                        {bill.category.name}
                      </span>
                    )}
                  </div>
                  <span className={`badge shrink-0 px-2 py-0.5 text-xs font-semibold capitalize ${
                    bill.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : bill.status === 'overdue'
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                  }`}>
                    {bill.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(bill.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Due Date</span>
                    <span className={`font-semibold flex items-center gap-1 ${
                      bill.status === 'overdue' ? 'text-rose-600' : 'text-slate-700 dark:text-slate-350'
                    }`}>
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(bill.due_date)}
                    </span>
                  </div>
                  {bill.is_recurring && (
                    <div className="flex items-center justify-between text-xs text-slate-450 dark:text-slate-500">
                      <span>Recurrence</span>
                      <span className="capitalize">{bill.recurrence_interval}</span>
                    </div>
                  )}
                </div>

                {bill.notes && (
                  <p className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-2.5 line-clamp-2">
                    {bill.notes}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 px-5 py-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(bill)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-650 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Edit bill"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(bill.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-error-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Delete bill"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {bill.status !== 'paid' && (
                  <button
                    onClick={() => {
                      setPayBill(bill);
                      setPayAccount(accounts?.[0]?.id || '');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark Paid
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bill Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editBill ? 'Edit Bill Reminder' : 'Add Bill Reminder'}
        description="Fill in the billing details. Unpaid bills will show alert reminders before their due date."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Bill Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Broadband internet, Rent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Amount *</label>
              <input
                type="number"
                step="0.01"
                className="input text-xs"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                type="date"
                className="input text-xs"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Due Time *</label>
              <input
                type="time"
                className="input text-xs"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No Category</option>
                {(categories ?? []).filter(c => c.type === 'expense').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-350 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 dark:border-slate-800 text-indigo-650 focus:ring-indigo-100"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Is Recurring Bill?
              </label>
            </div>
          </div>

          {isRecurring && (
            <div>
              <label className="label">Recurrence Interval</label>
              <select
                className="input"
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          <div>
            <label className="label">Notes / Instructions</label>
            <textarea
              className="input h-20 resize-none"
              placeholder="e.g. Account number, billing reference..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editBill ? 'Save Changes' : 'Create Reminder'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Bill Confirmation Modal (Records Transaction & updates status) */}
      <Modal
        open={!!payBill}
        onClose={() => setPayBill(null)}
        title="Record Bill Payment"
        description="Select the account you are paying this bill from. An expense transaction will be recorded automatically."
      >
        {payBill && (
          <form onSubmit={handlePayBillSubmit} className="space-y-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200/40 dark:border-slate-800/40 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Bill name</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{payBill.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount due</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(payBill.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Due date</span>
                <span className="font-semibold text-slate-700 dark:text-slate-350">{formatDate(payBill.due_date)}</span>
              </div>
            </div>

            <div>
              <label className="label">Pay From Account *</label>
              <select
                className="input"
                value={payAccount}
                onChange={(e) => setPayAccount(e.target.value)}
                required
              >
                <option value="" disabled>Select an account</option>
                {(accounts ?? []).filter(a => a.status === 'active').map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.current_balance)})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" className="btn-secondary" onClick={() => setPayBill(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!payAccount}>
                Record Payment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Bill Reminder"
        description="Are you sure you want to delete this bill reminder? Upcoming notification alerts for this bill will be cancelled."
      >
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete Reminder</button>
        </div>
      </Modal>
    </div>
  );
}
