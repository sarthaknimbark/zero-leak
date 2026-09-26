-- Add account_id column to debts table to optionally link directly to accounts table
ALTER TABLE debts ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_debts_account_id ON debts(account_id);
