/*
# Fix infinite recursion in profiles RLS policy

## Problem
The profiles SELECT policy checked admin status by querying profiles again:
`EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)`
This creates infinite recursion: evaluating the profiles policy requires querying profiles,
which triggers the policy again, forever.

## Fix
1. Replace the self-referencing admin check with a SECURITY DEFINER function
   `is_admin(uid)` that reads the profiles table with elevated privileges,
   bypassing RLS — so no recursion.
2. Rewrite the profiles SELECT policy to use `auth.uid() = id` OR `is_admin(auth.uid())`.
3. Drop the old recursive policy.
*/

-- SECURITY DEFINER function to check admin status without RLS recursion
CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = p_user_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;

-- Drop and recreate profiles SELECT policy without recursion
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR is_admin(auth.uid()));