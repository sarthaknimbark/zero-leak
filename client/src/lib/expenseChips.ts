export interface ExpenseChip {
  id: string;
  name: string;
  amount: number;
  accountId: string;
  categoryId: string | null;
  askAmount: boolean;
}

function storageKey(userId: string) {
  return `zl_expense_chips_${userId}`;
}

export function readExpenseChips(userId: string): ExpenseChip[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpenseChip[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((chip) => chip && typeof chip.id === 'string' && typeof chip.name === 'string');
  } catch {
    return [];
  }
}

export function writeExpenseChips(userId: string, chips: ExpenseChip[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(chips));
}
