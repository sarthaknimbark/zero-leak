import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Transfer } from '@/lib/types';

export function useTransfers() {
  return useQuery({
    queryKey: queryKeys.transfers,
    queryFn: () => api<Transfer[]>('/api/transfers'),
    retry: 1,
  });
}

interface TransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  fee: number;
  date: string;
  time: string;
  description: string;
  notes: string;
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferInput) =>
      api('/api/transfers', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transfers });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/transfers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transfers });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export interface UpdateTransferInput {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  fee: number;
  date: string;
  time: string;
  description: string;
  notes: string;
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTransferInput) => {
      const { id, ...body } = input;
      await api(`/api/transfers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transfers });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
