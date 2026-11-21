import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { InvestmentInput, InvestmentSummaryData } from '@/lib/types';

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvestmentInput) =>
      api('/api/investments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: queryKeys.transfers });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: () => api<InvestmentSummaryData>('/api/investments'),
    retry: 1,
  });
}
