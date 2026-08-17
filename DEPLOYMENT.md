# Deploying The Card Room

Written for someone who is not a developer. Follow it in order.

There are **two** pieces, and they live in different places:

| Piece | What it is | Where it goes |
|---|---|---|
| **Frontend** | What players see in their browser | Netlify (free) |
| **Backend** | The game server that deals cards and keeps score | Render or Railway (free tier) |

The frontend cannot work on its own. It has to know the backend's address.

---

## Before you start

You need:

- a **GitHub** account
- a **Netlify** account
- a **Render** account (or Railway — either works)

All three are free at this size. Ten players will not come close to any limit.

---

## Step 1 — Put the code on GitHub

1. Go to github.com and create a new repository. Name it `cardroom`. Keep it **Private**.
2. GitHub will show you a page of commands. Ignore it.
3. On your computer, open a terminal in the project folder and run:

```bash
git init
git add .
git commit -m "The Card Room"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/cardroom.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

---

## Step 2 — Deploy the backend first

**Do the backend before the frontend.** The frontend needs the backend's
address, so if you do it the other way round you will have to come back and
redo a step.

1. Go to **render.com** → **New** → **Web Service**.
2. Connect your GitHub account and pick the `cardroom` repository.
3. Fill in these settings exactly:

   | Field | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |

4. Scroll to **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `ALLOWED_ORIGINS` | leave blank for now — you fill this in at Step 4 |
   | `METERED_DOMAIN` | optional: your Metered app domain, e.g. `your-app.metered.live` |
   | `METERED_SECRET_KEY` | optional: Metered account Secret Key — backend only |


> **Voice/TURN security.** `METERED_SECRET_KEY` belongs only on the Render
> backend. Never create a `VITE_*` copy of it and never commit it. When these
> two Metered variables are configured, the server requests short-lived TURN
> credentials for voice calls; website, Android APK and iPhone Safari all
> receive only the temporary ICE configuration. If Metered is unset or
> unavailable, voice still attempts direct/STUN connectivity.

5. Click **Create Web Service** and wait for it to finish.

6. Render gives you an address like `https://cardroom-server.onrender.com`.
   **Copy it.** You need it in the next step.

7. Check it works: open that address with `/health` on the end, e.g.
   `https://cardroom-server.onrender.com/health`. You should see
   `{"ok":true,"service":"haazari-server"}`.

> **A note about the free tier.** Render puts free services to sleep after
> about 15 minutes with no traffic. The first person to open the game after a
> quiet spell will wait roughly 30 seconds for it to wake up. Everyone joining
> after that is instant. If that bothers you, Render's cheapest paid tier
> removes it.

---

## Step 3 — Deploy the frontend

1. Go to **netlify.com** → **Add new site** → **Import an existing project**.
2. Choose GitHub and pick the `cardroom` repository.
3. Netlify should read the settings automatically from `netlify.toml`.
   Confirm they say:

   | Field | Value |
   |---|---|
   | Base directory | `client` |
   | Build command | `npm run build` |
   | Publish directory | `dist` |

4. Before deploying, click **Add environment variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_SERVER_URL` | the Render address you copied in Step 2 |

   No trailing slash. It should look like
   `https://cardroom-server.onrender.com`.

5. Click **Deploy**.

> **If you forget this variable**, the app will now tell you so on screen
> instead of hanging on "Connecting…" forever. That was a real bug in the
> previous version and it is fixed — but the fix reports the problem, it does
> not solve it for you. You still have to set the variable.

---

## Step 4 — Let the two halves talk to each other

The backend refuses connections from unknown websites. Right now it does not
know about your Netlify site, so you have to tell it.

1. Copy your Netlify address, e.g. `https://cardroom.netlify.app`.
2. Go back to Render → your service → **Environment**.
3. Set `ALLOWED_ORIGINS` to that address.
4. Save. Render restarts automatically.

If you later add a staging site, list both, separated by a comma and no space:

```
https://cardroom.netlify.app,https://cardroom-staging.netlify.app
```

**Android test APK:** the Capacitor build serves its bundled frontend from the
secure local origin `https://localhost`. The staging backend must therefore
allow that origin too, while keeping the Netlify origin. For example:

```
https://cardroom-staging.netlify.app,https://localhost
```

Do not add a wildcard just to make the APK connect. Keep the explicit allow-list.
See `ANDROID_RELEASE.md` for the native build/test procedure.

---

## Step 5 — Check it actually works

Open your Netlify address on your phone. Then run through the staging
checklist in `STAGING-CHECKLIST.md`. Do not skip it — it is written to catch
exactly the things that break in real use.

---

## After this: how updates work

Once set up, you never repeat any of the above. The flow is:

```
you change the code
        ↓
    git push
        ↓
      GitHub
        ↓
   Netlify rebuilds the frontend automatically
   Render rebuilds the backend automatically
```

Both take a couple of minutes. Players just refresh.

---

## Setting up a staging site

Worth doing before you replace anything your family is currently using.

1. In Netlify, **Add new site** from the same repository.
2. Set it to deploy from a branch called `staging` instead of `main`.
3. Give it its own `VITE_SERVER_URL` — ideally a second Render service, so
   testing never disturbs a live game.
4. Add the staging address to `ALLOWED_ORIGINS` on whichever backend it uses.

Then test there first, and only move to the real site when the checklist
passes.

---

## When something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| "This build is missing its server address" | `VITE_SERVER_URL` was not set on Netlify | Add it, then **Trigger deploy → Clear cache and deploy** |
| "This build points at localhost" | `VITE_SERVER_URL` was set to a localhost address | Set it to the Render address instead |
| Stuck on "Connecting…" | Backend asleep, or origin not allowed | Wait 30s; if it persists, check `ALLOWED_ORIGINS` matches your Netlify address exactly |
| Server crashes on start with "ALLOWED_ORIGINS is not set" | Exactly what it says | Set it in Render's environment variables |
| Old version keeps appearing | Cached build | Netlify → **Trigger deploy → Clear cache and deploy site** |

A note on environment variables in Vite: they are baked in **at build time**,
not read when the page loads. Changing `VITE_SERVER_URL` therefore requires a
**redeploy**, not just a refresh. This catches people out constantly.
