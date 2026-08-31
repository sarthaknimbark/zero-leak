import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*, account:accounts(id,name,type,color,icon), category:categories(id,name,color,icon)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.type) q = q.eq('type', filters.type);
      if (filters.account_id) q = q.eq('account_id', filters.account_id);
      if (filters.category_id) q = q.eq('category_id', filters.category_id);
      if (filters.date_from) q = q.gte('date', filters.date_from);
      if (filters.date_to) q = q.lte('date', filters.date_to);
      if (filters.min_amount != null) q = q.gte('amount', filters.min_amount);
      if (filters.max_amount != null) q = q.lte('amount', filters.max_amount);
      if (filters.search) q = q.or(`description.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);

      if (filters.sort === 'amount_desc') q = q.order('amount', { ascending: false });
      else if (filters.sort === 'amount_asc') q = q.order('amount', { ascending: true });
      else if (filters.sort === 'date_asc') {
        q = q.order('date', { ascending: true }).order('created_at', { ascending: true });
      }

      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
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
    mutationFn: async (input: TransactionInput) => {
      const { data, error } = await supabase.rpc('apply_transaction', {
        p_account_id: input.account_id,
        p_category_id: input.category_id,
        p_type: input.type,
        p_amount: input.amount,
        p_date: input.date,
        p_time: input.time,
        p_description: input.description,
        p_tags: input.tags,
        p_notes: input.notes,
        p_attachment_url: null,
      });
      if (error) throw error;
      return data;
    },
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_transaction', { p_transaction_id: id });
      if (error) throw error;
    },
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
      const { error } = await supabase.rpc('update_transaction', {
        p_transaction_id: input.id,
        p_account_id: input.account_id,
        p_category_id: input.category_id,
        p_type: input.type,
        p_amount: input.amount,
        p_date: input.date,
        p_time: input.time,
        p_description: input.description,
        p_tags: input.tags,
        p_notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
