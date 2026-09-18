import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SavingGoal } from '@/lib/types';

export const savingGoalKeys = {
  all: ['saving_goals'] as const,
};

export function useSavingGoals() {
  return useQuery({
    queryKey: savingGoalKeys.all,
    queryFn: () => api<SavingGoal[]>('/api/saving-goals'),
    retry: 1,
  });
}

export function useCreateSavingGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      goal: Omit<SavingGoal, 'id' | 'user_id' | 'current_amount' | 'created_at' | 'updated_at'>
    ) => api<SavingGoal>('/api/saving-goals', { method: 'POST', body: JSON.stringify(goal) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
    },
  });
}

export function useDeleteSavingGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/saving-goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
    },
  });
}

export function useDepositToGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      goalId,
      accountId,
      amount,
    }: {
      goalId: string;
      accountId: string;
      amount: number;
    }) =>
      api(`/api/saving-goals/${goalId}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId, amount }),
      }),
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
    mutationFn: ({
      goalId,
      accountId,
      amount,
    }: {
      goalId: string;
      accountId: string;
      amount: number;
    }) =>
      api(`/api/saving-goals/${goalId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId, amount }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingGoalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
