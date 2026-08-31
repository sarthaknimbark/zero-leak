import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, ArrowLeftRight, X } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { useAccounts } from '@/hooks/useAccounts';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonList, QueryError as ErrorBox } from '@/components/ui';
import { cn } from '@/lib/cn';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');
  const { data: accounts } = useAccounts();
  const { data: transactions, isLoading: txLoading, isError: txError } = useTransactions({
    search: query || undefined,
    type: type || undefined,
    account_id: accountId || undefined,
  });
  const { data: transfers, isLoading: tfLoading } = useTransfers();

  const matchingTransfers = useMemo(() => {
    return (transfers ?? []).filter((t) => {
      if (query) {
        const q = query.toLowerCase();
        if (!(t.description?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))) return false;
      }
      if (accountId && t.from_account_id !== accountId && t.to_account_id !== accountId) return false;
      return true;
    });
  }, [transfers, query, accountId]);

  const txCount = (transactions ?? []).length;
  const tfCount = matchingTransfers.length;
  const totalResults = txCount + tfCount;
  const loading = txLoading || tfLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Search" subtitle="Find any transaction or transfer" icon={Search} />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          className="input pl-12 text-base"
          placeholder="Search by description, notes, tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input max-w-[160px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <select className="input max-w-[180px]" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {totalResults > 0 && (
          <span className="flex items-center text-sm text-slate-500">{totalResults} results</span>
        )}
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : txError ? (
        <ErrorBox />
      ) : totalResults === 0 && (query || type || accountId) ? (
        <EmptyState icon={<Search className="h-6 w-6" />} title="No results" description="Try a different search term or filter." />
      ) : totalResults === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" />} title="Start searching" description="Search across all your transactions and transfers." />
      ) : (
        <div className="space-y-5">
          {txCount > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-500">Transactions ({txCount})</p>
              <div className="card divide-y divide-slate-100">
                {(transactions ?? []).slice(0, 50).map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5 transition hover:bg-slate-50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: tx.type === 'income' ? '#10b981' : tx.type === 'expense' ? '#ef4444' : '#6366f1' }}>
                      {tx.type === 'income' ? <TrendingUp className="h-4 w-4" /> : tx.type === 'expense' ? <TrendingDown className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{tx.description || tx.category?.name || tx.type}</p>
                      <p className="text-xs text-slate-400">{tx.account?.name} · {formatDate(tx.date)} · {formatTime(tx.time)}</p>
                    </div>
                    <span className={cn('text-sm font-bold tabular-nums', tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-indigo-600')}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '±'}{formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tfCount > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-500">Transfers ({tfCount})</p>
              <div className="card divide-y divide-slate-100">
                {matchingTransfers.slice(0, 30).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3.5 transition hover:bg-slate-50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700 text-white">
                      <ArrowLeftRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{t.from_account?.name} → {t.to_account?.name}</p>
                      <p className="text-xs text-slate-400">{formatDate(t.date)} · {formatTime(t.time)}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(Number(t.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
