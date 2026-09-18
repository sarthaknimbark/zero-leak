import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert, TrendingUp, AlertTriangle, ArrowRight, Lightbulb, Wallet, CheckCircle, HelpCircle,
} from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { formatCurrency, formatPercent } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSpinner, EmptyState } from '@/components/ui';

interface LeakData {
  categoryId: string;
  name: string;
  color: string;
  prevAmount: number;
  currAmount: number;
  percentageChange: number;
  isLeak: boolean;
  isNew: boolean;
}

export function LeaksPage() {
  // Fetch all transactions to perform MoM calculations locally
  const { data: transactions, isLoading, isError } = useTransactions({ sort: 'date_desc' });

  const leakAnalysis = useMemo(() => {
    if (!transactions) return { leaks: [], safe: [], totalLeakAmount: 0 };

    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth(); // 0-indexed

    // Calculate previous month index
    const prevYear = currMonth === 0 ? currYear - 1 : currYear;
    const prevMonth = currMonth === 0 ? 11 : currMonth - 1;

    // Group expenses by category
    const categoryDetails = new Map<string, { name: string; color: string }>();
    const currMonthExpenses = new Map<string, number>();
    const prevMonthExpenses = new Map<string, number>();

    const expenseTxs = transactions.filter(t => t.type === 'expense');

    expenseTxs.forEach((tx) => {
      if (!tx.category_id) return;
      
      const txDate = new Date(tx.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      const catId = tx.category_id;
      if (!categoryDetails.has(catId)) {
        categoryDetails.set(catId, {
          name: tx.category?.name || 'Other',
          color: tx.category?.color || '#94a3b8',
        });
      }

      if (txYear === currYear && txMonth === currMonth) {
        currMonthExpenses.set(catId, (currMonthExpenses.get(catId) || 0) + Number(tx.amount));
      } else if (txYear === prevYear && txMonth === prevMonth) {
        prevMonthExpenses.set(catId, (prevMonthExpenses.get(catId) || 0) + Number(tx.amount));
      }
    });

    const analysis: LeakData[] = [];
    let totalLeakAmount = 0;

    categoryDetails.forEach((details, catId) => {
      const currAmount = currMonthExpenses.get(catId) || 0;
      const prevAmount = prevMonthExpenses.get(catId) || 0;

      // Skip categories with no current spending
      if (currAmount === 0) return;

      let percentageChange = 0;
      let isLeak = false;
      let isNew = false;

      if (prevAmount > 0) {
        percentageChange = ((currAmount - prevAmount) / prevAmount) * 100;
        // Flag as leak if spending rose by more than 15%
        isLeak = percentageChange > 15;
      } else {
        // No spending last month, but spending this month -> Flag as new leak/spending pattern
        isNew = true;
        isLeak = true;
        percentageChange = 100;
      }

      if (isLeak) {
        totalLeakAmount += (currAmount - prevAmount > 0 ? currAmount - prevAmount : currAmount);
      }

      analysis.push({
        categoryId: catId,
        name: details.name,
        color: details.color,
        prevAmount,
        currAmount,
        percentageChange,
        isLeak,
        isNew,
      });
    });

    const leaks = analysis.filter(a => a.isLeak).sort((a, b) => b.percentageChange - a.percentageChange);
    const safe = analysis.filter(a => !a.isLeak).sort((a, b) => a.percentageChange - b.percentageChange);

    return { leaks, safe, totalLeakAmount };
  }, [transactions]);

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError || !transactions) {
    return (
      <div className="card p-10 text-center text-slate-500">
        <AlertTriangle className="mx-auto h-10 w-10 text-error-500 mb-2" />
        <p className="font-bold text-slate-800 dark:text-slate-200">Failed to analyze transactions</p>
      </div>
    );
  }

  const { leaks, safe, totalLeakAmount } = leakAnalysis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Leak Detector"
        subtitle="Auto-flags unusual, excessive, or spiking expenses compared to the previous month"
        icon={ShieldAlert}
      />

      {/* Leaks Banner Status */}
      {leaks.length > 0 ? (
        <div className="rounded-3xl border border-error-200 bg-error-50/40 dark:border-error-950/20 dark:bg-error-950/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-error-600 text-white shadow-lg shadow-error-600/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Leaks Detected</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                We flagged <span className="font-bold text-error-650">{leaks.length} category spikes</span> this month, amounting to a spike of <span className="font-bold text-error-650">{formatCurrency(totalLeakAmount)}</span>.
              </p>
            </div>
          </div>
          <div className="text-xs border-l-0 sm:border-l border-slate-200 dark:border-slate-850 pl-0 sm:pl-4 space-y-1 text-slate-500">
            <div className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Compare: Current Month vs Prev Month</div>
            <div className="flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5 text-indigo-500" /> Leak threshold: &gt;15% increase</div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-success-200 bg-success-50/40 dark:border-success-950/20 dark:bg-success-950/10 p-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Zero Leaks Detected!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Awesome! Your spending across all categories is consistent or lower than the previous month.</p>
          </div>
        </div>
      )}

      {/* Flagged Leaks Section */}
      {leaks.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-500 px-1">Spiking Expenses ({leaks.length})</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {leaks.map((leak) => (
              <motion.div
                key={leak.categoryId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card border-l-4 border-l-error-500 p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: leak.color }} />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{leak.name}</h3>
                  </div>
                  <span className="badge bg-error-50 text-error-600 dark:bg-error-950/20 dark:text-error-400 font-bold">
                    {leak.isNew ? 'New Spender' : `${formatPercent(leak.percentageChange)} spike`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 dark:border-slate-800/80 py-3">
                  <div>
                    <span className="text-slate-450 block">Prev Month Total</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(leak.prevAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-450 block">Current Month Total</span>
                    <span className="font-bold text-slate-900 dark:text-slate-105">{formatCurrency(leak.currAmount)}</span>
                  </div>
                </div>

                {/* Smart Action Recommendation */}
                <div className="flex gap-2.5 items-start bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400">
                  <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-semibold text-slate-750 dark:text-slate-300">Action Recommendation:</p>
                    <p className="mt-0.5">
                      {leak.isNew 
                        ? `This is your first time spending on ${leak.name} recently. Review transaction details to ensure correctness.`
                        : `Set a category budget for ${leak.name} at ${formatCurrency(Math.round(leak.prevAmount * 1.1))} (10% over last month) to plug this leak.`}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Consistent Categories */}
      {safe.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-500 px-1">Consistent Categories ({safe.length})</p>
          <div className="card divide-y divide-slate-150/40 dark:divide-slate-800">
            {safe.map((item) => (
              <div key={item.categoryId} className="flex items-center justify-between gap-4 p-4 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-6 shrink-0 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Prev Month</span>
                    <span className="font-medium text-slate-600 dark:text-slate-400">{formatCurrency(item.prevAmount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Current Month</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.currAmount)}</span>
                  </div>
                  <span className="badge bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold min-w-16 text-center">
                    {item.percentageChange <= 0 ? 'Decreasing' : `${formatPercent(item.percentageChange)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
