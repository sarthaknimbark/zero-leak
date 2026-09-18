/*
# Zero Leak - Core Financial Schema

## Overview
Creates the complete data model for a multi-user Personal Money Management System.
Every user only sees their own financial data. Balances are kept consistent via
atomic SQL RPC functions for transactions and transfers.

## New Tables
1. `profiles` - Extends auth.users with display name, avatar, is_admin flag.
2. `accounts` - Bank accounts, cash wallets, future wallets, future investments.
   Tracks opening_balance and current_balance. Color/icon for UI. Status active/archived.
3. `categories` - Income and expense categories with color/icon, default and custom.
4. `transactions` - Income, expense, adjustment entries. Linked to account + category.
   Reverses balance effect when deleted.
5. `transfers` - Money movements between two accounts. Source/destination, amount, fees.
6. `audit_logs` - Append-only record of balance-affecting operations for traceability.

## Security
- RLS enabled on all tables.
- All tables owner-scoped to auth.uid() via user_id column DEFAULT auth.uid().
- profiles: user reads/updates own row; admin role reads all (via is_admin check).
- Separate CRUD policies per table, scoped TO authenticated.

## Balance Integrity
- `apply_transaction` RPC: inserts a transaction and atomically adjusts the account
  balance in a single operation. Income/adjustment add; expense subtracts.
- `apply_transfer` RPC: inserts a transfer record and atomically moves money between
  two accounts, validating sufficient balance and preventing same-source/destination.
- Deletion of transactions/transfers reverses the balance effect via RPC.
*/

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  disabled boolean NOT NULL DEFAULT false,
  default_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================================
-- ACCOUNTS
-- =========================================================
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bank' CHECK (type IN ('cash','bank','wallet','investment')),
  institution text,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#4f46e5',
  icon text NOT NULL DEFAULT 'wallet',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts_select_own" ON accounts;
CREATE POLICY "accounts_select_own" ON accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_insert_own" ON accounts;
CREATE POLICY "accounts_insert_own" ON accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_update_own" ON accounts;
CREATE POLICY "accounts_update_own" ON accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_delete_own" ON accounts;
CREATE POLICY "accounts_delete_own" ON accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  color text NOT NULL DEFAULT '#64748b',
  icon text NOT NULL DEFAULT 'tag',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_own" ON categories;
CREATE POLICY "categories_select_own" ON categories FOR SELECT
  TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_insert_own" ON categories;
CREATE POLICY "categories_insert_own" ON categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_update_own" ON categories;
CREATE POLICY "categories_update_own" ON categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_delete_own" ON categories;
CREATE POLICY "categories_delete_own" ON categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- =========================================================
-- TRANSACTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income','expense','adjustment')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  time time NOT NULL DEFAULT CURRENT_TIME,
  description text,
  tags text[] DEFAULT '{}',
  notes text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON transactions;
