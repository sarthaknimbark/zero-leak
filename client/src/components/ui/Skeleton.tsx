import { motion } from 'framer-motion';

export function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
      style={style}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card overflow-hidden p-5">
      <div className="flex items-center gap-3">
        <Pulse className="h-11 w-11 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-24 rounded bg-slate-200" />
          <Pulse className="h-3 w-16 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 h-7 w-32 rounded bg-slate-200" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="card divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
          <Pulse className="h-10 w-10 rounded-xl bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-4 w-32 rounded bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <Pulse className="h-3 w-16 rounded bg-slate-100" />
              <span className="text-[8px] text-slate-300">·</span>
              <Pulse className="h-3 w-12 rounded bg-slate-100" />
            </div>
          </div>
          <Pulse className="h-5 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonHero() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-3xl bg-slate-200 p-6"
    >
      <Pulse className="h-4 w-24 rounded bg-slate-300/60" />
      <Pulse className="mt-3 h-10 w-48 rounded bg-slate-300/60" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Pulse className="h-3 w-12 rounded bg-slate-300/40" />
            <Pulse className="mt-2 h-6 w-20 rounded bg-slate-300/60" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div className="card p-5">
      <Pulse className="mb-4 h-5 w-32 rounded bg-slate-200" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Pulse
            key={i}
            className="flex-1 rounded-t bg-slate-200"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.3s]" />
        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400" />
      </div>
    </div>
  );
}
