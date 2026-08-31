import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Bill } from '@/lib/types';

export const billKeys = {
  all: ['bills'] as const,
};

export function useBills() {
  return useQuery({
    queryKey: billKeys.all,
    queryFn: async () => {
      // Automatically sync overdue bills in real-time
      await supabase.rpc('update_overdue_bills');

      const { data, error } = await supabase
        .from('bills')
        .select('*, category:categories(id,name,color,icon)')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Bill[];
    },
    retry: 1,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bill: Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('bills')
        .insert([bill])
        .select()
        .single();
      if (error) throw error;
      return data as Bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...bill }: Partial<Bill> & { id: string }) => {
      const { data, error } = await supabase
        .from('bills')
        .update(bill)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkBillAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, accountId, categoryId, amount, name, date }: { billId: string; accountId: string; categoryId: string | null; amount: number; name: string; date: string }) => {
      // 1. Create a transaction
      const { error: txError } = await supabase.rpc('apply_transaction', {
        p_account_id: accountId,
        p_category_id: categoryId,
        p_type: 'expense',
        p_amount: amount,
        p_date: date,
        p_time: new Date().toTimeString().split(' ')[0],
        p_description: `Paid: ${name}`,
        p_tags: ['bill-payment'],
        p_notes: 'Paid via Bills & Reminders panel',
        p_attachment_url: null,
      });
      if (txError) throw txError;

      // 2. Update bill status
      const { data, error: billError } = await supabase
        .from('bills')
        .update({ status: 'paid' })
        .eq('id', billId)
        .select()
        .single();
      if (billError) throw billError;

      return data as Bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
