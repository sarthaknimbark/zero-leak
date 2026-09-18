import { useState } from 'react';
import { Download, Upload, FileText, Database, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ExportPage() {
  const { data: transactions } = useTransactions({});
  const { data: transfers } = useTransfers();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { showToast } = useToast();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const toCSV = (rows: Record<string, unknown>[]): string => {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => {
        const val = row[h];
        if (val == null) return '';
        const s = String(val).replace(/"/g, '""');
        return s.includes(',') || s.includes('\n') ? `"${s}"` : s;
      }).join(','));
    }
    return lines.join('\n');
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTransactionsCSV = () => {
    const rows = (transactions ?? []).map((t) => ({
      date: t.date, time: t.time, type: t.type, amount: t.amount,
      account: t.account?.name ?? '', category: t.category?.name ?? '',
      description: t.description ?? '', tags: t.tags.join(';'), notes: t.notes ?? '',
    }));
    download(toCSV(rows), 'zero-leak-transactions.csv', 'text/csv');
    showToast('Transactions exported as CSV', 'success');
  };

  const exportTransfersCSV = () => {
    const rows = (transfers ?? []).map((t) => ({
      date: t.date, time: t.time, from: t.from_account?.name ?? '',
      to: t.to_account?.name ?? '', amount: t.amount, fee: t.fee,
      description: t.description ?? '', notes: t.notes ?? '',
    }));
    download(toCSV(rows), 'zero-leak-transfers.csv', 'text/csv');
    showToast('Transfers exported as CSV', 'success');
  };

  const exportTransactionsPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header Banner color / Title
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('Zero Leak', 14, 20);
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('Transactions Ledger Report', 14, 28);
      
      // Metadata
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 36);
      
      const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance), 0);
      const totalTrans = (transactions ?? []).length;
      doc.text(`Net Portfolio Balance: ${formatCurrency(totalBalance)}   |   Total Recorded Items: ${totalTrans}`, 14, 42);

      // Setup table content
      const tableHeaders = [['Date', 'Type', 'Account', 'Category', 'Description', 'Amount']];
      const tableData = (transactions ?? []).map((t) => [
        t.date,
        t.type.toUpperCase(),
        t.account?.name ?? '',
        t.category?.name ?? '',
        t.description ?? '',
        formatCurrency(t.amount)
      ]);

      autoTable(doc, {
        startY: 48,
        head: tableHeaders,
        body: tableData,
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        theme: 'striped',
        margin: { top: 45, left: 14, right: 14 },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          5: { halign: 'right' }
        }
      });

      doc.save('zero-leak-transactions.pdf');
      showToast('Transactions exported as PDF', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export PDF', 'error');
    }
  };

  const exportTransfersPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229);
      doc.text('Zero Leak', 14, 20);
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Accounts Transfers Ledger', 14, 28);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 36);
      doc.text(`Total Transfers Recorded: ${(transfers ?? []).length}`, 14, 42);

      const tableHeaders = [['Date', 'From Account', 'To Account', 'Fee', 'Description', 'Amount']];
      const tableData = (transfers ?? []).map((t) => [
        t.date,
        t.from_account?.name ?? '',
        t.to_account?.name ?? '',
        formatCurrency(t.fee),
        t.description ?? '',
        formatCurrency(t.amount)
      ]);

      autoTable(doc, {
        startY: 48,
        head: tableHeaders,
        body: tableData,
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        theme: 'striped',
        margin: { top: 45, left: 14, right: 14 },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          3: { halign: 'right' },
          5: { halign: 'right' }
        }
      });

      doc.save('zero-leak-transfers.pdf');
      showToast('Transfers exported as PDF', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export PDF', 'error');
    }
  };

  const exportAllJSON = () => {
    const backup = {
      exported_at: new Date().toISOString(),
      accounts: accounts ?? [],
      transactions: transactions ?? [],
      transfers: transfers ?? [],
      categories: categories ?? [],
    };
    download(JSON.stringify(backup, null, 2), `zero-leak-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    showToast('Full backup exported', 'success');
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.accounts || !Array.isArray(data.accounts)) {
        showToast('Invalid backup file format', 'error');
        return;
      }
      showToast(`Backup loaded: ${data.accounts.length} accounts, ${data.transactions?.length ?? 0} transactions`, 'success');
    } catch {
      showToast('Could not read backup file', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Export & Backup" subtitle="Download your data or create a full backup" icon={Download} />

      {status && (
        <div className={`flex items-center gap-2 rounded-xl border p-3.5 text-sm ${
          status.type === 'success' ? 'border-success-200 bg-success-50 text-success-700' : 'border-error-200 bg-error-50 text-error-700'
        }`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ExportCard icon={<FileSpreadsheet className="h-5 w-5" />} title="Export Transactions (CSV)" description={`Download all ${(transactions ?? []).length} transactions as CSV`} onClick={exportTransactionsCSV} />
        <ExportCard icon={<FileText className="h-5 w-5" />} title="Export Transactions (PDF)" description={`Download all ${(transactions ?? []).length} transactions as PDF`} onClick={exportTransactionsPDF} />
        
        <ExportCard icon={<FileSpreadsheet className="h-5 w-5" />} title="Export Transfers (CSV)" description={`Download all ${(transfers ?? []).length} transfers as CSV`} onClick={exportTransfersCSV} />
        <ExportCard icon={<FileText className="h-5 w-5" />} title="Export Transfers (PDF)" description={`Download all ${(transfers ?? []).length} transfers as PDF`} onClick={exportTransfersPDF} />
        
        <ExportCard icon={<Database className="h-5 w-5" />} title="Full Backup (JSON)" description="Export accounts, transactions, transfers, and categories" onClick={exportAllJSON} />
        <ExportCard icon={<Upload className="h-5 w-5" />} title="Restore Backup" description="Import a previously exported JSON backup file" onClick={() => document.getElementById('import-file')?.click()} />
        <input id="import-file" type="file" accept="application/json" className="hidden" onChange={importBackup} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 section-title">Data Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryStat label="Accounts" value={(accounts ?? []).length} />
          <SummaryStat label="Transactions" value={(transactions ?? []).length} />
          <SummaryStat label="Transfers" value={(transfers ?? []).length} />
          <SummaryStat label="Total Balance" value={formatCurrency((accounts ?? []).reduce((s, a) => s + Number(a.current_balance), 0))} />
        </div>
      </div>
    </div>
  );
}

function ExportCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card card-hover p-5 text-left border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">{icon}</div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </button>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-800/40">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
