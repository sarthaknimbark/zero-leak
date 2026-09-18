import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().default('mailto:support@zeroleak.app'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  CRON_SECRET: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid server environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;
const supabaseUrl = raw.SUPABASE_URL ?? raw.VITE_SUPABASE_URL;
const supabaseServiceKey = raw.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = raw.SUPABASE_ANON_KEY ?? raw.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!supabaseAnonKey) {
  console.error('Missing SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY).');
  process.exit(1);
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  supabaseUrl,
  supabaseServiceKey,
  supabaseAnonKey,
  /** @deprecated use supabaseServiceKey */
  supabaseKey: supabaseServiceKey,
  vapidPublicKey: raw.VAPID_PUBLIC_KEY,
  vapidPrivateKey: raw.VAPID_PRIVATE_KEY,
  vapidSubject: raw.VAPID_SUBJECT,
  allowedOrigins: raw.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  cronSecret: raw.CRON_SECRET,
  isProd: raw.NODE_ENV === 'production',
};

export function requireVapidConfig() {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    throw new Error(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required to send push reminders.'
    );
  }
  return {
    publicKey: env.vapidPublicKey,
    privateKey: env.vapidPrivateKey,
    subject: env.vapidSubject,
  };
}
