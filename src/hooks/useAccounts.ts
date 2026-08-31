import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queries';
import type { Account } from '@/lib/types';

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    retry: 1,
  });
}

export function useActiveAccounts() {
  const { data, ...rest } = useAccounts();
  return { data: data?.filter((a) => a.status === 'active'), ...rest };
}

interface AccountInput {
  name: string;
  type: Account['type'];
  institution?: string;
  opening_balance: number;
  current_balance?: number;
  color: string;
  icon: string;
  notes?: string;
  status?: Account['status'];
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AccountInput) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({ ...input, current_balance: input.opening_balance })
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AccountInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
