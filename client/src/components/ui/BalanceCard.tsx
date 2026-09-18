import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface BalanceCardProps {
  label: string;
  amount: number;
  currency?: string;
  icon: React.ReactNode;
  accent?: 'indigo' | 'success' | 'error' | 'warning' | 'slate';
  trend?: number;
}

const accentMap = {
  indigo: 'from-indigo-500 to-indigo-600 text-white',
  success: 'from-emerald-500 to-emerald-600 text-white',
  error: 'from-rose-500 to-rose-600 text-white',
  warning: 'from-amber-500 to-amber-600 text-white',
  slate: 'from-slate-700 to-slate-800 text-white',
};

export function BalanceCard({ label, amount, currency = 'USD', icon, accent = 'slate', trend }: BalanceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-card', accentMap[accent])}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -right-10 top-8 h-20 w-20 rounded-full bg-white/5" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            {icon}
          </div>
          <span className="text-sm font-medium opacity-90">{label}</span>
        </div>
        {typeof trend === 'number' && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', trend >= 0 ? 'bg-white/20' : 'bg-white/15')}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="relative mt-4 text-2xl font-bold tabular-nums">
        {new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)}
      </p>
    </motion.div>
  );
}