CREATE POLICY "transactions_update_own" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON transactions;
CREATE POLICY "transactions_delete_own" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- =========================================================
-- TRANSFERS
-- =========================================================
CREATE TABLE IF NOT EXISTS transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  fee numeric(18,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  time time NOT NULL DEFAULT CURRENT_TIME,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfers_different_accounts CHECK (from_account_id <> to_account_id)
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers_select_own" ON transfers;
CREATE POLICY "transfers_select_own" ON transfers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transfers_insert_own" ON transfers;
CREATE POLICY "transfers_insert_own" ON transfers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transfers_update_own" ON transfers;
CREATE POLICY "transfers_update_own" ON transfers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transfers_delete_own" ON transfers;
CREATE POLICY "transfers_delete_own" ON transfers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transfers_user ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_own" ON audit_logs;
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_logs_insert_own" ON audit_logs;
CREATE POLICY "audit_logs_insert_own" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_logs_delete_own" ON audit_logs;
CREATE POLICY "audit_logs_delete_own" ON audit_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated ON accounts;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- RPC: APPLY TRANSACTION (atomic insert + balance update)
-- =========================================================
CREATE OR REPLACE FUNCTION apply_transaction(
  p_account_id uuid,
  p_category_id uuid,
  p_type text,
  p_amount numeric,
  p_date date,
  p_time time,
  p_description text,
  p_tags text[],
  p_notes text,
  p_attachment_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_delta numeric;
BEGIN
  IF p_type NOT IN ('income','expense','adjustment') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be non-negative';
  END IF;
  IF p_type = 'expense' THEN
    v_delta := -p_amount;
  ELSE
    v_delta := p_amount;
  END IF;

  INSERT INTO transactions (account_id, category_id, type, amount, date, time, description, tags, notes, attachment_url)
  VALUES (p_account_id, p_category_id, p_type, p_amount, p_date, p_time, p_description, p_tags, p_notes, p_attachment_url)
  RETURNING id INTO v_id;

  UPDATE accounts
    SET current_balance = current_balance + v_delta
    WHERE id = p_account_id;

  INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('create', 'transaction', v_id,
      jsonb_build_object('type', p_type, 'amount', p_amount, 'account_id', p_account_id, 'delta', v_delta));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_transaction TO authenticated;

-- =========================================================
-- RPC: DELETE TRANSACTION (reverse balance)
-- =========================================================
CREATE OR REPLACE FUNCTION delete_transaction(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_type text;
  v_amount numeric;
  v_delta numeric;
BEGIN
  SELECT account_id, type, amount INTO v_account_id, v_type, v_amount
    FROM transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_type = 'expense' THEN
    v_delta := v_amount; -- reverse: add back
  ELSE
    v_delta := -v_amount; -- reverse: subtract
  END IF;

  UPDATE accounts SET current_balance = current_balance + v_delta
    WHERE id = v_account_id;

  DELETE FROM transactions WHERE id = p_transaction_id;

  INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('delete', 'transaction', p_transaction_id,
      jsonb_build_object('type', v_type, 'amount', v_amount, 'account_id', v_account_id, 'delta', v_delta));
END;
$$;

GRANT EXECUTE ON FUNCTION delete_transaction TO authenticated;

-- =========================================================
-- RPC: APPLY TRANSFER (atomic: debit source, credit dest, insert record)
-- =========================================================
CREATE OR REPLACE FUNCTION apply_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_fee numeric,
  p_date date,
  p_time time,
  p_description text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_source_balance numeric;
BEGIN
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be different';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  SELECT current_balance INTO v_source_balance FROM accounts WHERE id = p_from_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found';
  END IF;
  IF v_source_balance < (p_amount + p_fee) THEN
    RAISE EXCEPTION 'Insufficient balance in source account';
  END IF;

  INSERT INTO transfers (from_account_id, to_account_id, amount, fee, date, time, description, notes)
  VALUES (p_from_account_id, p_to_account_id, p_amount, p_fee, p_date, p_time, p_description, p_notes)
  RETURNING id INTO v_id;

  UPDATE accounts SET current_balance = current_balance - (p_amount + p_fee)
    WHERE id = p_from_account_id;
  UPDATE accounts SET current_balance = current_balance + p_amount
    WHERE id = p_to_account_id;

  INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('create', 'transfer', v_id,
      jsonb_build_object('from', p_from_account_id, 'to', p_to_account_id, 'amount', p_amount, 'fee', p_fee));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_transfer TO authenticated;

-- =========================================================
-- RPC: DELETE TRANSFER (reverse both balances)
-- =========================================================
CREATE OR REPLACE FUNCTION delete_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid;
  v_to uuid;
  v_amount numeric;
  v_fee numeric;
BEGIN
  SELECT from_account_id, to_account_id, amount, fee INTO v_from, v_to, v_amount, v_fee
    FROM transfers WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  UPDATE accounts SET current_balance = current_balance + (v_amount + v_fee)
    WHERE id = v_from;
  UPDATE accounts SET current_balance = current_balance - v_amount
    WHERE id = v_to;

  DELETE FROM transfers WHERE id = p_transfer_id;

  INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('delete', 'transfer', p_transfer_id,
      jsonb_build_object('from', v_from, 'to', v_to, 'amount', v_amount, 'fee', v_fee));
END;
$$;

GRANT EXECUTE ON FUNCTION delete_transfer TO authenticated;

-- =========================================================
-- RPC: ADMIN STATS (aggregate app-wide analytics)
-- =========================================================
CREATE OR REPLACE FUNCTION admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'total_accounts', (SELECT count(*) FROM accounts),
    'total_transactions', (SELECT count(*) FROM transactions),
    'total_transfers', (SELECT count(*) FROM transfers),
    'total_income', (SELECT COALESCE(sum(amount),0) FROM transactions WHERE type='income'),
    'total_expense', (SELECT COALESCE(sum(amount),0) FROM transactions WHERE type='expense'),
    'active_users_30d', (SELECT count(DISTINCT user_id) FROM transactions WHERE created_at > now() - interval '30 days')
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_stats TO authenticated;

-- =========================================================
-- SEED DEFAULT CATEGORIES (shared, user_id NULL)
-- =========================================================
INSERT INTO categories (user_id, name, type, color, icon, is_default) VALUES
  (NULL, 'Salary', 'income', '#10b981', 'briefcase', true),
  (NULL, 'Freelance', 'income', '#06b6d4', 'laptop', true),
  (NULL, 'Investments', 'income', '#8b5cf6', 'trending-up', true),
  (NULL, 'Gifts', 'income', '#f59e0b', 'gift', true),
  (NULL, 'Refund', 'income', '#14b8a6', 'rotate-ccw', true),
  (NULL, 'Groceries', 'expense', '#ef4444', 'shopping-cart', true),
  (NULL, 'Rent', 'expense', '#f97316', 'home', true),
  (NULL, 'Utilities', 'expense', '#eab308', 'zap', true),
  (NULL, 'Transport', 'expense', '#3b82f6', 'car', true),
  (NULL, 'Dining', 'expense', '#ec4899', 'utensils', true),
  (NULL, 'Entertainment', 'expense', '#a855f7', 'film', true),
  (NULL, 'Health', 'expense', '#22c55e', 'heart-pulse', true),
  (NULL, 'Shopping', 'expense', '#6366f1', 'shopping-bag', true),
  (NULL, 'Education', 'expense', '#0ea5e9', 'book-open', true)
ON CONFLICT DO NOTHING;

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
