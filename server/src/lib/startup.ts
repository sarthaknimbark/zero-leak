import { supabaseAdmin } from '../lib/supabase.js';
import { env } from '../config/env.js';

export type StartupStatus = {
  server: 'ok';
  database: 'connected' | 'error';
  databaseMessage?: string;
  supabaseHost: string;
};

function supabaseHost(): string {
  try {
    return new URL(env.supabaseUrl).host;
  } catch {
    return env.supabaseUrl;
  }
}

/** Lightweight connectivity check against existing Supabase Postgres (via PostgREST). */
export async function checkDatabaseConnection(): Promise<StartupStatus> {
  const host = supabaseHost();
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {
      return {
        server: 'ok',
        database: 'error',
        databaseMessage: error.message,
        supabaseHost: host,
      };
    }
    return {
      server: 'ok',
      database: 'connected',
      supabaseHost: host,
    };
  } catch (err) {
    return {
      server: 'ok',
      database: 'error',
      databaseMessage: err instanceof Error ? err.message : String(err),
      supabaseHost: host,
    };
  }
}

export function printStartupBanner(status: StartupStatus, port: number) {
  const line = '─'.repeat(48);
  const dbOk = status.database === 'connected';
  const dbLine = dbOk
    ? `  Database     ✓ connected  (${status.supabaseHost})`
    : `  Database     ✗ error      (${status.databaseMessage ?? 'unknown'})`;

  console.log(`\n${line}`);
  console.log('  Zero Leak API');
  console.log(line);
  console.log(`  Server       ✓ connected  (http://0.0.0.0:${port})`);
  console.log(dbLine);
  console.log(`  Environment  ${env.nodeEnv}`);
  console.log(`  CORS         ${env.allowedOrigins.join(', ')}`);
  console.log(`  Health       GET /health`);
  console.log(`${line}\n`);

  if (!dbOk) {
    console.warn(
      'Warning: API is up but database check failed. Fix SUPABASE_URL / SERVICE_ROLE_KEY.\n'
    );
  }
}
