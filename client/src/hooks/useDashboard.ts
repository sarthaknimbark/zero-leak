import { useQuery } from '@tanstack/react-query';
import { api, toQuery } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/context/AuthContext';
import type { Account, Transaction, Transfer, Category } from '@/lib/types';

interface DashboardData {
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  totalBalance: number;
  cashBalance: number;
  bankBalance: number;
  walletBalance: number;
  investmentBalance: number;
  monthIncome: number;
  monthExpense: number;
  savings: number;
  netWorth: number;
}

export function useDashboard() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api<DashboardData>('/api/dashboard'),
    enabled: !!session?.access_token,
  });
}

interface AnalyticsData {
  income: number;
  expense: number;
  savings: number;
  byCategory: { name: string; color: string; amount: number }[];
  byAccount: { name: string; color: string; amount: number }[];
  byDay: { date: string; income: number; expense: number }[];
  byMonth: { month: string; income: number; expense: number }[];
  transfers: { count: number; total: number };
  transactions: Transaction[];
  categories: Category[];
}

export function useAnalytics(range: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  return useQuery({
    queryKey: queryKeys.analytics(range),
    queryFn: async (): Promise<AnalyticsData> => {
      const now = new Date();
      let startDate: Date;
      let groupBy: 'day' | 'month';

      switch (range) {
        case 'daily':
          startDate = new Date(now); startDate.setDate(now.getDate() - 30); groupBy = 'day'; break;
        case 'weekly':
          startDate = new Date(now); startDate.setDate(now.getDate() - 84); groupBy = 'day'; break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1); groupBy = 'month'; break;
        case 'yearly':
          startDate = new Date(now.getFullYear() - 4, 0, 1); groupBy = 'month'; break;
      }

      const dateFrom = startDate.toISOString().split('T')[0];

      const [transactions, categories, transfers] = await Promise.all([
        api<Transaction[]>(`/api/transactions${toQuery({ date_from: dateFrom, sort: 'date_asc' })}`),
        api<Category[]>('/api/categories'),
        api<Transfer[]>('/api/transfers'),
      ]);

      const transferRows = transfers
        .filter((t) => t.date >= dateFrom)
        .map((t) => ({ amount: t.amount }));

      const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      const catMap = new Map<string, number>();
      transactions.filter((t) => t.type === 'expense' && t.category_id).forEach((t) => {
        const key = t.category_id!;
        catMap.set(key, (catMap.get(key) ?? 0) + Number(t.amount));
      });
      const byCategory = Array.from(catMap.entries()).map(([catId, amount]) => {
        const cat = transactions.find((t) => t.category_id === catId)?.category;
        return { name: cat?.name ?? 'Unknown', color: cat?.color ?? '#94a3b8', amount };
      }).sort((a, b) => b.amount - a.amount).slice(0, 10);

      const accMap = new Map<string, number>();
      transactions.forEach((t) => {
        const key = t.account_id;
        accMap.set(key, (accMap.get(key) ?? 0) + Number(t.amount));
      });
      const byAccount = Array.from(accMap.entries()).map(([accId, amount]) => {
        const acc = transactions.find((t) => t.account_id === accId)?.account;
        return { name: acc?.name ?? 'Unknown', color: acc?.color ?? '#94a3b8', amount };
      }).sort((a, b) => b.amount - a.amount);

      if (groupBy === 'day') {
        const dayMap = new Map<string, { income: number; expense: number }>();
        transactions.forEach((t) => {
          const day = t.date;
          if (!dayMap.has(day)) dayMap.set(day, { income: 0, expense: 0 });
          const entry = dayMap.get(day)!;
          if (t.type === 'income') entry.income += Number(t.amount);
          else if (t.type === 'expense') entry.expense += Number(t.amount);
        });
        const byDay = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
        return {
          income, expense, savings: income - expense, byCategory, byAccount, byDay, byMonth: [],
          transfers: { count: transferRows.length, total: transferRows.reduce((s, t) => s + Number(t.amount), 0) },
          transactions, categories,
        };
      }

      const monthMap = new Map<string, { income: number; expense: number }>();
      transactions.forEach((t) => {
        const month = t.date.slice(0, 7);
        if (!monthMap.has(month)) monthMap.set(month, { income: 0, expense: 0 });
        const entry = monthMap.get(month)!;
        if (t.type === 'income') entry.income += Number(t.amount);
        else if (t.type === 'expense') entry.expense += Number(t.amount);
      });
      const byMonth = Array.from(monthMap.entries()).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month));
      return {
        income, expense, savings: income - expense, byCategory, byAccount, byDay: [], byMonth,
        transfers: { count: transferRows.length, total: transferRows.reduce((s, t) => s + Number(t.amount), 0) },
        transactions, categories,
      };
    },
  });
}
