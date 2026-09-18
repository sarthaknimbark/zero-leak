-- RPC to update an existing transaction safely, adjusting balances
CREATE OR REPLACE FUNCTION update_transaction(
  p_transaction_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_type text,
  p_amount numeric,
  p_date date,
  p_time time,
  p_description text,
  p_tags text[],
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_account_id uuid;
  v_old_type text;
  v_old_amount numeric;
  v_old_delta numeric;
  v_new_delta numeric;
BEGIN
  -- 1. Get old transaction details
  SELECT account_id, type, amount INTO v_old_account_id, v_old_type, v_old_amount
  FROM transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- 2. Reverse old transaction's balance effect
  IF v_old_type = 'expense' THEN
    v_old_delta := v_old_amount; -- reverse: add back
  ELSE
    v_old_delta := -v_old_amount; -- reverse: subtract
  END IF;

  UPDATE accounts SET current_balance = current_balance + v_old_delta
  WHERE id = v_old_account_id;

  -- 3. Calculate new transaction's balance effect
  IF p_type = 'expense' THEN
    v_new_delta := -p_amount;
  ELSE
    v_new_delta := p_amount;
  END IF;

  -- 4. Update the transaction row
  UPDATE transactions SET
    account_id = p_account_id,
    category_id = p_category_id,
    type = p_type,
    amount = p_amount,
    date = p_date,
    time = p_time,
    description = p_description,
    tags = p_tags,
    notes = p_notes
  WHERE id = p_transaction_id;

  -- 5. Apply new transaction's balance effect
  UPDATE accounts SET current_balance = current_balance + v_new_delta
  WHERE id = p_account_id;

  -- 6. Log audit
  INSERT INTO audit_logs (action, entity_type, entity_id, details)
  VALUES ('update', 'transaction', p_transaction_id,
    jsonb_build_object(
      'old_account_id', v_old_account_id, 'old_amount', v_old_amount, 'old_type', v_old_type,
      'new_account_id', p_account_id, 'new_amount', p_amount, 'new_type', p_type
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION update_transaction TO authenticated;

-- RPC to update an existing transfer safely, adjusting balances
CREATE OR REPLACE FUNCTION update_transfer(
  p_transfer_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_fee numeric,
  p_date date,
  p_time time,
  p_description text,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_from uuid;
  v_old_to uuid;
  v_old_amount numeric;
  v_old_fee numeric;
BEGIN
  -- 1. Get old transfer details
  SELECT from_account_id, to_account_id, amount, fee INTO v_old_from, v_old_to, v_old_amount, v_old_fee
  FROM transfers WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  -- 2. Reverse old transfer's balance changes
  UPDATE accounts SET current_balance = current_balance + (v_old_amount + v_old_fee)
  WHERE id = v_old_from;
  UPDATE accounts SET current_balance = current_balance - v_old_amount
  WHERE id = v_old_to;

  -- 3. Check new source balance sufficiency
  DECLARE
    v_source_balance numeric;
  BEGIN
    SELECT current_balance INTO v_source_balance FROM accounts WHERE id = p_from_account_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Source account not found';
    END IF;
    IF v_source_balance < (p_amount + p_fee) THEN
      RAISE EXCEPTION 'Insufficient balance in source account';
    END IF;
  END;

  -- 4. Update transfer row
  UPDATE transfers SET
    from_account_id = p_from_account_id,
    to_account_id = p_to_account_id,
    amount = p_amount,
    fee = p_fee,
    date = p_date,
    time = p_time,
    description = p_description,
    notes = p_notes
  WHERE id = p_transfer_id;

  -- 5. Apply new transfer's balance changes
  UPDATE accounts SET current_balance = current_balance - (p_amount + p_fee)
  WHERE id = p_from_account_id;
  UPDATE accounts SET current_balance = current_balance + p_amount
  WHERE id = p_to_account_id;

  -- 6. Log audit
  INSERT INTO audit_logs (action, entity_type, entity_id, details)
  VALUES ('update', 'transfer', p_transfer_id,
    jsonb_build_object(
      'old_from', v_old_from, 'old_to', v_old_to, 'old_amount', v_old_amount, 'old_fee', v_old_fee,
      'new_from', p_from_account_id, 'new_to', p_to_account_id, 'new_amount', p_amount, 'new_fee', p_fee
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION update_transfer TO authenticated;
