import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Users, Wallet, TrendingUp, ArrowLeftRight, Search,
  Trash2, Ban, CheckCircle, BarChart3, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatCompact, formatDate, initials } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryError as ErrorBox } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Profile } from '@/lib/types';

export function AdminPage() {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: stats, isError: statsError } = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) throw error;
      return data as {
        total_users: number; total_accounts: number; total_transactions: number;
        total_transfers: number; total_income: number; total_expense: number; active_users_30d: number;
      };
    },
    retry: 1,
  });

  const { data: users } = useQuery({
    queryKey: queryKeys.adminUsers(search),
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (search) {
        q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    retry: 1,
  });

  const { data: userGrowth } = useQuery({
    queryKey: ['admin', 'user-growth'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const months = new Map<string, number>();
      (data ?? []).forEach((u) => {
        const m = u.created_at.slice(0, 7);
        months.set(m, (months.get(m) ?? 0) + 1);
      });
      let cumulative = 0;
      return Array.from(months.entries()).map(([month, count]) => {
        cumulative += count;
        return { month, new: count, total: cumulative };
      });
    },
    retry: 1,
  });

  const { data: txActivity } = useQuery({
    queryKey: ['admin', 'tx-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('date, type, amount')
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: true });
      if (error) throw error;
      const days = new Map<string, { income: number; expense: number }>();
      (data ?? []).forEach((t) => {
        const d = t.date as string;
        if (!days.has(d)) days.set(d, { income: 0, expense: 0 });
        const entry = days.get(d)!;
        if (t.type === 'income') entry.income += Number(t.amount);
        else if (t.type === 'expense') entry.expense += Number(t.amount);
      });
      return Array.from(days.entries()).map(([date, v]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        ...v,
      }));
    },
    retry: 1,
  });

  const toggleDisable = useMutation({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      const { error } = await supabase.from('profiles').update({ disabled: !disabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      showToast('User status updated', 'success');
    },
    onError: (err) => showToast((err as Error).message || 'Failed to update user', 'error'),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      showToast('User deleted', 'success');
    },
    onError: (err) => showToast((err as Error).message || 'Failed to delete user', 'error'),
  });

  const handleDelete = (user: Profile) => {
    if (confirm(`Delete user "${user.email}"? This will cascade-delete all their data.`)) {
      deleteUser.mutate(user.id);
    }
  };

  if (statsError) {
    return <ErrorBox message="Could not load admin statistics. Make sure you have admin access." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel" subtitle="Application-wide analytics and user management" icon={Shield} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats?.total_users ?? 0} icon={<Users className="h-5 w-5" />} color="indigo" />
        <StatCard label="Active (30d)" value={stats?.active_users_30d ?? 0} icon={<Activity className="h-5 w-5" />} color="emerald" />
        <StatCard label="Accounts" value={stats?.total_accounts ?? 0} icon={<Wallet className="h-5 w-5" />} color="amber" />
        <StatCard label="Transactions" value={stats?.total_transactions ?? 0} icon={<TrendingUp className="h-5 w-5" />} color="rose" />
        <StatCard label="Transfers" value={stats?.total_transfers ?? 0} icon={<ArrowLeftRight className="h-5 w-5" />} color="cyan" />
        <StatCard label="Total Income" value={formatCurrency(stats?.total_income ?? 0)} icon={<TrendingUp className="h-5 w-5" />} color="emerald" />
        <StatCard label="Total Expense" value={formatCurrency(stats?.total_expense ?? 0)} icon={<TrendingUp className="h-5 w-5" />} color="rose" />
        <StatCard label="Net Flow" value={formatCurrency((stats?.total_income ?? 0) - (stats?.total_expense ?? 0))} icon={<BarChart3 className="h-5 w-5" />} color="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 section-title">User Growth</h2>
          {(userGrowth ?? []).length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-slate-300">
              <BarChart3 className="h-10 w-10" />
              <p className="mt-2 text-sm text-slate-400">No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={userGrowth?.map((d) => ({ ...d, label: new Date(d.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) }))}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} fill="url(#userGrad)" name="Total Users" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 section-title">Transaction Activity (30d)</h2>
          {(txActivity ?? []).length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-slate-300">
              <BarChart3 className="h-10 w-10" />
              <p className="mt-2 text-sm text-slate-400">No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={txActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={5} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={50} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">User Management</h2>
          <span className="text-sm text-slate-400">{(users ?? []).length} users</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Joined</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(users ?? []).map((user) => (
                <tr key={user.id} className="group">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {initials(user.full_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{formatDate(user.created_at)}</td>
                  <td className="py-3 pr-4">
                    {user.disabled ? (
                      <span className="badge bg-error-50 text-error-600"><Ban className="h-3 w-3" /> Disabled</span>
                    ) : (
                      <span className="badge bg-success-50 text-success-600"><CheckCircle className="h-3 w-3" /> Active</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {user.is_admin ? <span className="badge bg-indigo-50 text-indigo-700">Admin</span> : <span className="text-slate-400">User</span>}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleDisable.mutate({ id: user.id, disabled: user.disabled })}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                        title={user.disabled ? 'Enable' : 'Disable'}
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-error-50 hover:text-error-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(users ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No users found</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
      <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-xl', colors[color])}>{icon}</div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </motion.div>
  );
}
