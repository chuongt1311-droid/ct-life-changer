# memory-api/DEPLOY.md

## Prerequisites
- A subdomain (e.g. `memory.yourdomain.com`) with an A record pointing at
  the VPS's IP — Caddy needs this to issue a Let's Encrypt certificate.
- Docker and Docker Compose installed on the VPS.

## First deploy

1. Copy this directory to the VPS (e.g. `git clone` the whole repo there,
   or `rsync` just `memory-api/`).
2. Edit `Caddyfile`, replacing `memory.yourdomain.com` with your real subdomain.
3. Create `memory-api/.env` (never committed) from `.env.example`:
   - `MEMORY_API_TOKEN`: generate with `openssl rand -hex 32`.
   - `FALKORDB_PASSWORD`: generate the same way.
4. `cd memory-api && docker compose up -d --build`
5. Confirm it's up: `curl https://memory.yourdomain.com/health` → `{"ok":true}`

## Add the same two values to Vercel

Settings → Environment Variables on the Next.js app project:
- `MEMORY_API_URL=https://memory.yourdomain.com`
- `MEMORY_API_TOKEN=<the same value from step 3>`

## Updating

```bash
cd memory-api && git pull && docker compose up -d --build
```

## Importing a graphify graph

From your own machine, once FalkorDB's port is reachable (via an SSH
tunnel — `ssh -L 6379:localhost:6379 <vps>` — since it's never exposed
publicly):

```bash
graphify <path> --falkordb-push falkordb://:<FALKORDB_PASSWORD>@localhost:6379
```
