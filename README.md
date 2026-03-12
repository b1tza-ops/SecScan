# SecurityScan — Website Security Auditing SaaS

A production-ready Micro-SaaS platform that audits any website's security posture. Users submit a domain, receive a 0–100 security score, categorized findings per severity, fix recommendations, and (on paid plans) PDF export.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, TailwindCSS, Framer Motion, Radix UI |
| Backend API | Node.js/Express (ESM modules, port 4000) |
| Scanner Engine | Python FastAPI (port 8000) |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + BullMQ |
| Auth | JWT in httpOnly cookies |
| Payments | Stripe subscriptions |
| Proxy | Nginx (TLS termination, rate limiting) |
| Deployment | Docker Compose (8 services), Certbot SSL |

---

## Project Structure

```
securityscan/
├── frontend/                  # Next.js 14 app
│   ├── app/
│   │   ├── page.tsx           # Landing page (hero, pricing, features)
│   │   ├── auth/login/        # Login page
│   │   ├── auth/register/     # Registration page
│   │   ├── dashboard/         # Authenticated user dashboard
│   │   └── scan/[id]/         # Scan result report page
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── auth/login/                 # Login page (with forgot-password link)
│   │   ├── auth/register/              # Registration page
│   │   ├── auth/forgot-password/       # Request password reset
│   │   ├── auth/reset-password/        # Set new password via token
│   │   ├── auth/verify-email/          # Email verification
│   │   ├── dashboard/                  # Authenticated user dashboard
│   │   └── scan/[id]/                  # Scan report (filter, AI summary, rescan)
│   ├── components/
│   │   ├── ScanForm.tsx       # Domain input + consent checkbox
│   │   ├── ScoreGauge.tsx     # Animated SVG score circle
│   │   ├── FindingCard.tsx    # Collapsible vulnerability card + AI Fix button
│   │   ├── OWASPSummary.tsx   # OWASP category breakdown
│   │   └── BadgeEmbed.tsx     # Security badge embed snippet
│   └── lib/
│       ├── api.ts             # Typed API client (all endpoints)
│       └── utils.ts           # cn(), severityColor(), scoreColor()
│
├── backend/
│   └── src/
│       ├── index.js           # Express app, middleware, route mounting
│       ├── worker.js          # Standalone BullMQ worker process
│       ├── models/db.js       # PostgreSQL pool + schema init (7 tables)
│       ├── queue/scanQueue.js # BullMQ job enqueue + worker logic
│       ├── routes/
│       │   ├── auth.js        # register, login, logout, me, forgot/reset password, verify email
│       │   ├── scan.js        # create scan, poll, rescan, history (auth), list
│       │   ├── user.js        # profile, domains, webhook (https-only), api-key
│       │   ├── subscription.js# Stripe checkout, portal, webhook
│       │   ├── ai.js          # POST /fix, POST /summary (OpenAI GPT-4o-mini)
│       │   ├── badge.js       # SVG badge with 1-hour cache
│       │   ├── pdf.js         # PDF export (Pro+, ownership verified)
│       │   └── admin.js       # stats, user list, scan list (admin only)
│       └── middleware/
│           ├── auth.js        # requireAuth, optionalAuth, requireAdmin
│           ├── rateLimit.js   # globalLimiter, authLimiter, scanLimiter
│           └── errorHandler.js
│
├── scanner/
│   ├── main.py                # FastAPI entrypoint (POST /scan, GET /health)
│   ├── scanner.py             # Orchestrator — runs 9 modules in parallel
│   └── modules/
│       ├── ssl_scanner.py         # TLS cert validity, cipher, expiry
│       ├── headers_scanner.py     # CSP, HSTS, X-Frame-Options, etc.
│       ├── dns_scanner.py         # SPF, DMARC, DNSSEC records
│       ├── cms_detector.py        # WordPress, Drupal, Joomla fingerprinting
│       ├── js_library_checker.py  # Outdated/vulnerable JS libraries
│       ├── port_scanner_safe.py   # 12 common ports (passive only)
│       ├── cookie_security_checker.py # Secure, HttpOnly, SameSite flags
│       ├── robots_scanner.py      # Sensitive paths in robots.txt
│       └── https_redirect.py     # HTTP→HTTPS redirect enforcement
│
├── database/
│   └── init.sql               # (schema handled by db.js initDB())
├── docker/                    # Per-service Dockerfiles
├── nginx/nginx.conf           # Reverse proxy, rate limiting, security headers
├── docker-compose.yml         # 8 services: postgres, redis, scanner, backend,
│                              #   backend-worker, frontend, nginx, certbot
├── Makefile                   # Dev/deploy shortcuts
├── DEPLOY.md                  # Step-by-step deployment guide
├── AI_GUIDE.md                # Detailed architecture reference for developers
└── .env.example               # All required environment variables documented
```

