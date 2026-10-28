# Kinlist — Shared Shopping List (PWA)

A shopping list you and your household edit live, from separate phones.
Talks to the [shopping-list-api](https://github.com/mateador/shopping-list-api) backend — this app
has no local database of its own; the server is the source of truth.

## Run locally

You need the backend running first (see `shopping-list-api`'s README).

```bash
npm install
cp .env.example .env      # defaults to http://localhost:8000, fine for local dev
npm run dev -- --host     # --host so you can also open it from your phone
```

First run: tap "Create a shared list" on one phone, it gives you a 6-character
code. On the second phone, tap "Join an existing list" and enter that code.
From then on both phones stay synced live via WebSocket.

## Deploy

**1. Deploy the backend first** (see its README) — you'll need its live URL.

**2. Push this folder to GitHub, then deploy to Netlify:**
```bash 
git init && git add . && git commit -m "Initial commit"
gh repo create together-shopping-list --public --source=. --remote=origin --push
```
At [netlify.com](https://www.netlify.com): import this repo. Before the first
deploy, add a build environment variable:
- `VITE_API_URL` = your Render backend URL (e.g. `https://shopping-list-api.onrender.com`)

Netlify reads `netlify.toml` for the build command automatically.

**3. Lock down CORS.** Once you have your Netlify URL, go back to the
backend's Render dashboard and set `ALLOWED_ORIGINS` to that exact URL
instead of `*`.

## How the pieces fit Kinlist

- **Onboarding** (`src/main.js`): create-or-join flow, stores the household
  code and your display name in `localStorage` (device-local, never synced —
  it's just "how do I identify myself when I add an item").
- **`src/api.js`**: all REST calls, plus `connectLive()` — opens a WebSocket
  to the backend, and if it can't connect or drops, automatically falls back
  to polling every 4 seconds so the app degrades gracefully instead of going
  silent (useful on networks that block WebSocket, like some corporate wifi).
- **Status pill** in the header shows Live / Reconnecting / Syncing so you
  always know whether what you're looking at is current.

## A thing to know about Render's free tier

If the backend hasn't been hit in the last 15 minutes, the very first
request after that (whoever opens the app first) will take 30-50 seconds to
get a response while Render wakes the service back up. Everything after that
is instant. Worth knowing so it doesn't look broken the first time.

## Push notifications

The API sends the pushes through OneSignal; this app only registers the device
and tags it with the household code and display name (`src/push.js`). To turn
it on, set `VITE_ONESIGNAL_APP_ID` (locally in `.env`, and as a Netlify build
variable) and redeploy. The OneSignal app must use the *Custom Code* web setup,
and its worker lives at `public/push/onesignal/` so it doesn't clash with the
PWA's own service worker. Each person taps "Notify me when someone adds an
item" once to allow notifications.

