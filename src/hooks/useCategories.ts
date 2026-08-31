import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queries';
import type { Category, CategoryType } from '@/lib/types';

export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: queryKeys.categories(type),
    queryFn: async () => {
      let q = supabase.from('categories').select('*').order('name');
      if (type) q = q.eq('type', type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Category[];
    },
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
    mutationFn: async (input: CategoryInput) => {
      const { data, error } = await supabase.from('categories').insert(input).select().single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CategoryInput> & { id: string }) => {
      const { data, error } = await supabase.from('categories').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
