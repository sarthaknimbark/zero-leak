import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { api, isApiEnabled } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Transfer } from '@/lib/types';

export function useTransfers() {
  return useQuery({
    queryKey: queryKeys.transfers,
    queryFn: async () => {
      if (isApiEnabled()) {
        return api<Transfer[]>('/api/transfers');
      }
      const { data, error } = await supabase
        .from('transfers')
        .select('*, from_account:accounts!from_account_id(id,name,type,color,icon), to_account:accounts!to_account_id(id,name,type,color,icon)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Transfer[];
    },
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
    mutationFn: async (input: TransferInput) => {
      if (isApiEnabled()) {
        return api('/api/transfers', { method: 'POST', body: JSON.stringify(input) });
      }
      const { data, error } = await supabase.rpc('apply_transfer', {
        p_from_account_id: input.from_account_id,
        p_to_account_id: input.to_account_id,
        p_amount: input.amount,
        p_fee: input.fee,
        p_date: input.date,
        p_time: input.time,
        p_description: input.description,
        p_notes: input.notes,
      });
      if (error) throw error;
      return data;
    },
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
    mutationFn: async (id: string) => {
      if (isApiEnabled()) {
        await api(`/api/transfers/${id}`, { method: 'DELETE' });
        return;
      }
      const { error } = await supabase.rpc('delete_transfer', { p_transfer_id: id });
      if (error) throw error;
    },
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
      if (isApiEnabled()) {
        const { id, ...body } = input;
        await api(`/api/transfers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        return;
      }
      const { error } = await supabase.rpc('update_transfer', {
        p_transfer_id: input.id,
        p_from_account_id: input.from_account_id,
        p_to_account_id: input.to_account_id,
        p_amount: input.amount,
        p_fee: input.fee,
        p_date: input.date,
        p_time: input.time,
        p_description: input.description,
        p_notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transfers });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
