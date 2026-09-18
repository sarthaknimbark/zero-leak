# Zero Leak

Personal finance app monorepo.

## Structure

| Path | Role |
|------|------|
| `client/` | Vite + React frontend (Vercel) |
| `server/` | Express API (auth, CRUD, admin, reminders) |
| Existing DB | Supabase Postgres (unchanged data) |

**GitHub:** https://github.com/sarthaknimbark/zero-leak.git

> The git repo lives at the **workspace root** (`zero-leak/`), not inside `client/`, so Cursor/GitHub detect this folder correctly.

## Architecture

```
Vercel (client) → Express API (server) → Supabase Postgres
                 ↘ optional direct Supabase if VITE_API_URL unset
```

- Set `VITE_API_URL` on the client to route data through the secured backend.
- Without `VITE_API_URL`, the client keeps talking to Supabase directly (current production behavior).

## Quick start

### Client

```bash
cd client
cp .env.example .env   # or use existing .env
npm install
npm run dev
```

### Server

```bash
cd server
cp .env.example .env
# Fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, ALLOWED_ORIGINS
npm install
npm run dev
```

Then set in `client/.env`:

```
VITE_API_URL=http://localhost:3001
```

## Docs

- Server API: `server/README.md`
