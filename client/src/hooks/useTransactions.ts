import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toQuery } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Transaction } from '@/lib/types';

export interface TransactionFilters {
  type?: string;
  account_id?: string;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
  sort?: string;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.transactionsFiltered(filters as Record<string, unknown>),
    queryFn: () =>
      api<Transaction[]>(
        `/api/transactions${toQuery(filters as Record<string, string | number | boolean | null | undefined>)}`
      ),
    retry: 1,
  });
}

interface TransactionInput {
  account_id: string;
  category_id: string | null;
  type: 'income' | 'expense' | 'adjustment';
  amount: number;
  date: string;
  time: string;
  description: string;
  tags: string[];
  notes: string;
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionInput) =>
      api('/api/transactions', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export interface UpdateTransactionInput {
  id: string;
  account_id: string;
  category_id: string | null;
  type: 'income' | 'expense' | 'adjustment';
  amount: number;
  date: string;
  time: string;
  description: string;
  tags: string[];
  notes: string;
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTransactionInput) => {
      const { id, ...body } = input;
      await api(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
