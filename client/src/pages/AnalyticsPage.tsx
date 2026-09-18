import { useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, TrendingUp, TrendingDown, Wallet, ArrowLeftRight, PieChart as PieIcon } from 'lucide-react';
import {
  BarChart, Bar, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAnalytics } from '@/hooks/useDashboard';
import { formatCurrency, formatCompact, formatMonthYear } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonChart, QueryError as ErrorBox, PageSpinner } from '@/components/ui';
import { cn } from '@/lib/cn';

type Range = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function AnalyticsPage() {
  const [range, setRange] = useState<Range>('monthly');
  const { data, isLoading, isError, refetch } = useAnalytics(range);

  const ranges: { value: Range; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Financial insights and trends" icon={LineChart} />

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={cn(
              'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition',
              range === r.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/50'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SkeletonChart height={80} /><SkeletonChart height={80} /><SkeletonChart height={80} />
          </div>
          <SkeletonChart />
        </div>
      ) : isError || !data ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total Income" value={data.income} icon={<TrendingUp className="h-5 w-5" />} color="emerald" />
            <SummaryCard label="Total Expense" value={data.expense} icon={<TrendingDown className="h-5 w-5" />} color="rose" />
            <SummaryCard label="Net Savings" value={data.savings} icon={<Wallet className="h-5 w-5" />} color={data.savings >= 0 ? 'indigo' : 'rose'} />
          </div>

          <div className="card p-5">
            <h2 className="mb-4 section-title">Income vs Expense</h2>
            <ResponsiveContainer width="100%" height={280}>
              {data.byDay.length > 0 ? (
                <RLineChart data={data.byDay.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(data.byDay.length / 10))} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={50} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={false} name="Income" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} name="Expense" />
                </RLineChart>
              ) : (
                <RLineChart data={data.byMonth.map((d) => ({ ...d, label: formatMonthYear(d.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={50} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Income" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Expense" />
                </RLineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 flex items-center gap-2 section-title"><PieIcon className="h-4 w-4 text-slate-400" /> Top Categories</h2>
              {data.byCategory.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-slate-300">
                  <PieIcon className="h-10 w-10" />
                  <p className="mt-2 text-sm text-slate-400">No expense data</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <RPieChart>
                      <Pie data={data.byCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                        {data.byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                    </RPieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {data.byCategory.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 flex items-center gap-2 section-title"><Wallet className="h-4 w-4 text-slate-400" /> Account Activity</h2>
              {data.byAccount.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-slate-300">
                  <Wallet className="h-10 w-10" />
                  <p className="mt-2 text-sm text-slate-400">No transaction data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.byAccount} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                      {data.byAccount.map((a, i) => <Cell key={i} fill={a.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 section-title"><ArrowLeftRight className="h-4 w-4 text-slate-400" /> Transfer Summary</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatBox label="Total Transfers" value={String(data.transfers.count)} />
              <StatBox label="Total Transferred" value={formatCurrency(data.transfers.total)} />
              <StatBox label="Avg Transfer" value={data.transfers.count > 0 ? formatCurrency(data.transfers.total / data.transfers.count) : formatCurrency(0)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const accentColors = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
};

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: 'emerald' | 'rose' | 'indigo' }) {
  const c = accentColors[color];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', c.bg, c.text)}>{icon}</div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-bold tabular-nums text-slate-900">{formatCurrency(value)}</p>
        </div>
      </div>
    </motion.div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
