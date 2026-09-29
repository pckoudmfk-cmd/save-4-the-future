# SAVE 4 THE FUTURE — AI DIGITAL POSTER CHALLENGE

A web app for the Moscow Financial College digital poster competition on World Savings Day.
It is a plain website (no VK Mini App integration) — anyone opens it by a link, in any browser.

## Roles

- **Participant** — no account. Opens the site, fills in the submission form, uploads a poster
  image. Identified only by the name/group/contact fields they type in.
- **Jury** (5–6 named accounts) — logs in with a personal username and password. Sees every
  published poster anonymously (no author, group or contact) and scores it on five 0–20
  criteria. One juror can never see another juror's score, and participants never see any
  jury scores individually — only the published aggregate.
- **Organizer / admin** (your account) — logs in the same way, with the `organizer` role.
  Sees every submission including author/contact, moves it through moderation
  (publish / send back for rework / reject / mark as winner), and creates jury accounts.

Jury and admin sign in through two unlisted links (not shown in the public navigation):
`?view=jury` and `?view=admin` appended to the site URL. Share those links only with the
people who need them.

## Implemented

- public submission form (text fields + poster image upload, up to 10 MB, PNG/JPEG/WEBP)
- exhibition, results and poster-detail pages reading live data from the backend
- named login for jury and organizer accounts (no VK dependency)
- anonymous jury scoring, one score per juror per poster, never exposed to other jurors
- admin panel: moderation (publish/rework/reject/winner) and jury/admin account creation
- public results page showing the jury average per poster (never individual scores)

## Architecture

- **Frontend**: static site (React + VKUI for the interface). Deploy anywhere that serves
  static files — GitHub Pages, your own hosting, or any static-site host.
- **API**: plain Node.js/Express server (`server/`), no serverless platform dependency.
- **Database**: SQLite, a single file (`server/data/db.sqlite3`, created automatically).
- **Poster files**: stored as plain files on the same server's disk (`server/data/uploads/`).
- **Accounts/sessions**: username + password (PBKDF2-hashed) with a signed, httpOnly session
  cookie issued by the API. No third-party login is required.

This stack deliberately avoids Cloudflare, Vercel, or any other platform whose own
domains may be unreachable without a VPN from some networks. Everything the API needs —
the database and the uploaded files — lives in one process on one ordinary server, so the
only thing that has to be reachable is that server's own domain, wherever you host it
(a VPS from any provider works, including Russian ones such as Timeweb Cloud, REG.RU,
Beget or Selectel).

Never commit real secrets. `SESSION_SECRET` and `SETUP_KEY` live in `server/.env`
(copied from `server/.env.example` and filled in on the server itself), which is
excluded from git by `.gitignore`.

## Run locally

```
npm install
npm run dev
```

Without `VITE_API_URL` set, the app runs in local demo mode (data lives only in your
browser's localStorage) — useful for previewing the interface, not for a real competition.

## Build

```
npm run build
```

## Deploy the backend (plain Node.js on a VPS)

These steps assume an ordinary Linux VPS (Ubuntu/Debian) with root or sudo access, and a
domain (or subdomain, e.g. `api.your-domain.example`) already pointed at the server's IP
address through your registrar's DNS settings.

1. Install Node.js 18+ and nginx on the server, if not already present, e.g.
   `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -` then `sudo apt install -y nodejs nginx`.
2. Copy the `server/` folder to the server, e.g. to `/opt/save-the-future/server`
   (via `git clone`, `scp`, or `rsync` — any way of getting the files there works).
3. `cd /opt/save-the-future/server && npm install --omit=dev`
4. `cp .env.example .env`, then edit `.env`:
   - `SESSION_SECRET`: generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   - `SETUP_KEY`: any long random value, used once then can be forgotten.
   - `ALLOWED_ORIGIN`: your frontend's URL(s), comma-separated, e.g.
     `https://edcafeteacher-art.github.io` or your own domain once the frontend is there too.
5. Install the systemd service so the API restarts automatically:
   `sudo cp deploy/save-the-future.service /etc/systemd/system/`, adjust the
   `WorkingDirectory` path inside it if you used a different folder, then
   `sudo systemctl daemon-reload && sudo systemctl enable --now save-the-future`.
6. Install the nginx reverse proxy: `sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/save-the-future-api`,
   edit `server_name` to your real domain, then
   `sudo ln -s /etc/nginx/sites-available/save-the-future-api /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`.
7. Get a free TLS certificate so the API answers on `https://`:
   `sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d api.your-domain.example`.
8. Confirm it's alive: `curl https://api.your-domain.example/health` should return
   `{"ok":true,...}`.
9. Create the first organizer (admin) account — call this once, from your own machine:
   ```
   curl -X POST https://api.your-domain.example/api/setup \
     -H "x-setup-key: <SETUP_KEY you set in .env>" \
     -H "content-type: application/json" \
     -d '{"username":"admin","password":"<choose a strong password>"}'
   ```
   This endpoint refuses to run again once any account exists.
10. Log in at `<frontend-url>/?view=admin` with that account, and create jury accounts from
    the admin panel (5 or 6, one per juror).

The SQLite database and uploaded poster images live under `server/data/`, created
automatically on first run. Back that folder up before making any risky change (a copy of
the file is the entire backup, no export step needed).

## Deploy the frontend

1. Set `VITE_API_URL` to your deployed API's URL (e.g. `https://api.your-domain.example`).
2. If deploying to a domain root (your own domain, not a `/repo-name/` subpath) also set
   `VITE_BASE=/`. Leave it unset for GitHub Pages, where the default `/save-the-future/`
   matches the included GitHub Actions workflow (`.github/workflows/deploy.yml`).
3. `npm run build`, then deploy the `dist/` folder to wherever the frontend will live. For
   the included GitHub Pages workflow, add `VITE_API_URL` as a repository secret
   (Settings → Secrets and variables → Actions) instead — it's read automatically on every
   push to `main`.

## Before opening the competition

Run one full submission → moderation → jury login → scoring → results pass end to end with
test data, using a real jury account, before sharing the public link with participants.

## Design master

The approved cover composition (`design-master/approved-cover.html`) is the visual master.
Future changes should extend the system without replacing that composition or altering the
competition mechanics (five criteria, anonymous jury, separate audience reaction).
