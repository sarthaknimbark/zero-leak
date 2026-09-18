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
Vercel / Vite (client) ──Bearer JWT──► Express API (server) ──► Supabase Postgres
        │
        └── Supabase Auth only (login session tokens)
```

Frontend **requires** `VITE_API_URL`. Run backend and frontend together.

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

- [Render backend deploy](./RENDER.md) — step-by-step for Render + Vercel reconnect
- [Full deployment guide](./DEPLOYMENT.md) — Vercel + Supabase + API
- Server API reference: `server/README.md`
