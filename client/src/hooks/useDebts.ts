import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Debt } from '@/lib/types';

export function useDebts() {
  return useQuery({
    queryKey: ['debts'],
    queryFn: () => api<Debt[]>('/api/debts'),
    retry: 1,
  });
}

export function useAddDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Debt, 'id' | 'user_id' | 'created_at'>) =>
      api<Debt>('/api/debts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useUpdateDebtStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'settled' }) =>
      api<Debt>(`/api/debts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export interface SettleDebtInput {
  account_id: string;
  amount: number;
  debt_id?: string;
  friend_name?: string;
  notes?: string;
}

export function useSettleDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ account_id, amount, debt_id, friend_name, notes }: SettleDebtInput) => {
      if (debt_id) {
        return api(`/api/debts/${debt_id}/settle`, {
          method: 'POST',
          body: JSON.stringify({ account_id, amount, notes }),
        });
      }
      return api('/api/debts/settle-person', {
        method: 'POST',
        body: JSON.stringify({ friend_name, account_id, amount, notes }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.transactions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/debts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
