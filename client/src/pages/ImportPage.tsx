import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, CheckCircle2, XCircle, ChevronRight,
  Trash2, ArrowUpCircle, ArrowDownCircle, Loader2,
  CloudUpload, FileSpreadsheet, FileScan, RotateCcw,
  AlertCircle, Info, Settings2, RefreshCw,
} from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, API_URL } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedRow {
  date: string;
  time?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  raw: string;
}

interface CSVMeta {
  headers: string[];
  sample: Record<string, string>[];
  detected: {
    dateCol?: string;
    descCol?: string;
    debitCol?: string;
    creditCol?: string;
    drcrCol?: string;
    amtCol?: string;
    amountMode: 'separate' | 'drcr' | 'signed' | 'unknown';
  };
}

interface ColumnMapping {
  dateCol: string;
  descCol: string;
  amountMode: 'separate' | 'drcr' | 'signed';
  debitCol?: string;
  creditCol?: string;
  amtCol?: string;
  drcrCol?: string;
}

interface ReviewRow extends ParsedRow {
  id: string;
  category_id: string;
  skip: boolean;
  status?: 'pending' | 'success' | 'error';
  errorMsg?: string;
}

type Step = 'upload' | 'map' | 'review' | 'done';

// ─── helpers ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2); }
function pluralise(n: number, word: string) { return `${n} ${word}${n !== 1 ? 's' : ''}`; }

async function getBearerToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

