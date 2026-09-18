export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  disabled: boolean;
  default_currency: string;
  pin_enabled?: boolean;
  push_subscription?: unknown;
  created_at: string;
  updated_at: string;
}
