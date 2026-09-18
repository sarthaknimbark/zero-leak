import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { api, isApiEnabled } from '@/lib/api';
import type { Debt } from '@/lib/types';

export function useDebts() {
  return useQuery({
    queryKey: ['debts'],
    queryFn: async () => {
      if (isApiEnabled()) {
        return api<Debt[]>('/api/debts');
      }
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
    retry: 1,
  });
}

export function useAddDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Debt, 'id' | 'user_id' | 'created_at'>) => {
      if (isApiEnabled()) {
        return api<Debt>('/api/debts', { method: 'POST', body: JSON.stringify(input) });
      }
      const { data, error } = await supabase.from('debts').insert(input).select().single();
      if (error) throw error;
      return data as Debt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useUpdateDebtStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'settled' }) => {
      if (isApiEnabled()) {
        return api<Debt>(`/api/debts/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
      const { data, error } = await supabase
        .from('debts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Debt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isApiEnabled()) {
        await api(`/api/debts/${id}`, { method: 'DELETE' });
        return;
      }
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