// ─── Stepper ────────────────────────────────────────────────────────────────
function Stepper({ step, hasMap }: { step: Step; hasMap: boolean }) {
  const steps: { key: Step; label: string }[] = hasMap
    ? [{ key: 'upload', label: 'Upload' }, { key: 'map', label: 'Map Columns' }, { key: 'review', label: 'Review' }, { key: 'done', label: 'Done' }]
    : [{ key: 'upload', label: 'Upload' }, { key: 'review', label: 'Review' }, { key: 'done', label: 'Done' }];

  const idx = steps.findIndex((s) => s.key === step);

  return (
    <div className="relative flex items-start justify-between max-w-xl mx-auto py-1">
      {/* Centered track line connecting through circle centers (top-4 = 16px = center of h-8) */}
      <div className="absolute top-4 left-6 right-6 -translate-y-1/2 h-0.5 bg-slate-200 dark:bg-slate-700 z-0">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0}%` }}
        />
      </div>

      {steps.map((s, i) => {
        const active = idx === i;
        const done = idx > i;
        return (
          <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ring-4 ring-white dark:ring-slate-900',
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-indigo-600 text-white ring-indigo-50 dark:ring-indigo-950/60'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-[10px] font-bold tracking-wider uppercase transition-colors hidden sm:block',
                active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : done
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400',
              )}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ─── Upload Step ─────────────────────────────────────────────────────────────
function UploadStep({
  accountId, setAccountId,
  onAutoSuccess, onNeedsMapping,
}: {
  accountId: string;
  setAccountId: (id: string) => void;
  onAutoSuccess: (rows: ParsedRow[]) => void;
  onNeedsMapping: (meta: CSVMeta, file: File) => void;
}) {
  const { data: accounts } = useAccounts();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (!accountId) { setError('Please select an account first.'); return; }
    setError(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = await getBearerToken();
      const res = await fetch(`${API_URL}/api/statement/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json() as {
        rows?: ParsedRow[]; count?: number; fileType?: string;
        needsMapping?: boolean; mapping?: CSVMeta; error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');

      if (json.needsMapping) {
        showToast('Could not auto-detect columns — please map them manually', 'info' as never);
        onNeedsMapping(json.mapping!, file);
      } else {
        showToast(`Extracted ${json.count} transactions`, 'success');
        onAutoSuccess(json.rows!);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accountId, onAutoSuccess, onNeedsMapping, showToast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const activeAccounts = (accounts ?? []).filter((a) => a.status === 'active');

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <label className="label mb-2 block">
          <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-indigo-500" /> Target Account</span>
        </label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— Select account to import into —</option>
          {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <p className="mt-2 text-xs text-slate-400">All imported transactions will be added to this account.</p>
      </div>

      <div
        className={cn(
          'card relative flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed transition-all cursor-pointer',
          dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 scale-[1.01]' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400',
          loading && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />

        <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl',
          dragging ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800')}>
          {loading ? <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            : <CloudUpload className={cn('h-8 w-8', dragging ? 'text-indigo-600' : 'text-slate-400')} />}
        </div>

        <div className="text-center">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {loading ? 'Parsing statement…' : fileName ?? 'Drop your bank statement here'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {loading ? 'Detecting columns automatically…' : 'or click to browse · CSV and PDF supported'}
          </p>
        </div>

        {!loading && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
              <FileScan className="h-3.5 w-3.5" /> PDF
            </span>
          </div>
        )}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 p-4 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </motion.div>
      )}

      <div className="card p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">How it works</p>
        <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          <li className="flex items-start gap-2"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-[9px] font-bold">1</span>Upload your bank CSV or PDF statement</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-[9px] font-bold">2</span>Columns are auto-detected. If not, you'll map them manually — <strong>always works</strong></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-[9px] font-bold">3</span>Review each transaction, assign categories, then import</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Column Mapping Step ──────────────────────────────────────────────────────
function MapColumnsStep({
  meta, file, onMapped,
}: {
  meta: CSVMeta;
  file: File;
  onMapped: (rows: ParsedRow[]) => void;
}) {
  const { headers, sample, detected } = meta;
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateCol: detected.dateCol ?? '',
    descCol: detected.descCol ?? '',
    amountMode: detected.amountMode === 'unknown' ? 'separate' : detected.amountMode as 'separate' | 'drcr' | 'signed',
    debitCol:  detected.debitCol  ?? '',
    creditCol: detected.creditCol ?? '',
    amtCol:    detected.amtCol    ?? '',
    drcrCol:   detected.drcrCol   ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ColumnMapping, v: string) => setMapping((p) => ({ ...p, [k]: v }));

  const isValid = () => {
    if (!mapping.dateCol || !mapping.descCol) return false;
    if (mapping.amountMode === 'separate') return !!(mapping.debitCol || mapping.creditCol);
    if (mapping.amountMode === 'drcr') return !!(mapping.amtCol && mapping.drcrCol);
    return !!mapping.amtCol;
  };

  const handleApply = async () => {
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      const token = await getBearerToken();
      const res = await fetch(`${API_URL}/api/statement/parse-with-mapping`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json() as { rows?: ParsedRow[]; count?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Parse failed');
      onMapped(json.rows!);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const colSelect = (label: string, key: keyof ColumnMapping, optional = false) => (
    <div>
      <label className="label mb-1.5 block">{label}{optional && <span className="ml-1 text-slate-400">(optional)</span>}</label>
      <select className="input" value={(mapping[key] as string) ?? ''} onChange={(e) => set(key, e.target.value)}>
        <option value="">— Select column —</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4">
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm text-amber-700 dark:text-amber-400">
          <p className="font-semibold">Columns couldn't be auto-detected</p>
          <p className="mt-0.5 text-xs opacity-80">Tell us which column contains what. Your file has {headers.length} columns.</p>
        </div>
      </div>

      {/* Sample preview */}
      {sample.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Preview (first {sample.length} rows)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/40">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[150px] truncate">{row[h] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mapping form */}
      <div className="card p-5 space-y-4">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Map Columns</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {colSelect('Date Column', 'dateCol')}
          {colSelect('Description / Narration Column', 'descCol')}
        </div>

        {/* Amount Mode */}
        <div>
          <label className="label mb-2 block">How is the amount structured in this file?</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['separate', 'drcr', 'signed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => set('amountMode', mode)}
                className={cn(
                  'rounded-xl border p-3 text-left transition',
                  mapping.amountMode === mode
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300',
                )}
              >
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {mode === 'separate' ? 'Separate Debit/Credit' : mode === 'drcr' ? 'Amount + Dr/Cr Column' : 'Single Signed Amount'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {mode === 'separate' ? 'Two columns: one for debit, one for credit'
                    : mode === 'drcr' ? 'One amount column + a Dr/Cr type column'
                    : 'One amount: negative=expense, positive=income'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Conditional selectors based on mode */}
        {mapping.amountMode === 'separate' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {colSelect('Debit Column (money out)', 'debitCol', true)}
            {colSelect('Credit Column (money in)', 'creditCol', true)}
          </div>
        )}
        {mapping.amountMode === 'drcr' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {colSelect('Amount Column', 'amtCol')}
            {colSelect('Dr/Cr Indicator Column', 'drcrCol')}
          </div>
        )}
        {mapping.amountMode === 'signed' && (
          <div>
            {colSelect('Amount Column', 'amtCol')}
          </div>
        )}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 p-4 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </motion.div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => void handleApply()}
          disabled={loading || !isValid()}
          className="btn-primary gap-2 px-6"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : <><RefreshCw className="h-4 w-4" /> Parse with this mapping</>}
        </button>
      </div>
    </div>
  );
}

// ─── Review Step ─────────────────────────────────────────────────────────────
function ReviewStep({
  rows, setRows, onImport, importing,
}: {
  rows: ReviewRow[];
  setRows: React.Dispatch<React.SetStateAction<ReviewRow[]>>;
  onImport: () => void;
  importing: boolean;
}) {
  const { data: categories } = useCategories();
  const incomeCategories = (categories ?? []).filter((c) => c.type === 'income');
  const expenseCategories = (categories ?? []).filter((c) => c.type === 'expense');

  const active = rows.filter((r) => !r.skip);
  const totalExpense = active.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const totalIncome  = active.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);

  const update = (id: string, patch: Partial<ReviewRow>) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  const toggleSkip = (id: string) => setRows((prev) => prev.map((r) => r.id === id ? { ...r, skip: !r.skip } : r));
  const toggleType = (id: string) => setRows((prev) => prev.map((r) => r.id === id ? { ...r, type: r.type === 'income' ? 'expense' : 'income', category_id: '' } : r));

  // Bulk actions
  const setAllType = (t: 'income' | 'expense') =>
    setRows((prev) => prev.map((r) => r.status ? r : { ...r, type: t, category_id: '' }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To Import</p>
          <p className="mt-1 text-lg font-black text-indigo-600 dark:text-indigo-400">{active.length}</p>
          <p className="text-[10px] text-slate-400">transactions</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expenses</p>
          <p className="mt-1 text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Income</p>
          <p className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(totalIncome)}</p>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bulk set all as:</span>
        <button onClick={() => setAllType('expense')}
          className="flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition">
          <ArrowDownCircle className="h-3 w-3" /> All Expense
        </button>
        <button onClick={() => setAllType('income')}
          className="flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition">
          <ArrowUpCircle className="h-3 w-3" /> All Income
        </button>
        <span className="text-xs text-slate-400 ml-auto">Click 🟢/🔴 icon per row to flip individually</span>
      </div>

      {/* Rows */}
      <div className="card divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
        {rows.map((row) => {
          const cats = row.type === 'income' ? incomeCategories : expenseCategories;
          return (
            <motion.div key={row.id} layout initial={{ opacity: 0 }} animate={{ opacity: row.skip ? 0.35 : 1 }}
              className={cn('flex flex-col sm:flex-row sm:items-center gap-2 p-3 transition',
                row.status === 'success' && 'bg-emerald-50 dark:bg-emerald-950/10',
                row.status === 'error'   && 'bg-rose-50 dark:bg-rose-950/10')}>

              {/* Type toggle — VERY visible */}
              <button
                onClick={() => !row.status && toggleType(row.id)}
                disabled={!!row.status}
                title="Click to flip: expense ↔ income"
                className={cn(
                  'shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition border',
                  row.type === 'income'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                    : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400',
                  !row.status && 'hover:scale-105 cursor-pointer',
                )}
              >
                {row.type === 'income' ? <ArrowUpCircle className="h-3.5 w-3.5" /> : <ArrowDownCircle className="h-3.5 w-3.5" />}
                {row.type === 'income' ? 'Credit' : 'Debit'}
              </button>

              {/* Description + date & time (editable) */}
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  type="text"
                  className="input w-full text-xs sm:text-sm font-semibold py-1.5 px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-500 rounded-lg transition"
                  value={row.description}
                  placeholder="Transaction description / name"
                  disabled={row.skip || !!row.status}
                  onChange={(e) => update(row.id, { description: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2 px-0.5 text-[11px] text-slate-400">
                  <span>{row.date}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Time:</span>
                    <input
                      type="time"
                      step="1"
                      className="text-[11px] font-mono px-1.5 py-0.5 h-5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                      value={row.time ? (row.time.length === 5 ? `${row.time}:00` : row.time) : ''}
                      disabled={row.skip || !!row.status}
                      onChange={(e) => update(row.id, { time: e.target.value })}
                    />
                  </div>
                </div>
                {row.errorMsg && <p className="text-[11px] text-rose-500">{row.errorMsg}</p>}
              </div>

              {/* Amount */}
              <span className={cn('shrink-0 text-sm font-bold tabular-nums',
                row.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
              </span>

              {/* Category */}
              <select className="input w-full sm:w-40 text-xs" value={row.category_id}
                disabled={row.skip || !!row.status}
                onChange={(e) => update(row.id, { category_id: e.target.value })}>
                <option value="">— Category —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {/* Status / Skip */}
              {row.status === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                : row.status === 'error'   ? <XCircle className="h-5 w-5 shrink-0 text-rose-500" />
                : row.status === 'pending' ? <Loader2 className="h-4 w-4 shrink-0 text-slate-400 animate-spin" />
                : (
                  <button onClick={() => toggleSkip(row.id)} title={row.skip ? 'Undo skip' : 'Skip this row'}
                    className={cn('shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition',
                      row.skip ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                        : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30')}>
                    {row.skip ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button onClick={onImport} disabled={importing || active.length === 0} className="btn-primary gap-2 px-6">
          {importing
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
            : <><Upload className="h-4 w-4" /> Import {pluralise(active.length, 'Transaction')}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Done Step ───────────────────────────────────────────────────────────────
function DoneStep({ rows, onReset }: { rows: ReviewRow[]; onReset: () => void }) {
  const success = rows.filter((r) => r.status === 'success').length;
  const failed  = rows.filter((r) => r.status === 'error').length;
  const skipped = rows.filter((r) => r.skip).length;

  return (
    <div className="space-y-5">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="card p-8 text-center space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Import Complete!</h2>
        <div className="flex justify-center gap-6">
          <div className="text-center"><p className="text-2xl font-black text-emerald-600">{success}</p><p className="text-xs text-slate-400">Imported</p></div>
          {failed  > 0 && <div className="text-center"><p className="text-2xl font-black text-rose-600">{failed}</p><p className="text-xs text-slate-400">Failed</p></div>}
          {skipped > 0 && <div className="text-center"><p className="text-2xl font-black text-slate-500">{skipped}</p><p className="text-xs text-slate-400">Skipped</p></div>}
        </div>
        <p className="text-sm text-slate-500">
          {success > 0 ? `${pluralise(success, 'transaction')} added. ` : ''}
          {failed  > 0 ? `${failed} failed — add manually. ` : ''}
          {skipped > 0 ? `${skipped} skipped.` : ''}
        </p>
      </motion.div>

      {failed > 0 && (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800/60">
          <div className="p-3"><p className="text-xs font-bold uppercase tracking-wider text-rose-500">Failed Rows</p></div>
          {rows.filter((r) => r.status === 'error').map((r) => (
            <div key={r.id} className="p-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{r.description}</p>
              <p className="text-xs text-rose-500">{r.errorMsg}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onReset} className="btn-secondary flex-1 gap-2"><Upload className="h-4 w-4" /> Import Another</button>
        <a href="/transactions" className="btn-primary flex-1 text-center flex items-center justify-center gap-1.5">
          View Transactions <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [csvMeta, setCsvMeta] = useState<CSVMeta | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const qc = useQueryClient();
  const { showToast } = useToast();

  const goReview = (parsed: ParsedRow[]) => {
    setRows(parsed.map((p) => ({ ...p, id: uid(), category_id: '', skip: false })));
    setStep('review');
  };

  const handleNeedsMapping = (meta: CSVMeta, file: File) => {
    setCsvMeta(meta);
    setCsvFile(file);
    setStep('map');
  };

  const handleImport = async () => {
    const toImport = rows.filter((r) => !r.skip);
    if (!toImport.length) return;
    setImporting(true);
    setRows((prev) => prev.map((r) => r.skip ? r : { ...r, status: 'pending' }));

    const BATCH = 8;
    for (let i = 0; i < toImport.length; i += BATCH) {
      await Promise.all(toImport.slice(i, i + BATCH).map(async (row) => {
        try {
          await api('/api/transactions', {
            method: 'POST',
            body: JSON.stringify({
              account_id: accountId,
              category_id: row.category_id || null,
              type: row.type,
              amount: row.amount,
              date: row.date,
              time: row.time ? (row.time.length === 5 ? `${row.time}:00` : row.time) : null,
              description: row.description,
              tags: [],
              notes: 'Imported from bank statement',
            }),
          });
          setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: 'success' } : r));
        } catch (err) {
          setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: 'error', errorMsg: (err as Error).message } : r));
        }
      }));
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: queryKeys.accounts }),
      qc.invalidateQueries({ queryKey: queryKeys.account(accountId) }),
      qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
      qc.invalidateQueries({ queryKey: ['analytics'] }),
      qc.refetchQueries({ queryKey: queryKeys.accounts }),
      qc.refetchQueries({ queryKey: queryKeys.dashboard }),
    ]);
    setImporting(false);
    setStep('done');
    showToast('Import complete', 'success');
  };

  const handleReset = () => { setStep('upload'); setRows([]); setCsvMeta(null); setCsvFile(null); };
  const hasMap = step === 'map' || (step !== 'upload' && csvMeta !== null);

  return (
    <div className="space-y-5">
      <PageHeader title="Import Statement" subtitle="Upload a bank CSV or PDF to bulk-import transactions" icon={FileText} />

      <div className="card p-4"><Stepper step={step} hasMap={hasMap} /></div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <UploadStep accountId={accountId} setAccountId={setAccountId}
              onAutoSuccess={goReview} onNeedsMapping={handleNeedsMapping} />
          </motion.div>
        )}
        {step === 'map' && csvMeta && csvFile && (
          <motion.div key="map" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <MapColumnsStep meta={csvMeta} file={csvFile} onMapped={goReview} />
          </motion.div>
        )}
        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <ReviewStep rows={rows} setRows={setRows} onImport={() => void handleImport()} importing={importing} />
          </motion.div>
        )}
        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <DoneStep rows={rows} onReset={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
