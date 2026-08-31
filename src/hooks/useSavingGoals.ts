import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SavingGoal } from '@/lib/types';

export const savingGoalKeys = {
  all: ['saving_goals'] as const,
};

export function useSavingGoals() {
  return useQuery({
    queryKey: savingGoalKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saving_goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavingGoal[];
    },
    retry: 1,
  });
}

export function useCreateSavingGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Omit<SavingGoal, 'id' | 'user_id' | 'current_amount' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('saving_goals')
        .insert([goal])
        .select()
        .single();
      if (error) throw error;
      return data as SavingGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
    },
  });
}

export function useDeleteSavingGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saving_goals')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
    },
  });
}

export function useDepositToGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, accountId, amount }: { goalId: string; accountId: string; amount: number }) => {
      const { error } = await supabase.rpc('deposit_to_saving_goal', {
        p_goal_id: goalId,
        p_account_id: accountId,
        p_amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useWithdrawFromGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, accountId, amount }: { goalId: string; accountId: string; amount: number }) => {
      const { error } = await supabase.rpc('withdraw_from_saving_goal', {
        p_goal_id: goalId,
        p_account_id: accountId,
        p_amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
