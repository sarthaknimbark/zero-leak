import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, Landmark, PiggyBank, TrendingUp, TrendingDown,
  ArrowLeftRight, ArrowRight, Plus, Banknote, LineChart, PieChart,
  ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import { useAccounts } from '@/hooks/useAccounts';
import { formatCurrency, formatCompact, formatDate } from '@/lib/format';
import { AccountIcon } from '@/components/accounts/AccountIcon';
import { PageSpinner } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

export function DashboardPage() {
  const { data: dash, isLoading, isError, refetch } = useDashboard();
  const { data: accounts } = useAccounts();

  const cashFlowData = useMemo(() => {
    if (!dash) return [];
    const now = new Date();
    const days: { date: string; income: number; expense: number; label: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTx = dash.transactions.filter((t) => t.date === dateStr);
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        income: dayTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        expense: dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return days;
  }, [dash]);

  const categoryData = useMemo(() => {
    if (!dash) return [];
    const map = new Map<string, number>();
    dash.transactions.filter((t) => t.type === 'expense' && t.category_id).forEach((t) => {
      map.set(t.category_id!, (map.get(t.category_id!) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).map(([id, amount]) => {
      const cat = dash.transactions.find((t) => t.category_id === id)?.category;
      return { name: cat?.name ?? 'Other', value: amount, color: cat?.color ?? '#94a3b8' };
    }).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [dash]);

  const recentTx = dash?.transactions.slice(0, 6) ?? [];
  const recentTransfers = dash?.transfers.slice(0, 4) ?? [];

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError || !dash) {
    return <QueryError onRetry={() => refetch()} />;
  }

  const empty = dash.accounts.length === 0;
  const savingsRate = dash.monthIncome > 0 ? (dash.savings / dash.monthIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {empty ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Wallet className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Welcome to Zero Leak</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Create your first account to start tracking every movement of your money.</p>
          <Link to="/accounts?action=new" className="btn-primary mt-6">
            <Plus className="h-4 w-4" /> Add Your First Account
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Balance hero - frosted credit card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl border border-white/10"
          >
            {/* Glossy overlay sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-xl" />
            <div className="absolute -right-24 top-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-xl" />
            
            {/* Credit card chip graphic - positioned on the right side */}
            <div className="absolute right-6 top-14 h-7 w-10 rounded-lg bg-gradient-to-br from-amber-300/80 to-amber-500/50 opacity-40 shadow-sm border border-amber-300/30" />
            
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Total Balance</p>
                <span className="badge bg-white/10 text-white/90 backdrop-blur-md px-3 py-1 font-semibold text-[10px] uppercase tracking-wider mr-12">All Accounts</span>
              </div>
              <p className="mt-2.5 text-3xl sm:text-4xl font-embossed tracking-widest text-slate-100 tabular-nums">
                {formatCurrency(dash.totalBalance)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-white/5 pt-3">
                <BalanceStat label="Cash" value={dash.cashBalance} icon={<Banknote className="h-4 w-4" />} />
                <BalanceStat label="Banks" value={dash.bankBalance} icon={<Landmark className="h-4 w-4" />} />
                <BalanceStat label="Wallets" value={dash.walletBalance} icon={<Wallet className="h-4 w-4" />} />
                <BalanceStat label="Investments" value={dash.investmentBalance} icon={<TrendingUp className="h-4 w-4" />} />
              </div>
            </div>
          </motion.div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
            <QuickActionCard to="/transactions?action=new" label="Add Income" sublabel="Money received" icon={<ArrowDownCircle className="h-6 w-6" />} color="emerald" />
            <QuickActionCard to="/transactions?action=new" label="Add Expense" sublabel="Money spent" icon={<ArrowUpCircle className="h-6 w-6" />} color="rose" />
            <QuickActionCard to="/transfers?action=new" label="Transfer" sublabel="Move money" icon={<ArrowLeftRight className="h-6 w-6" />} color="indigo" />
          </div>

          {/* Income / Expense / Savings */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Income (This Month)" value={dash.monthIncome} icon={<TrendingUp className="h-5 w-5" />} accent="success" />
            <SummaryCard label="Expense (This Month)" value={dash.monthExpense} icon={<TrendingDown className="h-5 w-5" />} accent="error" />
            <SummaryCard
              label="Savings (This Month)"
              value={dash.savings}
              icon={<PiggyBank className="h-5 w-5" />}
              accent={dash.savings >= 0 ? 'indigo' : 'error'}
              subtitle={dash.monthIncome > 0 ? `${savingsRate.toFixed(0)}% of income` : undefined}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="section-title">Cash Flow</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last 30 days</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Income</span>
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Expense</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cashFlowData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800/40" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={5} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--card-border)', backgroundColor: 'var(--card)', color: 'var(--text-primary)', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incGrad)" />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 section-title">Spending by Category</h2>
              {categoryData.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-slate-350">
                  <PieChart className="h-10 w-10" />
                  <p className="mt-2 text-sm text-slate-400">No expenses yet</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <RPieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--card-border)', backgroundColor: 'var(--card)', color: 'var(--text-primary)', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                    </RPieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {categoryData.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-655 dark:text-slate-400">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent transactions + Accounts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="section-title">Recent Transactions</h2>
                <Link to="/transactions" className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {recentTx.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <TrendingUp className="mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">No transactions yet</p>
                  <Link to="/transactions?action=new" className="btn-secondary mt-3 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add one
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentTx.map((tx) => (
                    <Link
                      key={tx.id}
                      to="/transactions"
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: tx.account?.color || '#6366f1' }}
                      >
                        <AccountIcon icon={tx.account?.icon || 'wallet'} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{tx.description || tx.category?.name || tx.type}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(tx.date)} · {tx.account?.name}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '±'}{formatCurrency(Number(tx.amount))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="section-title">Accounts</h2>
                <Link to="/accounts" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">View all</Link>
              </div>
              <div className="space-y-2">
                {(accounts ?? []).slice(0, 5).map((acc) => (
                  <Link key={acc.id} to="/accounts" className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: acc.color }}>
                      <AccountIcon icon={acc.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{acc.name}</p>
                      <p className="text-xs capitalize text-slate-400 dark:text-slate-500">{acc.type}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(Number(acc.current_balance))}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Recent transfers */}
          {recentTransfers.length > 0 && (
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="section-title">Recent Transfers</h2>
                <Link to="/transfers" className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={recentTransfers.slice(0, 7).map((t) => ({ name: formatDate(t.date, { day: 'numeric' }), amount: Number(t.amount) }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800/40" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={50} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--card-border)', backgroundColor: 'var(--card)', color: 'var(--text-primary)', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="amount" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BalanceStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
        {icon}
        {label}
      </div>
      <p className="text-lg sm:text-[19px] font-embossed tracking-wide text-slate-100 tabular-nums">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

const accentColors = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/25', text: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-600 dark:text-emerald-400' },
  error: { bg: 'bg-rose-50 dark:bg-rose-950/25', text: 'text-rose-600 dark:text-rose-400', value: 'text-rose-600 dark:text-rose-400' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/25', text: 'text-indigo-600 dark:text-indigo-400', value: 'text-indigo-600 dark:text-indigo-400' },
};

function SummaryCard({ label, value, icon, accent, subtitle }: { label: string; value: number; icon: React.ReactNode; accent: 'success' | 'error' | 'indigo'; subtitle?: string }) {
  const c = accentColors[accent];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>{icon}</div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-xl font-bold tabular-nums ${c.value}`}>
            {formatCurrency(value)}
          </p>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

const quickActionColors = {
  emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/30',
  rose: 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/30',
  indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-950/30',
};

function QuickActionCard({ to, label, sublabel, icon, color }: { to: string; label: string; sublabel: string; icon: React.ReactNode; color: 'emerald' | 'rose' | 'indigo' }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-4 text-center transition-all active:scale-[0.97] ${quickActionColors[color]}`}
    >
      {icon}
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{label}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">{sublabel}</span>
    </Link>
  );
}
