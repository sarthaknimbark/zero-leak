# Zero Leak Server

Express + TypeScript API for the Zero Leak finance app. Uses the **existing** Supabase Postgres project (Auth, RLS, RPCs). It does **not** reset or migrate data.

## Architecture

```
Client / API consumers
        │
        ▼
  zero-leak-server (/api/*)
        │
        ├── createUserClient(JWT) → RLS-scoped queries + RPCs
        └── supabaseAdmin (service role) → auth, reminders, admin delete
        │
        ▼
   Supabase Postgres (existing tables)
```

The Vercel frontend may still talk to Supabase directly. This server is a full REST companion matching the same tables and RPCs.

## Setup

```bash
cd server
cp .env.example .env
# Fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
# (anon may also be VITE_SUPABASE_ANON_KEY)
# Optional: VAPID_* for push reminders, CRON_SECRET for cron endpoint
npm install
npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | HTTP server with reload |
| `npm start` | HTTP server |
| `npm run typecheck` | TypeScript check |
| `npm run reminders` | One-shot reminder scan |
| `npm run reminders:watch` | Reminder scan every 15 minutes |

## Auth

Protected routes require:

```http
Authorization: Bearer <supabase_access_token>
```

## Endpoints

### System

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | — | Health check |
| POST | `/internal/send-reminders` | `x-cron-secret` | Bill push + notifications |

### Auth (`/api/auth`)

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/api/auth/signup` | — | `{ email, password, full_name }` |
| POST | `/api/auth/login` | — | `{ email, password }` → `{ user, profile, session }` |
| POST | `/api/auth/logout` | yes | |
| GET | `/api/auth/me` | yes | `{ user, profile, session }` |

### Profile

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/profile` | Current profile |
| PATCH | `/api/profile` | `full_name`, `avatar_url`, `pin_enabled`, `push_subscription` |
| POST | `/api/profile/avatar` | `{ avatar_url }` |

### Accounts / Categories

| Method | Path |
|--------|------|
| GET/POST | `/api/accounts` |
| GET/PATCH/DELETE | `/api/accounts/:id` |
| GET | `/api/categories?type=income\|expense` |
| POST | `/api/categories` |
| PATCH/DELETE | `/api/categories/:id` |

### Transactions (RPCs)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/transactions` | Filters: `type`, `account_id`, `category_id`, `date_from`, `date_to`, `min_amount`, `max_amount`, `search`, `sort` |
| POST | `/api/transactions` | `apply_transaction` |
| PATCH | `/api/transactions/:id` | `update_transaction` |
| DELETE | `/api/transactions/:id` | `delete_transaction` |

### Transfers (RPCs)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/transfers` | |
| POST | `/api/transfers` | `apply_transfer` |
| PATCH | `/api/transfers/:id` | `update_transfer` |
| DELETE | `/api/transfers/:id` | `delete_transfer` |

### Bills

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/bills` | Also runs `update_overdue_bills` |
| POST | `/api/bills` | |
| PATCH/DELETE | `/api/bills/:id` | |
| POST | `/api/bills/:id/pay` | `{ account_id, ... }` → expense + mark paid |
| POST | `/api/bills/sync-overdue` | `update_overdue_bills` |

### Saving goals

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/saving-goals` | |
| PATCH/DELETE | `/api/saving-goals/:id` | |
| POST | `/api/saving-goals/:id/deposit` | `{ account_id, amount }` |
| POST | `/api/saving-goals/:id/withdraw` | `{ account_id, amount }` |

### Debts

| Method | Path |
|--------|------|
| GET/POST | `/api/debts` |
| PATCH/DELETE | `/api/debts/:id` |
| PATCH | `/api/debts/:id/status` | `{ status: "pending"\|"settled" }` |

### Notifications

| Method | Path |
|--------|------|
| GET | `/api/notifications` |
| PATCH | `/api/notifications/mark-all-read` |
| PATCH | `/api/notifications/:id/read` |
| DELETE | `/api/notifications/:id` |

### Admin (requires `profile.is_admin`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/stats` | `admin_stats` RPC |
| GET | `/api/admin/users?search=` | |
| PATCH | `/api/admin/users/:id/disabled` | `{ disabled }` |
| DELETE | `/api/admin/users/:id` | Service-role auth delete |

### Dashboard

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/dashboard` | Aggregated balances + recent activity |

## Environment

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` | yes* | Same project as frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only |
| `SUPABASE_ANON_KEY` | yes* | For RLS user clients |
| `VAPID_PUBLIC_KEY` | for reminders | Must match client push hook |
| `VAPID_PRIVATE_KEY` | for reminders | Server-only |
| `CRON_SECRET` | optional | Min 8 chars if set; protects reminder endpoint |
| `ALLOWED_ORIGINS` | yes | Comma-separated origins |
| `PORT` | no | Default `3001` |

\* Fallbacks: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## Cron (production)

```http
POST https://YOUR_SERVER_URL/internal/send-reminders
x-cron-secret: YOUR_CRON_SECRET
```

## Safety

- Does not delete or reset Postgres data
- User routes use the caller JWT so RLS applies
- Service role is limited to auth, reminders, and admin user delete
