import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAuth } from '@/context/AuthContext';
import type { Account } from '@/lib/types';

export function useAccounts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api<Account[]>('/api/accounts'),
    enabled: !!session?.access_token,
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
    mutationFn: (input: AccountInput) =>
      api<Account>('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ ...input, current_balance: input.opening_balance }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AccountInput> & { id: string }) =>
      api<Account>(`/api/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
