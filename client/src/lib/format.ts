const CURRENCY = 'INR';

// Cache maps to avoid recreation of expensive formatting objects on every animation frame/render
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}-${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function getDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}-${JSON.stringify(options)}`;
  let formatter = dateTimeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateTimeFormatters.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(
  amount: number,
  currency = CURRENCY,
  opts: Intl.NumberFormatOptions = {}
): string {
  const formatter = getNumberFormatter('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...opts,
  });
  return formatter.format(amount);
}

export function formatCompact(amount: number, currency = CURRENCY): string {
  const formatter = getNumberFormatter('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return formatter.format(amount);
}

export function formatNumber(amount: number): string {
  const formatter = getNumberFormatter('en-IN', { maximumFractionDigits: 2 });
  return formatter.format(amount);
}

export function formatDate(date: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = getDateTimeFormatter('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
  return formatter.format(d);
}

export function formatTime(time: string): string {
  if (!time) return '';
  const parts = time.split(':');
  const hour = parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatMonthYear(date: string): string {
  const d = new Date(date + '-01');
  const formatter = getDateTimeFormatter('en-IN', { month: 'short', year: '2-digit' });
  return formatter.format(d);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function initials(name?: string | null): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
