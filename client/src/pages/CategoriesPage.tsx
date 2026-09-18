import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tags, Plus, Trash2, Edit3, TrendingUp, TrendingDown } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { useToast } from '@/components/ui/Toast';
import type { CategoryType } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonGrid, QueryError as ErrorBox } from '@/components/ui';
import {
  Briefcase, Laptop, Gift, ShoppingCart, Home, Zap, Car, Utensils,
  Film, HeartPulse, ShoppingBag, BookOpen, Tag as TagIcon, TrendingUp as TrendIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const categoryColors = ['#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#22c55e'];
const categoryIconMap: Record<string, React.ReactNode> = {
  briefcase: <Briefcase className="h-4 w-4" />, laptop: <Laptop className="h-4 w-4" />,
  'trending-up': <TrendIcon className="h-4 w-4" />, gift: <Gift className="h-4 w-4" />,
  'shopping-cart': <ShoppingCart className="h-4 w-4" />, home: <Home className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />, car: <Car className="h-4 w-4" />,
  utensils: <Utensils className="h-4 w-4" />, film: <Film className="h-4 w-4" />,
  'heart-pulse': <HeartPulse className="h-4 w-4" />, 'shopping-bag': <ShoppingBag className="h-4 w-4" />,
  'book-open': <BookOpen className="h-4 w-4" />, tag: <TagIcon className="h-4 w-4" />,
};
const categoryIconNames = Object.keys(categoryIconMap);

function CategoryIcon({ icon }: { icon: string }) {
  return <>{categoryIconMap[icon] ?? <TagIcon className="h-4 w-4" />}</>;
}

export function CategoriesPage() {
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const { showToast } = useToast();

  const [tab, setTab] = useState<CategoryType>('expense');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCat, setEditCat] = useState<{ id: string; name: string; color: string; icon: string } | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(categoryColors[0]);
  const [icon, setIcon] = useState('tag');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = (categories ?? []).filter((c) => c.type === tab);

  const openNew = () => {
    setEditCat(null); setName(''); setColor(categoryColors[0]); setIcon('tag');
    setModalOpen(true);
  };

  const openEdit = (c: { id: string; name: string; color: string; icon: string }) => {
    setEditCat(c); setName(c.name); setColor(c.color); setIcon(c.icon);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editCat) {
        await updateCat.mutateAsync({ id: editCat.id, name, color, icon });
        showToast('Category updated', 'success');
      } else {
        await createCat.mutateAsync({ name, type: tab, color, icon });
        showToast('Category created', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message || 'Failed to save category', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCat.mutateAsync(deleteTarget.id);
      showToast('Category deleted', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to delete', 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Organize your income and expenses"
        icon={Tags}
        action={<button onClick={openNew} className="btn-primary"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Category</span></button>}
      />

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setTab('expense')}
          className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition', tab === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500')}
        >
          <TrendingDown className="h-4 w-4" /> Expense
        </button>
        <button
          onClick={() => setTab('income')}
          className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition', tab === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500')}
        >
          <TrendingUp className="h-4 w-4" /> Income
        </button>
      </div>

      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : isError ? (
        <ErrorBox onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Tags className="h-6 w-6" />} title={`No ${tab} categories`} description="Create custom categories to organize your transactions." action={<button onClick={openNew} className="btn-primary"><Plus className="h-4 w-4" /> New Category</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.2) }}
              className="card card-hover group flex items-center gap-3 p-3.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: c.color }}>
                <CategoryIcon icon={c.icon} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-400">{c.is_default ? 'Default' : 'Custom'}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => openEdit({ id: c.id, name: c.name, color: c.color, icon: c.icon })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Edit3 className="h-4 w-4" />
                </button>
                {!c.is_default && (
                  <button onClick={() => setDeleteTarget({ id: c.id, name: c.name })} className="rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editCat ? 'Edit Category' : 'New Category'} description={`Create a ${tab} category`} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Coffee" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex flex-wrap gap-2">
              {categoryColors.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={cn('h-8 w-8 rounded-lg transition', color === c ? 'ring-2 ring-offset-2 ring-slate-400' : '')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2">
              {categoryIconNames.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcon(ic)} className={cn('flex h-9 w-9 items-center justify-center rounded-lg border transition', icon === ic ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                  <CategoryIcon icon={ic} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createCat.isPending || updateCat.isPending} className="btn-primary flex-1">
              {(createCat.isPending || updateCat.isPending) ? 'Saving...' : editCat ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Category?" description={`"${deleteTarget?.name}" will be removed. Transactions will keep their data.`} size="sm">
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={deleteCat.isPending} className="btn-danger flex-1">
            {deleteCat.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
