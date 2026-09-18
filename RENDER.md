# Deploy backend on Render (+ smooth Vercel reconnect)

Your frontend stays on **Vercel**. Backend goes on **Render**. Same Supabase project.

I can’t log into your Render account from here — use the steps below (≈10 minutes).

---

## 0. Push code to GitHub first

Render deploys from GitHub. Your monorepo + server changes must be on `main`.

If you haven’t committed/pushed yet, tell me **“commit and push”** and I’ll do it.

---

## 1. Create the Render Web Service

1. Open [https://dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect repo: `sarthaknimbark/zero-leak`
3. Settings:

| Field | Value |
|--------|--------|
| Name | `zero-leak-api` |
| Region | closest to you |
| **Root Directory** | `server` |
| Runtime | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| Instance | Free (or Starter) |

4. Health check path: `/health`

---

## 2. Environment variables (Render → Environment)

Use the **same Supabase project** as the Vercel app (`ddenkvezcqmfvdybxgxc`).

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | `https://ddenkvezcqmfvdybxgxc.supabase.co` |
| `SUPABASE_ANON_KEY` | same as Vercel `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (secret) |
| `ALLOWED_ORIGINS` | `https://YOUR-VERCEL-APP.vercel.app,http://localhost:5173` |
| `CRON_SECRET` | long random string (Render can generate) |
| `VAPID_PUBLIC_KEY` | `BLRDmTUkWXSM5WwcP6xyjfYPmL-sHIJO1LfeEQxBbOt3TKsF11JTpH14UZDpOxlZR4FozkRxUW3vs0xPFdDUunQ` |
| `VAPID_PRIVATE_KEY` | your matching private key (from local reminders setup) |
| `VAPID_SUBJECT` | `mailto:support@zeroleak.app` |

Do **not** put `SUPABASE_SERVICE_ROLE_KEY` on Vercel.

Click **Deploy Web Service**.

---

## 3. Verify API is live

After deploy, open:

```
https://YOUR-RENDER-URL.onrender.com/health
```

Expect:

```json
{ "ok": true, "service": "zero-leak-server", ... }
```

---

## 4. Point Vercel frontend at Render (smooth switch)

1. Vercel → Project → **Settings** → **Environment Variables**
2. Add:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://YOUR-RENDER-URL.onrender.com` (no trailing slash) |

3. Confirm Root Directory is still `client`
4. **Deployments → Redeploy** (required — Vite embeds env at build time)

Until you set `VITE_API_URL`, production keeps using Supabase directly (safe).

---

## 5. Optional: bill reminders cron on Render

Render Cron Job (or cron-job.org):

```http
POST https://YOUR-RENDER-URL.onrender.com/internal/send-reminders
Header: x-cron-secret: <same as CRON_SECRET>
```

Every 15 minutes.

---

## 6. Free-tier note

Render free web services **sleep after idle**. First request can take ~30–60s. For always-on, use a paid instance.

---

## Checklist

- [ ] Code pushed to GitHub `main`
- [ ] Render Root Directory = `server`
- [ ] Build/start commands as above
- [ ] Env vars set (same Supabase project)
- [ ] `/health` returns ok
- [ ] `ALLOWED_ORIGINS` includes your real Vercel URL
- [ ] Vercel `VITE_API_URL` set + redeployed
- [ ] Login + dashboard still work

---

## After you deploy

Reply with your Render URL (e.g. `https://zero-leak-api.onrender.com`) and your Vercel URL if you want me to double-check CORS/`VITE_API_URL` wording.
