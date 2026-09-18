export type AccountType = 'cash' | 'bank' | 'wallet' | 'investment';
export type AccountStatus = 'active' | 'archived';
export type TransactionType = 'income' | 'expense' | 'adjustment';
export type CategoryType = 'income' | 'expense';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  disabled: boolean;
  default_currency: string;
  pin_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  opening_balance: number;
  current_balance: number;
  color: string;
  icon: string;
  status: AccountStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  time: string;
  description: string | null;
  tags: string[];
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  account?: Pick<Account, 'id' | 'name' | 'type' | 'color' | 'icon'>;
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>;
}

export interface Transfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  fee: number;
  date: string;
  time: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  from_account?: Pick<Account, 'id' | 'name' | 'type' | 'color' | 'icon'>;
  to_account?: Pick<Account, 'id' | 'name' | 'type' | 'color' | 'icon'>;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string;
  due_time: string;
  category_id: string | null;
  status: 'paid' | 'unpaid' | 'overdue';
  is_recurring: boolean;
  recurrence_interval: 'monthly' | 'weekly' | 'yearly' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>;
}

export interface SavingGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  icon: string;
  target_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  friend_name: string;
  type: 'lent' | 'borrowed';
  amount: number;
  description: string | null;
  status: 'pending' | 'settled';
  date: string;
  created_at: string;
}
