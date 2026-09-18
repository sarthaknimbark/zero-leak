import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Bill } from '@/lib/types';

export const billKeys = {
  all: ['bills'] as const,
};

export function useBills() {
  return useQuery({
    queryKey: billKeys.all,
    queryFn: async () => {
      await api('/api/bills/sync-overdue', { method: 'POST' });
      return api<Bill[]>('/api/bills');
    },
    retry: 1,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bill: Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
      api<Bill>('/api/bills', { method: 'POST', body: JSON.stringify(bill) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...bill }: Partial<Bill> & { id: string }) =>
      api<Bill>(`/api/bills/${id}`, { method: 'PATCH', body: JSON.stringify(bill) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/bills/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkBillAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      billId,
      accountId,
      categoryId,
      amount,
      name,
      date,
    }: {
      billId: string;
      accountId: string;
      categoryId: string | null;
      amount: number;
      name: string;
      date: string;
    }) =>
      api<Bill>(`/api/bills/${billId}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountId,
          category_id: categoryId,
          amount,
          name,
          date,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