---

## Architecture & Scan Flow

```
User → POST /scan (frontend)
     → Express API validates domain, checks plan limits, creates DB record
     → BullMQ job enqueued to Redis
     → backend-worker picks up job
     → Calls POST http://scanner:8000/scan
     → Python scanner runs 9 modules in parallel (asyncio.gather)
     → Results aggregated, persisted to PostgreSQL
     → Frontend polls GET /scan/:id every 3s until status = "completed"
     → Report page renders score gauge + finding cards
```

---

## Scoring Algorithm

- Starts at **100 points**
- Deducted per finding severity:
  - Critical / High → **−15 pts** each
  - Medium → **−10 pts** each
  - Low → **−2 pts** each
  - Info → **0 pts**
- Minimum score: **0**
- Labels: 90–100 Excellent · 70–89 Good · 50–69 Fair · 0–49 Poor

---

## Pricing Tiers

| Plan | Price | Limits |
|---|---|---|
| Free | $0 | 3 scans/month, no PDF |
| Pro | $9/mo | Unlimited scans, PDF export, monitoring |
| Agency | $29/mo | Everything + white-label PDF, API key access |

> Free tier is enforced **server-side** in `scan.js` — not just in the UI.

---

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/scan                  # Requires domain + consent:"true"
GET    /api/scan/:id              # Poll scan status + results
GET    /api/scan/                 # User's scan history (auth required)

GET    /api/user/profile
GET    /api/user/scans
GET    /api/user/domains
POST   /api/user/domains/:id/monitor
POST   /api/user/regenerate-api-key

POST   /api/subscription/checkout
POST   /api/subscription/portal
POST   /api/subscription/webhook  # Stripe webhook (raw body)

GET    /api/admin/stats           # Admin only
GET    /api/admin/users
GET    /api/admin/scans
GET    /api/health
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `users` | id, email, password_hash, full_name, plan, stripe_customer_id, api_key, is_admin |
| `domains` | User domains, monitoring config (enabled, interval) |
| `scans` | id, user_id, domain, status, security_score, critical/warning/info counts |
| `scan_results` | Per-module results (JSONB), findings, raw_data |
| `vulnerabilities` | title, description, severity, category, fix_recommendation, fix_example |
| `reports` | scan_id, user_id, pdf_url |
| `subscriptions` | stripe_subscription_id, plan, status, billing period |

Schema is auto-created on backend startup via `initDB()` in `db.js`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com
JWT_SECRET=
POSTGRES_PASSWORD=
REDIS_PASSWORD=
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
DATABASE_URL=postgresql://securityscan:${POSTGRES_PASSWORD}@postgres:5432/securityscan
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
SCANNER_SERVICE_URL=http://scanner:8000
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

---

## Deployment (Quick Reference)

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Configure environment
cp .env.example .env
# Edit .env with real values

# 3. Init SSL (requires DNS already pointing to this server)
make ssl-init DOMAIN=yourdomain.com EMAIL=you@example.com

# 4. Build and start
make build && make up

# 5. View logs
make logs

