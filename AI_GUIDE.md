# AI Developer Guide — SecScan

This file is written for AI assistants (Claude, GPT, Gemini, etc.) picking up this codebase.
Read this before touching anything. It explains the full architecture, conventions, and gotchas.

---

## What This Project Is

**SecScan** is a production-ready Micro-SaaS platform for website security auditing.
Users enter a domain → receive a security report scored 0–100 → can export PDF on paid tiers.

It runs on a **Ubuntu VPS** using **Docker Compose** with 8 services.

---

## Project Structure

```
securityscan/
├── frontend/              # Next.js 14 app (TypeScript, TailwindCSS, Framer Motion)
├── backend/               # Node.js/Express API (ESM, port 4000)
│   └── src/
│       ├── index.js       # App entrypoint — mounts all routers
│       ├── worker.js      # BullMQ worker — runs as a SEPARATE process
│       ├── routes/        # auth, scan, user, subscription, admin
│       ├── middleware/    # auth.js (JWT), rateLimit.js, errorHandler.js
│       ├── models/db.js   # pg Pool + schema init (runs on startup)
│       └── queue/         # scanQueue.js — BullMQ job definitions
├── scanner/               # Python FastAPI microservice (port 8000)
│   ├── main.py            # FastAPI app — POST /scan, GET /health
│   ├── scanner.py         # Orchestrator — calls all modules, computes score
│   └── modules/           # 9 independent scanner modules (see below)
├── nginx/nginx.conf       # Reverse proxy + TLS + rate limiting
├── docker-compose.yml     # 8 services: postgres, redis, scanner, backend,
│                          # backend-worker, frontend, nginx, certbot
├── Makefile               # Dev shortcuts (make up/down/logs/deploy/db-shell…)
├── DEPLOY.md              # Step-by-step production deployment guide
├── .env.example           # All required environment variables documented
└── AI_GUIDE.md            # This file
```

---

## Service Map

| Service          | Technology         | Port (internal) | Role                                      |
|------------------|--------------------|-----------------|-------------------------------------------|
| `postgres`       | PostgreSQL 16      | 5432            | Primary database                          |
| `redis`          | Redis 7            | 6379            | BullMQ job queue + caching                |
| `scanner`        | Python FastAPI     | 8000            | Runs security checks, returns JSON        |
| `backend`        | Node.js Express    | 4000            | REST API, auth, DB writes                 |
| `backend-worker` | Node.js (worker.js)| —               | BullMQ consumer — calls scanner, saves results |
| `frontend`       | Next.js 14         | 3000            | React UI                                  |
| `nginx`          | Nginx Alpine       | 80, 443         | Reverse proxy, TLS termination            |
| `certbot`        | Certbot            | —               | Auto-renews Let's Encrypt SSL certs       |

All services share the `internal` Docker network. Only nginx is exposed externally.

---

## Scan Flow (end-to-end)

```
User submits domain (frontend)
  → POST /api/scan (backend)
    → Validates input + user consent
    → Creates scan record in DB (status: queued)
    → Enqueues job in BullMQ via Redis
      → backend-worker picks up job
        → Calls POST http://scanner:8000/scan
          → scanner.py runs all 9 modules in parallel
          → Returns JSON: { score, findings[], modules{} }
        → backend-worker saves results to DB (status: complete)
  → Frontend polls GET /api/scan/:id
    → Renders report dashboard with score gauge, finding cards, charts
```

---

## Scanner Modules (`scanner/modules/`)

Each module is **independent**, **passive/non-intrusive**, and returns a standardised dict:

```python
{
  "module": "module_name",
  "status": "ok" | "warning" | "critical" | "info" | "error",
  "findings": [
    { "severity": "critical|warning|info", "title": "...", "description": "...", "recommendation": "..." }
  ],
  "score_impact": -15  # negative number
}
```

