import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/** Service-role client — bypasses RLS. Server only; never expose this key. */
export const supabaseAdmin: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/** @deprecated Prefer supabaseAdmin */
export const supabase = supabaseAdmin;

/**
 * User-scoped client with the caller's JWT so RLS policies apply.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
