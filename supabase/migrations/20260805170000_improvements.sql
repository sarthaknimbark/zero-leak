-- 1. Recurring Bills Trigger Function
CREATE OR REPLACE FUNCTION handle_recurring_bill()
RETURNS TRIGGER AS $$
DECLARE
  next_due_date DATE;
BEGIN
  -- If the bill status changed to paid, and it is a recurring bill
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.is_recurring = true THEN
    -- Calculate next due date
    IF NEW.recurrence_interval = 'weekly' THEN
      next_due_date := NEW.due_date + INTERVAL '1 week';
    ELSIF NEW.recurrence_interval = 'monthly' THEN
      next_due_date := NEW.due_date + INTERVAL '1 month';
    ELSIF NEW.recurrence_interval = 'yearly' THEN
      next_due_date := NEW.due_date + INTERVAL '1 year';
    ELSE
      next_due_date := NEW.due_date + INTERVAL '1 month'; -- Fallback
    END IF;

    -- Insert the next unpaid instance
    INSERT INTO bills (user_id, name, amount, due_date, due_time, category_id, status, is_recurring, recurrence_interval, notes)
    VALUES (
      NEW.user_id,
      NEW.name,
      NEW.amount,
      next_due_date,
      NEW.due_time,
      NEW.category_id,
      'unpaid',
      true,
      NEW.recurrence_interval,
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach Recurring Bill Trigger
DROP TRIGGER IF EXISTS trigger_recurring_bill ON bills;
CREATE TRIGGER trigger_recurring_bill
  AFTER UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION handle_recurring_bill();


-- 2. Auto-Status Updater Function
CREATE OR REPLACE FUNCTION update_overdue_bills()
RETURNS void AS $$
BEGIN
  UPDATE bills
  SET status = 'overdue'
  WHERE status = 'unpaid' AND (due_date + due_time) < NOW();
END;
$$ LANGUAGE plpgsql;


-- 3. In-App Notification Center Table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Select/Update/Delete Policies
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
