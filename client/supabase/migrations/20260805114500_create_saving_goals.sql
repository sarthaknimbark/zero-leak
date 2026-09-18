-- Helper trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- SAVING GOALS (POTS)
-- =========================================================
CREATE TABLE IF NOT EXISTS saving_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric(18,2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  color text NOT NULL DEFAULT '#6366f1',
  icon text NOT NULL DEFAULT 'piggy-bank',
  target_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE saving_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saving_goals_select_own" ON saving_goals;
CREATE POLICY "saving_goals_select_own" ON saving_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saving_goals_insert_own" ON saving_goals;
CREATE POLICY "saving_goals_insert_own" ON saving_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saving_goals_update_own" ON saving_goals;
CREATE POLICY "saving_goals_update_own" ON saving_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saving_goals_delete_own" ON saving_goals;
CREATE POLICY "saving_goals_delete_own" ON saving_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saving_goals_user ON saving_goals(user_id);

-- Auto Update Trigger
CREATE OR REPLACE TRIGGER update_saving_goals_updated_at
  BEFORE UPDATE ON saving_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DEPOSIT TO SAVING GOAL
-- =========================================================
CREATE OR REPLACE FUNCTION deposit_to_saving_goal(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric
) RETURNS void AS $$
DECLARE
  v_goal_name text;
  v_user_id uuid;
BEGIN
  -- Get goal details
  SELECT name, user_id INTO v_goal_name, v_user_id
  FROM saving_goals
  WHERE id = p_goal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saving goal not found';
  END IF;

  -- Verify user ownership
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Deduct from account balance by writing an expense transaction
  -- Null category_id for pot transfers
  PERFORM apply_transaction(
    p_account_id,
    null,
    'expense',
    p_amount,
    CURRENT_DATE,
    CURRENT_TIME,
    'Saving Pot Deposit: ' || v_goal_name,
    ARRAY['pot-deposit'],
    'Deposit of ' || p_amount || ' into saving goal: ' || v_goal_name,
    null
  );

  -- 2. Increment pot current_amount
  UPDATE saving_goals
  SET current_amount = current_amount + p_amount
  WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- WITHDRAW FROM SAVING GOAL
-- =========================================================
CREATE OR REPLACE FUNCTION withdraw_from_saving_goal(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric
) RETURNS void AS $$
DECLARE
  v_goal_name text;
  v_user_id uuid;
  v_current_amount numeric;
BEGIN
  -- Get goal details
  SELECT name, user_id, current_amount INTO v_goal_name, v_user_id, v_current_amount
  FROM saving_goals
  WHERE id = p_goal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saving goal not found';
  END IF;

  -- Verify user ownership
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify pot has enough money
  IF v_current_amount < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in saving goal';
  END IF;

  -- 1. Add back to account balance by writing an income transaction
  PERFORM apply_transaction(
    p_account_id,
    null,
    'income',
    p_amount,
    CURRENT_DATE,
    CURRENT_TIME,
    'Saving Pot Withdrawal: ' || v_goal_name,
    ARRAY['pot-withdrawal'],
    'Withdrawal of ' || p_amount || ' from saving goal: ' || v_goal_name,
    null
  );

  -- 2. Decrement pot current_amount
  UPDATE saving_goals
  SET current_amount = current_amount - p_amount
  WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
