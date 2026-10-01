-- Let the signed-in user save their own in-app reminders.
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