# 6. Make a user admin (replace email)
make db-shell
UPDATE users SET is_admin = true WHERE email = 'you@example.com';
```

See `DEPLOY.md` for full step-by-step guide including Stripe webhook setup.

---

## Makefile Commands

```bash
make up            # Start all services (detached)
make down          # Stop all services
make build         # Build Docker images
make logs          # Tail logs (all services)
make deploy        # Pull latest, rebuild, restart
make shell-backend # bash into backend container
make shell-scanner # bash into scanner container
make db-shell      # psql into postgres container
make ssl-init      # Initialize Let's Encrypt SSL
```

---

## What's Implemented

- [x] Full Docker Compose setup (8 services, internal network)
- [x] User auth — JWT in httpOnly cookies, bcrypt 12 rounds
- [x] Email verification on registration + password reset flow
- [x] 12 passive security scanning modules (runs in parallel)
- [x] BullMQ job queue with 3 retries + exponential backoff
- [x] Worker graceful shutdown on SIGTERM/SIGINT
- [x] PostgreSQL schema with indexes, auto-created on startup
- [x] Stripe checkout + customer portal + webhook handler
- [x] Free tier enforcement server-side (3 scans/month)
- [x] Anonymous scan tracking (5/day per IP)
- [x] Rate limiting — global, auth, scan, AI endpoints
- [x] Nginx reverse proxy with rate limits + security headers
- [x] Certbot SSL auto-renewal (every 12 hours)
- [x] Dark-mode UI with Framer Motion animations
- [x] Scan result polling with 5-minute timeout
- [x] Severity filter tabs on findings (All/Critical/High/Medium/Low/Info)
- [x] Re-scan button on completed/failed scans
- [x] Failed scan state with retry button
- [x] PDF export (pdfkit, Pro/Agency only) — with ownership check
- [x] SVG security badge with 1-hour cache
- [x] OWASP summary per scan
- [x] Domain monitoring scheduler (BullMQ repeatable job)
- [x] Monitoring email alerts (score change + criticals)
- [x] Webhook notifications for Slack/Discord on scan complete
- [x] Admin API endpoints (stats, users, scans)
- [x] **AI Fix Advisor** — per-finding AI remediation (OpenAI GPT-4o-mini)
- [x] **AI Executive Summary** — plain-English scan summary for stakeholders
- [x] Score history chart (recharts line chart per domain)
- [x] Security badge embed (SVG + copy snippet)
- [x] Domain scan history endpoint (authenticated)

---

## AI Features

Powered by **OpenAI GPT-4o-mini**. Set `OPENAI_API_KEY` in `.env` to enable.

### AI Fix Advisor
Each finding card has an "AI Fix" button that returns:
- Plain-English explanation of the vulnerability
- 3–5 specific fix steps
- Code/config example
- Effort estimate (low/medium/high)
- Reference links (OWASP, MDN, official docs)

**Limits:** Free users get 3 AI fixes/day. Pro/Agency users get unlimited.

### AI Executive Summary
On any completed scan report, click "Generate AI Executive Summary" to get:
- Overall security posture assessment
- Top 3 business risks
- Quick wins (easiest fixes)
- Priority level (critical/high/medium/low)

---

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/auth/verify-email?token=
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

POST   /api/scan                  # Requires domain + consent:"true"
GET    /api/scan/:id              # Poll scan status + results
POST   /api/scan/:id/rescan       # Re-run scan (auth required)
GET    /api/scan/                 # User's scan history (auth required)
GET    /api/scan/history/:domain  # Domain score history (auth required)

GET    /api/user/profile
GET    /api/user/scans
GET    /api/user/domains
POST   /api/user/domains/:id/monitor
POST   /api/user/domains/:id/webhook
POST   /api/user/regenerate-api-key

POST   /api/subscription/checkout
POST   /api/subscription/portal
POST   /api/subscription/webhook  # Stripe webhook (raw body)

GET    /api/badge/:domain         # SVG security badge (public)
GET    /api/pdf/:scanId           # PDF report download (Pro/Agency, owner only)

POST   /api/ai/fix                # AI fix advice for a finding
POST   /api/ai/summary            # AI executive summary for a scan (auth required)

GET    /api/admin/stats           # Admin only
GET    /api/admin/users
GET    /api/admin/scans
GET    /api/health
```

---

## Known Gaps / TODO

### Admin Frontend
- Admin API routes exist and work (`/api/admin/*`)
- **Needs:** A Next.js page at `app/admin/page.tsx` with stats cards, user table, scan table

### API Key Authentication
- `api_key` field is generated for every user on signup
- `POST /api/user/regenerate-api-key` endpoint exists
- **Needs:** Middleware to accept `Authorization: Bearer <api_key>` for Agency plan API access

### White-label PDF
- Mentioned in Agency tier pricing
- **Needs:** PDF template that accepts logo/branding inputs; user settings to upload logo

### Testing
- No test files exist anywhere in the project
- Recommend: Jest for backend unit/integration tests, Playwright for frontend E2E

---

## Security Constraints

The scanner is **strictly passive and non-intrusive**:
- No exploitation or brute force of any kind
- Port scanner only checks 12 common ports with a simple TCP connect
- All HTTP requests are read-only
- Users must check a consent box confirming they own or have permission to scan the target domain
- This is validated on the backend (`consent` field must equal `"true"`)

---

## Notes for the Next Developer

- **Backend uses ESM** (`"type": "module"` in package.json) — use `import/export`, not `require()`
- **Scanner is async Python** — all modules should be `async def` or wrapped via `run_module()` which handles both
- **The worker runs as a separate Docker service** (`backend-worker`) — it imports `startScanWorker()` from `scanQueue.js`. Do not merge it back into the main API process.
- **Stripe webhook** requires raw body — there is special handling in `index.js` to skip `express.json()` for that route. Don't break this.
- **Free scan limit** is checked by counting scans for the current calendar month in `scan.js`. If you add a reset mechanism, update this logic.
- **Score deductions** are defined in `scanner/scanner.py` in `SEVERITY_WEIGHTS`. The frontend `scoreColor()` and `scoreLabel()` in `lib/utils.ts` use hardcoded thresholds — keep them in sync.
- **Docker network** is named `internal` — all inter-service communication uses service names as hostnames (e.g., `http://scanner:8000`, `postgres:5432`)
- **Nginx config** does not include SSL block by default — Certbot mounts certs into the nginx container and modifies the config. Run `make ssl-init` before `make up` on a fresh deploy.