| Module                  | What it checks                                      |
|-------------------------|-----------------------------------------------------|
| `ssl_scanner`           | TLS cert validity, cipher strength, expiry          |
| `headers_scanner`       | CSP, HSTS, X-Frame-Options, X-Content-Type          |
| `dns_scanner`           | SPF, DKIM, DMARC records                            |
| `cms_detector`          | WordPress, Drupal fingerprinting                    |
| `js_library_checker`    | Outdated/vulnerable JS libraries                    |
| `port_scanner_safe`     | Non-intrusive check of common ports                 |
| `cookie_security_checker`| Secure, HttpOnly, SameSite flags                  |
| `https_redirect`        | HTTP → HTTPS redirect enforcement                   |
| `robots_scanner`        | robots.txt exposure of sensitive paths              |

**IMPORTANT:** Scanner must ONLY perform passive, non-intrusive checks.
No exploitation, brute force, active attacks, or anything that could harm the target.

---

## Scoring

- Start at **100**
- Critical finding: **−15** points
- Warning finding: **−5** points
- Info finding: **−1** point
- Minimum score: **0**

Score bands: 90–100 = Excellent, 70–89 = Good, 50–69 = Fair, 0–49 = Poor

---

## Backend API Endpoints

```
POST   /api/auth/register          # { email, password, name }
POST   /api/auth/login             # { email, password } → sets httpOnly cookie
POST   /api/auth/logout

POST   /api/scan                   # { domain, consent: true } → { scanId }
GET    /api/scan/:id               # Poll results → { status, score, findings }

GET    /api/user/scans             # Authenticated user's scan history
GET    /api/user/me                # Profile + subscription info

POST   /api/subscription/checkout  # Create Stripe checkout session
POST   /api/subscription/webhook   # Stripe webhook (raw body required)

GET    /api/admin/stats            # Admin only
GET    /api/admin/users            # Admin only

GET    /api/health                 # Health check
```

---

## Database Schema

Tables in PostgreSQL:
- `users` — id, email, password_hash, name, is_admin, tier (free/pro/agency), scan_count_month
- `scans` — id, user_id, domain, status, score, created_at, completed_at
- `scan_results` — id, scan_id, module_name, findings (JSONB), score_impact
- `subscriptions` — id, user_id, stripe_customer_id, stripe_subscription_id, status, tier

Schema is initialised automatically on backend startup via `models/db.js → initDB()`.

---

## Auth & Security

- **JWT** stored in **httpOnly cookies** (not localStorage)
- Middleware: `src/middleware/auth.js` — reads cookie, verifies JWT, attaches `req.user`
- Rate limiting: global limiter on all routes + stricter limiter on `/api/scan`
- Free tier: max 3 scans/month — enforced **server-side** in scan route, not just frontend
- PDF export: gated behind Pro/Agency plan check server-side
- All scan submissions require `consent: true` in body (user acknowledges they own the domain)

---

## Pricing Tiers

| Tier   | Price | Scans/month | PDF | Monitoring | API Access |
|--------|-------|-------------|-----|------------|------------|
| Free   | $0    | 3           | No  | No         | No         |
| Pro    | $9/mo | Unlimited   | Yes | Yes        | No         |
| Agency | $29/mo| Unlimited   | Yes | Yes        | Yes        |

Tiers are stored in `users.tier` and enforced in backend middleware.

---

## Environment Variables

All vars are documented in `.env.example`. Key ones:

```bash
DATABASE_URL          # postgresql://securityscan:PASSWORD@postgres:5432/securityscan
REDIS_URL             # redis://:PASSWORD@redis:6379
JWT_SECRET            # Long random string — generate with: openssl rand -hex 64
POSTGRES_PASSWORD     # Strong random password
REDIS_PASSWORD        # Strong random password
FRONTEND_URL          # https://yourdomain.com (or http://IP for HTTP-only)
COOKIE_SECURE         # false for HTTP, true for HTTPS
STRIPE_SECRET_KEY     # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET # whsec_... from Stripe Dashboard
STRIPE_PRICE_PRO      # price_... from Stripe Dashboard
STRIPE_PRICE_AGENCY   # price_... from Stripe Dashboard
```

