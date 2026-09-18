import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toQuery } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Category, CategoryType } from '@/lib/types';

export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: queryKeys.categories(type),
    queryFn: () => api<Category[]>(`/api/categories${toQuery({ type })}`),
    retry: 1,
  });
}

interface CategoryInput {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      api<Category>('/api/categories', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CategoryInput> & { id: string }) =>
      api<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
