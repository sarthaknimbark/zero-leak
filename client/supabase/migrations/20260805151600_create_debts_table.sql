CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('lent', 'borrowed')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debts_select_own" ON debts;
CREATE POLICY "debts_select_own" ON debts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_insert_own" ON debts;
CREATE POLICY "debts_insert_own" ON debts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_update_own" ON debts;
CREATE POLICY "debts_update_own" ON debts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_delete_own" ON debts;
CREATE POLICY "debts_delete_own" ON debts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