**Never commit `.env`** — it contains real secrets. Only `.env.example` is committed.

---

## Frontend Structure

```
frontend/
├── app/
│   ├── page.tsx              # Landing page with scan form
│   ├── layout.tsx            # Root layout (dark mode, fonts)
│   ├── globals.css           # Tailwind base styles
│   ├── auth/login/page.tsx   # Login page
│   ├── auth/register/page.tsx
│   ├── dashboard/page.tsx    # User's scan history
│   └── scan/[id]/page.tsx    # Report page — polls API, renders findings
├── components/
│   ├── Navbar.tsx
│   ├── ScanForm.tsx          # Domain input + consent checkbox
│   ├── ScoreGauge.tsx        # Animated circular score gauge
│   └── FindingCard.tsx       # Collapsible finding with severity badge
└── lib/
    ├── api.ts                # Typed API client functions
    └── utils.ts              # Score colour helpers, formatting
```

UI conventions:
- Dark mode by default (bg-gray-950, text-gray-100)
- Stripe/Linear/Vercel aesthetic
- Framer Motion for report reveal animations
- Shadcn UI component patterns (but installed manually, not via CLI)

---

## Common Development Tasks

### Run locally (with Docker)
```bash
cp .env.example .env   # Fill in values
make build
make up
make logs
```

### Restart a single service
```bash
docker compose restart backend
docker compose restart scanner
```

### View logs for one service
```bash
docker compose logs -f backend
docker compose logs -f backend-worker
docker compose logs -f scanner
```

### Shell into containers
```bash
make shell-backend     # → sh in backend container
make shell-scanner     # → bash in scanner container
make db-shell          # → psql in postgres container
```

### Add a new scanner module
1. Create `scanner/modules/your_module.py`
2. Implement `async def scan(domain: str) -> dict` returning the standard result dict
3. Import and add to the module list in `scanner/scanner.py`
4. No other changes needed — scoring is automatic

### Add a new API route
1. Create `backend/src/routes/your_route.js`
2. Import and mount in `backend/src/index.js` under `/api/your_route`
3. Use `authenticateToken` middleware from `middleware/auth.js` for protected routes

---

## Deployment (Production)

See `DEPLOY.md` for full steps. Summary:

1. Install Docker on Ubuntu VPS
2. Clone repo, `cp .env.example .env` and fill in all values
3. Point DNS to server IP
4. Run `make ssl-init DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com`
5. Run `make build && make up`
6. Set Stripe webhook to `https://yourdomain.com/api/subscription/webhook`
7. Make your user admin: `make db-shell` → `UPDATE users SET is_admin = true WHERE email = '...'`

Nginx handles TLS termination. Certbot auto-renews certificates every 12 hours.

---

## Key Constraints (Do Not Violate)

1. **Scanner must be passive only** — no exploitation, brute force, or active attacks
2. **User consent required** — `consent: true` must be in scan request body
3. **Free tier enforced server-side** — never rely on frontend-only checks
4. **PDF gated server-side** — check `user.tier` in backend, not just UI
5. **Secrets never in git** — `.env` is in `.gitignore`; use `.env.example` for templates
6. **JWT in httpOnly cookies** — never expose tokens to JavaScript
7. **All user input validated** — use express-validator on all API routes

---

## Tech Stack Versions

| Technology      | Version  |
|-----------------|----------|
| Next.js         | 14       |
| Node.js         | 20 LTS   |
| Python          | 3.11     |
| PostgreSQL      | 16       |
| Redis           | 7        |
| Nginx           | Alpine   |
| Docker Compose  | v2       |

---

*This guide was written to give any AI assistant full context to work on this codebase
without needing to ask basic questions. Update this file when architecture changes.*
