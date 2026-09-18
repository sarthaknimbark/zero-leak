import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from './profile.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      accessToken?: string;
      profile?: ProfileRow;
    }
  }
}

export {};
