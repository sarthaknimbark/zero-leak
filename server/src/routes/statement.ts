import { Router } from 'express';
import multer from 'multer';
import { parse as csvParse } from 'csv-parse/sync';
// pdf-parse v2 exposes a class, not a function
import * as pdfParseNs from 'pdf-parse';
const { PDFParse } = pdfParseNs as unknown as {
  PDFParse: new (opts: { data?: Buffer | Uint8Array; verbosity?: number; url?: string }) => {
    load(): Promise<unknown>;
    getText(opts?: unknown): Promise<{ text: string; pages: Array<{ text: string; num: number }>; total: number } | string>;
    destroy(): Promise<void>;
  };
};
import { requireAuth } from '../middleware/auth.js';

export const statementRouter = Router();

// ─── Multer: memory storage (no disk writes) ────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['text/csv', 'application/csv', 'application/pdf', 'text/plain'].includes(
      file.mimetype
    ) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.pdf');
    cb(null, ok);
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ParsedRow {
  date: string;        // ISO date: YYYY-MM-DD
  time?: string;       // HH:MM:SS
  description: string;
  amount: number;
  type: 'income' | 'expense';
  raw: string;         // original row text for display
}

// ─── Date Normaliser ────────────────────────────────────────────────────────
function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 25-Oct-2026, 25 Oct 2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const dMmmY = s.match(/^(\d{1,2})[-/\s]([a-zA-Z]{3})[-/\s](\d{2,4})$/);
  if (dMmmY) {
    const [, d, mStr, y] = dMmmY;
    const m = monthMap[mStr.toLowerCase()];
    if (m) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // MM/DD/YYYY (US format)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const year = y.length === 2 ? `20${y}` : y;
    // Heuristic: if day > 12 it must be DD/MM, so swap
    const dayNum = parseInt(d, 10);
    const monNum = parseInt(m, 10);
    if (monNum > 12) return `${year}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native Date parse as last resort
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
  return null;
}

// ─── Time Normaliser ────────────────────────────────────────────────────────
function normaliseTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\s*(AM|PM|am|pm))?\b/);
  if (!match) return null;
  let [, hStr, mStr, sStr, meridiem] = match;
  let h = parseInt(hStr, 10);
  const m = mStr;
  const s = sStr || '00';
  if (meridiem) {
    const isPM = meridiem.toLowerCase() === 'pm';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
  }
  return `${String(h).padStart(2, '0')}:${m}:${s}`;
}

// ─── Amount Cleaner ─────────────────────────────────────────────────────────
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────
// Handles three real-world formats found in Indian bank CSVs:
//
// FORMAT A — Separate Debit / Credit columns (most common):
//   Date | Narration | Debit | Credit | Balance
//   → nonzero Debit = expense, nonzero Credit = income
//
// FORMAT B — Single Amount + Dr/Cr type column:
//   Date | Narration | Amount | Dr/Cr
//   → "Dr" / "Debit" = expense,  "Cr" / "Credit" = income
//
// FORMAT C — Single signed Amount:
//   Date | Description | Amount
//   → positive = income, negative / (parens) = expense
//
function parseCSV(buffer: Buffer): ParsedRow[] {
  const text = buffer.toString('utf-8');

  // Try common delimiters; prefer the parse that yields the most columns
  let rows: Record<string, string>[] = [];
  for (const delimiter of [',', ';', '\t', '|']) {
    try {
      const parsed = csvParse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter,
        relax_column_count: true,
        bom: true,
      }) as Record<string, string>[];
      if (
        parsed.length > 0 &&
        Object.keys(parsed[0]).length >= 2 &&
        Object.keys(parsed[0]).length > Object.keys(rows[0] ?? {}).length
      ) {
        rows = parsed;
      }
    } catch {
      continue;
    }
  }

  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());

  // ── Column detection ──────────────────────────────────────────────────────

  // Date
  const dateCandidates = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'trans date', 'dt', 'tran date'];
  const dateCol = headers.find((h) => dateCandidates.some((c) => h.includes(c))) ?? headers[0];

  // Description
  const descCandidates = ['description', 'narration', 'particulars', 'details', 'remarks', 'memo',
    'transaction details', 'trans details', 'chq/ref', 'transaction remarks'];
  const descCol = headers.find((h) => descCandidates.some((c) => h.includes(c)));

  // FORMAT A: separate Debit / Credit columns
  const debitKeywords  = ['debit', 'withdrawal', 'withdrawl', 'dr amount', 'debit amount', 'withdrawal amt', 'debit(inr)', 'withdrawal(inr)'];
  const creditKeywords = ['credit', 'deposit', 'cr amount', 'credit amount', 'deposit amt', 'credit(inr)', 'deposit(inr)'];
  const debitCol  = headers.find((h) => debitKeywords.some((k)  => h.includes(k)));
  const creditCol = headers.find((h) => creditKeywords.some((k) => h.includes(k)));

  // FORMAT B: Dr/Cr indicator column (paired with a single amount column)
  const drcrKeywords = ['dr/cr', 'cr/dr', 'txn type', 'transaction type', 'debit/credit', 'credit/debit', 'type'];
  const drcrCol = headers.find((h) => drcrKeywords.some((k) => h === k || h.includes(k)));

  // Single amount column (used by FORMAT B and FORMAT C)
  const amtKeywords = ['amount', 'amt', 'transaction amount', 'trans amount', 'inr', 'amount(inr)'];
  const amtCol = headers.find((h) => amtKeywords.some((k) => h.includes(k)));

  // Helper: resolve lowercase header → original-cased value from a row
  const makeGet = (row: Record<string, string>) => (lowerKey: string | undefined) => {
    if (!lowerKey) return undefined;
    const orig = Object.keys(row).find((h) => h.toLowerCase().trim() === lowerKey);
    return orig ? row[orig]?.trim() : undefined;
  };

  const results: ParsedRow[] = [];

  for (const row of rows) {
    const get = makeGet(row);

    // ── Date ─────────────────────────────────────────────────────────────────
    const rawDate = get(dateCol);
    const date = normaliseDate(rawDate ?? '');
    if (!date) continue;

    // ── Description ──────────────────────────────────────────────────────────
    const description = (get(descCol) ?? Object.values(row).join(' ')).trim();
    if (!description || description.length < 2) continue;

    // ── Amount + Type ─────────────────────────────────────────────────────────
    let amount: number | null = null;
    let type: 'income' | 'expense' = 'expense';

    if (debitCol || creditCol) {
      // ── FORMAT A: separate Debit/Credit columns ───────────────────────────
      // A row has a nonzero value in exactly one of the two columns.
      const debitVal  = parseAmount(get(debitCol));
      const creditVal = parseAmount(get(creditCol));

      if (debitVal && debitVal > 0 && (!creditVal || creditVal === 0)) {
        // Money LEFT the account → expense
        amount = debitVal;
        type   = 'expense';
      } else if (creditVal && creditVal > 0 && (!debitVal || debitVal === 0)) {
        // Money ENTERED the account → income
        amount = creditVal;
        type   = 'income';
      } else if (debitVal && creditVal) {
        // Both filled (rare malformed CSV) — pick larger
        amount = debitVal >= creditVal ? debitVal : creditVal;
        type   = debitVal >= creditVal ? 'expense' : 'income';
      }

    } else if (drcrCol && amtCol) {
      // ── FORMAT B: single Amount + Dr/Cr indicator column ─────────────────
      const indicator = (get(drcrCol) ?? '').toLowerCase().trim();
      const rawAmt    = parseAmount(get(amtCol));
      if (rawAmt && rawAmt > 0) {
        amount = rawAmt;
        // Exact matches first, then substring fallback
        if (/^(dr|d|debit|withdrawal|w|dbt|db)$/i.test(indicator)) {
          type = 'expense';
        } else if (/^(cr|c|credit|deposit|dep|crt)$/i.test(indicator)) {
          type = 'income';
        } else {
          type = indicator.includes('cr') || indicator.includes('credit') || indicator.includes('deposit')
            ? 'income'
            : 'expense'; // default debit
        }
      }

    } else if (amtCol) {
      // ── FORMAT C: single signed amount ───────────────────────────────────
      // Negative = expense, positive = income
      // Also handles accounting notation: (1299.00) = -1299 = expense
      const raw = get(amtCol) ?? '';
      const cleaned = raw.replace(/[₹$€£,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n !== 0) {
        amount = Math.abs(n);
        type   = n < 0 ? 'expense' : 'income';
      }
    }

    if (!amount || amount <= 0) continue;

    const time = normaliseTime(rawDate || '') || normaliseTime(description);

    results.push({
      date,
      time: time ?? undefined,
      description,
      amount,
      type,
      raw: Object.values(row).join(' | '),
    });
  }

  return results;
}

// ─── PDF Parser ─────────────────────────────────────────────────────────────
async function parsePDF(buffer: Buffer): Promise<ParsedRow[]> {
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  let rawText = '';
  try {
    const textResult = await parser.getText();
    rawText = typeof textResult === 'string' ? textResult : (textResult?.text ?? '');
  } finally {
    try {
      await parser.destroy();
    } catch {
      // ignore cleanup errors
    }
  }

  const rawLines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);

  // 1. Filter out known statement headers, customer info, and page footers
  const filtered: string[] = [];
  const dateRegex = /^(\d{1,2}[-/.][a-zA-Z0-9]{1,3}[-/. ]\d{2,4}|\d{4}-\d{2}-\d{2})/;
  const headerFooterRegex =
    /^Page\s+\d+|^--\s+\d+\s+of\s+\d+\s+--|^Statement\s+from|^\d{10,}\s+-|Mobile\s+Banking\s+App|Generated,\s+hence\s+no\s+signature|^Account\s+Statement|^Customer\s+ID|^A\/c\s+Number|^A\/c\s+Type|^Opening\s+Date|^CKYC\s+No|^PAN\s+No|^IFSC\s+Code|^MICR\s+Code|^TRN\.\s*Date/i;

  for (const l of rawLines) {
    if (headerFooterRegex.test(l)) continue;
    filtered.push(l);
  }

  // 2. Group lines into transaction blocks by leading transaction date
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of filtered) {
    if (dateRegex.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    }
    currentBlock.push(line);
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  let prevBalance: number | null = null;
  const results: ParsedRow[] = [];

  for (const block of blocks) {
    const firstLine = block[0];

    // Detect opening balance & initialize tracking
    if (/opening\s+balance|brought\s+forward|b\/f/i.test(firstLine)) {
      const match = firstLine.match(/([\d,]+\.\d{2})/g);
      if (match && match.length > 0) {
        prevBalance = parseFloat(match[match.length - 1].replace(/,/g, ''));
      }
      continue;
    }

    if (/closing\s+balance|carried\s+forward|c\/f/i.test(firstLine)) {
      continue;
    }

    const dateMatch = firstLine.match(dateRegex);
    if (!dateMatch) continue;
    const date = normaliseDate(dateMatch[1]);
    if (!date) continue;

    // Search for time explicitly in the transaction block text (null if not found)
    const blockText = block.join(' ');
    const time = normaliseTime(blockText);

    // Extract amount and closing balance
    let amount = 0;
    let closingBal: number | null = null;

    // In multi-line bank tables (e.g. Varachha, SBI, HDFC), amounts are on the final line(s) of the block
    for (let i = block.length - 1; i >= 0; i--) {
      const line = block[i];
      const numbers: number[] = [];
      const numRegex = /(?<![:\w\-\/])(?:[₹$]?\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![:\w\-\/])/g;
      let m: RegExpExecArray | null;
      while ((m = numRegex.exec(line)) !== null) {
        const raw = m[1].replace(/,/g, '');
        if (!m[1].includes('.') && raw.length >= 7) continue; // skip long UTR / RRN numbers
        const num = parseFloat(raw);
        if (num > 0) numbers.push(num);
      }

      if (numbers.length >= 2) {
        amount = numbers[numbers.length - 2];
        closingBal = numbers[numbers.length - 1];
        break;
      } else if (numbers.length === 1 && closingBal === null) {
        closingBal = numbers[0];
      }
    }

    // Fallback for single-line statements if amount was not isolated in last line
    if (!amount || amount <= 0) {
      const moneyRegex = /(?<![:\w\-\/])(?:[₹$]?\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![:\w\-\/])/g;
      const allNums: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = moneyRegex.exec(blockText)) !== null) {
        const raw = m[1].replace(/,/g, '');
        if (!m[1].includes('.') && raw.length >= 7) continue;
        const num = parseFloat(raw);
        if (num > 0) allNums.push(num);
      }
      if (allNums.length >= 2) {
        amount = allNums[allNums.length - 2];
        closingBal = allNums[allNums.length - 1];
      } else if (allNums.length === 1) {
        amount = allNums[0];
      }
    }

    if (!amount || amount <= 0) continue;

    // Detect type: Income vs Expense
    // 1) Mathematically verified by running balance delta:
    let type: 'income' | 'expense' = 'expense';
    if (prevBalance !== null && closingBal !== null && Math.abs(closingBal - prevBalance) > 0.01) {
      if (closingBal > prevBalance) {
        type = 'income';
      } else {
        type = 'expense';
      }
      prevBalance = closingBal;
    } else {
      // 2) Keyword fallback if balance delta is ambiguous
      if (/\b(?:cr|credit|deposit|by\s+trf|interest|refund)\b/i.test(blockText) || /\/cr\b/i.test(blockText)) {
        type = 'income';
      } else {
        type = 'expense';
      }
      if (closingBal !== null) prevBalance = closingBal;
    }

    // Clean payee / description:
    // Strip date prefix from first line, drop pure account/IFSC/bank routing codes
    const descParts: string[] = [];
    for (let i = 0; i < block.length; i++) {
      let l = block[i];
      if (i === 0) {
        l = l.replace(/^(\d{1,2}[-/.][a-zA-Z0-9]{1,3}[-/. ]\d{2,4})\s+(\d{1,2}[-/.][a-zA-Z0-9]{1,3}[-/. ]\d{2,4}\s+)?/, '');
      }
      // Remove lines that are just numbers/amounts/balances
      if (/^0\s+[\d,]+\.\d{2}|^\d+\s+[\d,]+\.\d{2}/.test(l)) continue;
      if (/^[\d,]+\.\d{2}\s+[\d,]+\.\d{2}$/.test(l)) continue;
      // Remove pure account numbers/IFSC/noise
      if (/^[0-9]{10,}\s+[A-Z]{4}\d{7}/.test(l)) continue;
      if (/^UTIB|^YESB|^BARB|^SBIN|^ICIC|^HDFC/i.test(l)) continue;
      if (/^Sen$|^Sent\s+u|^NA$/i.test(l)) continue;
      const trimmed = l.trim();
      if (trimmed) descParts.push(trimmed);
    }

    const description = descParts.join(' · ').replace(/\s+·\s+$/, '').trim() || 'Bank Transaction';

    results.push({
      date,
      time: time ?? undefined,
      description,
      amount,
      type,
      raw: block.join(' | '),
    });
  }

  return results;
}

// ─── Helper: extract raw CSV rows + auto-detected column hints ───────────────
function extractCSVMeta(buffer: Buffer): {
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
} {
  const text = buffer.toString('utf-8');
  let rows: Record<string, string>[] = [];
  for (const delimiter of [',', ';', '\t', '|']) {
    try {
      const parsed = csvParse(text, {
        columns: true, skip_empty_lines: true, trim: true,
        delimiter, relax_column_count: true, bom: true,
      }) as Record<string, string>[];
      if (parsed.length > 0 && Object.keys(parsed[0]).length > Object.keys(rows[0] ?? {}).length) {
        rows = parsed;
      }
    } catch { continue; }
  }

  if (rows.length === 0) return { headers: [], sample: [], detected: { amountMode: 'unknown' } };

  const originalHeaders = Object.keys(rows[0]);
  const headers = originalHeaders;
  const lc = (h: string) => h.toLowerCase().trim();

  const find = (keywords: string[]) =>
    headers.find((h) => keywords.some((k) => lc(h).includes(k)));

  const dateCol  = find(['date', 'txn date', 'transaction date', 'value date', 'posting date', 'trans date', 'dt']);
  const descCol  = find(['description', 'narration', 'particulars', 'details', 'remarks', 'memo']);
  const debitCol = find(['debit', 'withdrawal', 'withdrawl', 'dr amount']);
  const creditCol= find(['credit', 'deposit', 'cr amount']);
  const drcrCol  = find(['dr/cr', 'cr/dr', 'txn type', 'transaction type', 'debit/credit']);
  const amtCol   = find(['amount', 'amt', 'transaction amount', 'trans amount', 'inr']);

  let amountMode: 'separate' | 'drcr' | 'signed' | 'unknown' = 'unknown';
  if (debitCol || creditCol) amountMode = 'separate';
  else if (drcrCol && amtCol) amountMode = 'drcr';
  else if (amtCol) amountMode = 'signed';

  return {
    headers,
    sample: rows.slice(0, 5),
    detected: { dateCol, descCol, debitCol, creditCol, drcrCol, amtCol, amountMode },
  };
}

// ─── Helper: parse CSV using explicit column mapping from client ──────────────
interface ColumnMapping {
  dateCol: string;
  descCol: string;
  amountMode: 'separate' | 'drcr' | 'signed';
  debitCol?: string;
  creditCol?: string;
  amtCol?: string;
  drcrCol?: string;
}

function parseCSVWithMapping(buffer: Buffer, mapping: ColumnMapping): ParsedRow[] {
  const text = buffer.toString('utf-8');
  let rows: Record<string, string>[] = [];
  for (const delimiter of [',', ';', '\t', '|']) {
    try {
      const parsed = csvParse(text, {
        columns: true, skip_empty_lines: true, trim: true,
        delimiter, relax_column_count: true, bom: true,
      }) as Record<string, string>[];
      if (parsed.length > 0 && Object.keys(parsed[0]).length > Object.keys(rows[0] ?? {}).length) {
        rows = parsed;
      }
    } catch { continue; }
  }
  if (rows.length === 0) return [];

  const makeGet = (row: Record<string, string>) => (col: string | undefined) => {
    if (!col) return undefined;
    const orig = Object.keys(row).find((h) => h === col);
    return orig ? row[orig]?.trim() : undefined;
  };

  const results: ParsedRow[] = [];
  for (const row of rows) {
    const get = makeGet(row);

    const date = normaliseDate(get(mapping.dateCol) ?? '');
    if (!date) continue;

    const description = (get(mapping.descCol) ?? Object.values(row).join(' ')).trim();
    if (!description || description.length < 2) continue;

    let amount: number | null = null;
    let type: 'income' | 'expense' = 'expense';

    if (mapping.amountMode === 'separate') {
      const dv = parseAmount(get(mapping.debitCol));
      const cv = parseAmount(get(mapping.creditCol));
      if (dv && dv > 0 && (!cv || cv === 0))       { amount = dv; type = 'expense'; }
      else if (cv && cv > 0 && (!dv || dv === 0))  { amount = cv; type = 'income'; }
      else if (dv && cv)                            { amount = Math.max(dv, cv); type = dv >= cv ? 'expense' : 'income'; }

    } else if (mapping.amountMode === 'drcr') {
      const indicator = (get(mapping.drcrCol) ?? '').toLowerCase().trim();
      const rawAmt = parseAmount(get(mapping.amtCol));
      if (rawAmt && rawAmt > 0) {
        amount = rawAmt;
        type = /^(cr|c|credit|deposit|dep|crt)$/i.test(indicator) ||
               indicator.includes('cr') || indicator.includes('credit')
          ? 'income' : 'expense';
      }

    } else {
      const raw = get(mapping.amtCol) ?? '';
      const cleaned = raw.replace(/[₹$€£,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n !== 0) { amount = Math.abs(n); type = n < 0 ? 'expense' : 'income'; }
    }

    if (!amount || amount <= 0) continue;
    const rawDateVal = get(mapping.dateCol) ?? '';
    const time = normaliseTime(rawDateVal) || normaliseTime(description);
    results.push({ date, time: time ?? undefined, description, amount, type, raw: Object.values(row).join(' | ') });
  }
  return results;
}

// ─── POST /api/statement/upload ──────────────────────────────────────────────
// Step 1: Upload file. Returns auto-parsed rows + raw CSV metadata for column mapping.
statementRouter.post(
  '/api/statement/upload',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

      const { originalname, buffer, mimetype } = req.file;
      const isPdf = mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        // PDFs: always auto-parse (no column mapping available)
        const rows = await parsePDF(buffer);
        if (rows.length === 0) {
          res.status(422).json({ error: 'Could not extract transactions from this PDF. Only text-based PDFs work.' });
          return;
        }
        res.json({ rows, count: rows.length, fileType: 'pdf', needsMapping: false });
        return;
      }

      // CSV: auto-parse first
      const autoRows = parseCSV(buffer);
      const meta = extractCSVMeta(buffer);

      // If auto-parse found rows confidently, return them directly
      if (autoRows.length > 0 && meta.detected.amountMode !== 'unknown') {
        res.json({
          rows: autoRows,
          count: autoRows.length,
          fileType: 'csv',
          needsMapping: false,
          // Still return mapping info so user can override if needed
          mapping: meta,
        });
        return;
      }

      // Auto-parse failed or ambiguous — return raw data for manual mapping
      res.json({
        rows: [],
        count: 0,
        fileType: 'csv',
        needsMapping: true,
        mapping: meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/statement/parse-with-mapping ───────────────────────────────────
// Step 2 (only for CSV): Client sends column mapping config, server re-parses with it.
statementRouter.post(
  '/api/statement/parse-with-mapping',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

      let mapping: ColumnMapping;
      try {
        mapping = JSON.parse(req.body.mapping as string) as ColumnMapping;
      } catch {
        res.status(400).json({ error: 'Invalid mapping config' });
        return;
      }

      const rows = parseCSVWithMapping(req.file.buffer, mapping);
      if (rows.length === 0) {
        res.status(422).json({ error: 'No transactions found with this column mapping. Please check your selections.' });
        return;
      }

      res.json({ rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  }
);

