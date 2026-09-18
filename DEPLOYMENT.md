# Zero Leak — Deployment Guide

This guide matches your **existing** production setup:

| Piece | Where it already lives |
|--------|-------------------------|
| Frontend | **Vercel** (Vite SPA) |
| Database / Auth | **Supabase** (same project, same data) |
| Bill reminders | **Server cron** → `POST /internal/send-reminders` |
| New API | **Railway / Render / Fly** (Express in `server/`) |

```
Browser
   │
   ├─► Vercel (client/) ──auth/session──► Supabase Auth
   │         │
   │         └─(optional VITE_API_URL)─► Express server ──► Supabase Postgres
   │
   └─(if VITE_API_URL unset)─────────────► Supabase PostgREST / RPCs (current live behavior)
```

**Do not reset Supabase.** Keep the same project URL and keys.

---

## 1. Safe rollout (recommended)

Keep production working exactly as today, then turn on the API when ready.

### Phase A — Frontend only (no backend required)

1. Keep Vercel env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Do not set** `VITE_API_URL` yet.
3. App continues: **Vercel → Supabase → existing DB**.

### Phase B — Deploy API, still optional for users

1. Deploy `server/` (section 3).
2. Confirm `GET https://YOUR_API/health` returns `{ ok: true }`.
3. Still leave `VITE_API_URL` unset on Vercel until you are ready.

### Phase C — Point frontend at API

1. Add Vercel env: `VITE_API_URL=https://YOUR_API_URL` (no trailing slash).
2. Redeploy Vercel (Vite bakes env at build time).
3. Flow becomes: **Vercel → Express → Supabase**.

You can roll back Phase C anytime by removing `VITE_API_URL` and redeploying.

---

## 2. Frontend on Vercel (existing)

After the monorepo move, the app lives under `client/`.

### Vercel project settings

| Setting | Value |
|---------|--------|
| Framework Preset | Vite |
| **Root Directory** | `client` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

SPA rewrites are already in `client/vercel.json`.

### Environment variables (Vercel → Settings → Environment Variables)

| Name | Required | Notes |
|------|----------|--------|
| `VITE_SUPABASE_URL` | yes | Same Supabase project as now |
| `VITE_SUPABASE_ANON_KEY` | yes | Anon/public key only |
| `VITE_API_URL` | Phase C only | e.g. `https://zero-leak-api.up.railway.app` |

Never put `SUPABASE_SERVICE_ROLE_KEY` or VAPID private keys on Vercel.

### Redeploy

- Push to the branch Vercel tracks, or
- Vercel Dashboard → Deployments → Redeploy

After changing any `VITE_*` var, you **must** redeploy (they are compile-time).

### Supabase Auth (existing)

In Supabase → Authentication → URL configuration, keep/add:

- Site URL: your Vercel URL (e.g. `https://your-app.vercel.app`)
- Redirect URLs: `https://your-app.vercel.app/**` and `http://localhost:5173/**`

---

## 3. Backend API (new)

Deploy the `server/` folder as a separate Node service. It uses the **same** Supabase project.

### Recommended hosts

Railway, Render, or Fly.io all work. Steps below use **Railway** as the example (Render is nearly identical).

### Railway

1. New Project → Deploy from GitHub → `sarthaknimbark/zero-leak`
2. Set **Root Directory** to `server`
3. Start command: `npm start`
4. Install: `npm install`
5. Add a public HTTP domain

### Server environment variables

| Name | Required | Notes |
|------|----------|--------|
| `SUPABASE_URL` | yes | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | yes | Same as `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase → Settings → API → `service_role` (server only) |
| `ALLOWED_ORIGINS` | yes | `https://your-app.vercel.app,http://localhost:5173` |
| `CRON_SECRET` | recommended | Long random string for reminder endpoint |
| `NODE_ENV` | yes | `production` |
| `PORT` | usually auto | Host often injects `PORT`; app already reads it |
| `VAPID_PUBLIC_KEY` | for push | Must match `client/src/hooks/usePushNotifications.ts` |
| `VAPID_PRIVATE_KEY` | for push | Server only |
| `VAPID_SUBJECT` | optional | default `mailto:support@zeroleak.app` |

### Smoke tests

```bash
curl https://YOUR_API_URL/health
# → {"ok":true,"service":"zero-leak-server",...}
```

From a logged-in browser session (or with a real access token):

```bash
curl https://YOUR_API_URL/api/accounts -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### CORS

`ALLOWED_ORIGINS` must include every Vercel URL you use (production + preview if needed):

```
https://your-app.vercel.app,https://your-app-git-main-xxxx.vercel.app,http://localhost:5173
```

---

## 4. Database (existing Supabase)

Nothing to redeploy.

- Keep the current Supabase project.
- Do **not** run destructive migrations or reset.
- RLS + RPCs (`apply_transaction`, etc.) stay as-is.
- Service role key is only for the server / reminder jobs.

---

## 5. Bill reminders (server cron)

Reminders run on the deployed API — not GitHub Actions.

### Endpoint

```http
POST https://YOUR_API_URL/internal/send-reminders
x-cron-secret: YOUR_CRON_SECRET
```

### Schedule (every 15 minutes)

Use one of:

- **Railway / Render cron** hitting the URL above
- **cron-job.org** (or similar) with header `x-cron-secret`
- Local/dev: `cd server && npm run reminders:watch`

Required server env:

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Protects the endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Read bills / write notifications |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push (public key must match client) |

---

## 6. Checklist before going to Phase C

- [ ] Vercel Root Directory = `client`
- [ ] Vercel has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] Server deployed; `/health` OK
- [ ] Server has service role + anon keys for **same** Supabase project
- [ ] `ALLOWED_ORIGINS` includes production Vercel URL
- [ ] Local test with `VITE_API_URL=http://localhost:3001` works
- [ ] Then set `VITE_API_URL` on Vercel and redeploy
- [ ] Login, dashboard, create account/transaction still work
- [ ] Supabase Table Editor still shows existing data

---

## 7. Local full stack (matches production)

**Terminal 1 — API**

```bash
cd server
cp .env.example .env   # fill real values
npm install
npm run dev            # http://localhost:3001
```

**Terminal 2 — Frontend**

```bash
cd client
# .env:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
# VITE_API_URL=http://localhost:3001
npm install
npm run dev            # http://localhost:5173
```

---

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Vercel 404 on refresh | Confirm `client/vercel.json` rewrites and Root Directory is `client` |
| Blank env / wrong API | Redeploy after changing `VITE_*` |
| CORS errors to API | Add exact Vercel origin to `ALLOWED_ORIGINS` |
| 401 on `/api/*` | User must be logged in; send `Authorization: Bearer <access_token>` |
| Reminders fail | Need real `SUPABASE_SERVICE_ROLE_KEY` + matching VAPID keys |
| Data “missing” | Wrong Supabase project URL/keys — use the same project as production |

---

## 9. What not to do

- Do not put service role or VAPID private key in the client or Vercel
- Do not create a second Supabase project for “backend”
- Do not wipe / reseed production tables
- Do not change Vercel Root Directory away from `client` after the monorepo move without updating paths
