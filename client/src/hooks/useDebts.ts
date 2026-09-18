import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/debts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
