# Trend Catcher (猎趋)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.x-purple)](https://hono.dev/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Trend Catcher is an AI-powered trend aggregator for indie developers. Every day, it scrapes **Product Hunt**, **Hacker News**, and **GitHub Trending**, then uses **DeepSeek LLM** to generate bilingual (English / Chinese) summaries — so you never miss what matters in the indie dev world. Every Sunday, it synthesizes the week's daily reports into a cross-week trend overview.

---

## What You Get

| | |
|---|---|
| **Daily Reports** | Each day's top products, launches, and discussions across 3 sources, with AI-generated analysis and category tags |
| **Weekly Synthesis** | Every Sunday, a bird's-eye view of the week's trends — cross-referenced across sources |
| **Email Newsletter** | Reports delivered straight to your inbox (double opt-in, one-click unsubscribe) |
| **Web Dashboard** | Browse reports at `/reports/:date`, with cursor pagination and i18n (`?lang=en` / `?lang=zh`) |
| **PWA** | Installable as an app with offline support |

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/chenjunqian/trend-catcher.git
cd trend-catcher
npm install

# 2. Configure env vars
cp .env.example .dev.vars
# Edit .dev.vars: set DEEPSEEK_API_KEY and INTERNAL_SECRET

# 3. Create D1 database
npx wrangler d1 create trend-catcher-db
# Copy the returned database_id into wrangler.toml

# 4. Run migration & start
npm run db:migrate:local
npm run dev
```

Visit **http://localhost:8787** to see the dashboard.

---

## Usage

### View Reports

| URL | What you get |
|---|---|
| `/` | Timeline of daily + weekly reports (cursor pagination, 20 per page) |
| `/reports/2025-06-01` | Detailed bilingual (EN/ZH) daily report |
| `/reports/weekly/2026-05-25` | Weekly trend synthesis |
| `/?lang=zh` | Full UI in Chinese |

### Subscribe to Newsletter

Receive daily/weekly reports via email:

| Endpoint | Description |
|---|---|
| `POST /api/subscribe { email, lang }` | Subscribe (confirmation email sent) |
| `/confirm?token=...` | Click link in email to confirm |
| `/unsubscribe?token=...` | One-click unsubscribe |

### Trigger Pipeline (Local Dev)

```bash
curl -X POST http://localhost:8787/internal/trigger \
  -H "Authorization: Bearer your-secret"
```

### Deploy

```bash
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put INTERNAL_SECRET
npm run deploy
```

Cron runs automatically at UTC 1:00 AM daily.

---

## REST API

### Newsletter

| Method | Path | Description |
|---|---|---|
| POST | `/api/subscribe` | Subscribe email (`{ email, lang }`) |
| GET | `/api/confirm` | Confirm subscription (`?token=xxx`) |
| GET | `/unsubscribe` | Unsubscribe (`?token=xxx&lang=en/zh`) |

### Internal (requires `Authorization: Bearer <INTERNAL_SECRET>`)

| Method | Path | Description |
|---|---|---|
| POST | `/internal/trigger` | Run full daily pipeline |
| POST | `/internal/aggregate` | Run LLM aggregation only |
| POST | `/internal/weekly-aggregate` | Run weekly synthesis |
| POST | `/internal/send-email` | Send daily report to all subscribers |

---

## Architecture

```
Cron Trigger (UTC 1:00 AM)
    │
    ├── Daily Path (Mon-Sat)
    │   Generator ──► Queue ──► Scrapers
    │     (D1 tasks)   (batch)   ├── Product Hunt (RSS)
    │                             ├── Hacker News (Firebase API)
    │                             └── GitHub Trending (HTML)
    │                                  │
    │                                  ▼
    │                        Container Orchestrator
    │                  (starts Firecracker VM, sends data)
    │                                  │
    │                                  ▼
    │                         Container (Node.js)
    │                      (DeepSeek LLM Agent Loop)
    │                                  │
    │                        ┌─────────┴─────────┐
    │                        ▼                   ▼
    │                  D1 Database     Cloudflare Email Send
    │                  (daily_summaries)  (to confirmed subscribers)
    │                        │
    │                        ▼
    │                Web Dashboard (Hono JSX + PWA)
    │
    └── Weekly Path (Sunday only)
        Generator ──► Queue ──► Consumer (waits for daily done)
                      (type:"weekly")    │
                                         ▼
                               Container Orchestrator
                         (reads 7 days of daily_summaries)
                                         │
                                         ▼
                                Container (Node.js)
                          (Weekly LLM Agent: synthesis only)
                                         │
                               ┌─────────┴─────────┐
                               ▼                   ▼
                         D1 weekly_summaries  Cloudflare Email Send
                               │
                               ▼
                       Web Dashboard (/reports/weekly/:date)
```

---

## Project Structure

```
trend-catcher/
├── wrangler.toml
├── Dockerfile
├── src/
│   ├── index.tsx              # Hono entry, queue/cron handlers, AggregatorContainer DO
│   ├── tasks/                 # Generator, consumer, scrapers
│   ├── aggregator/            # LLM setup, agent tools, daily + weekly agent loops, container orchestrator, web search
│   ├── container/             # Node.js HTTP server for Firecracker VM
│   ├── notifier/              # EmailSender interface + template builder (Cloudflare Email Send)
│   ├── routes/                # pages.tsx, api.ts, layout, home, report, newsletter, markdown renderer
│   ├── db/                    # schema.sql + query helpers
│   ├── pwa/                   # Manifest generator + tests
│   ├── i18n/                  # EN/ZH translations
│   └── utils/                 # Date formatting, HTTP fetcher
└── public/                    # Icons, SW, register-sw.js, pull-to-refresh.js
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Container | Cloudflare Containers (Firecracker VM) |
| Framework | Hono.js (JSX SSR) |
| Database | Cloudflare D1 (SQLite) |
| Queue | Cloudflare Queues |
| LLM | DeepSeek (`deepseek-v4-flash`, OpenAI SDK) |
| Email | Cloudflare Email Send (`[[send_email]]`) |
| Testing | Vitest (16 test files) |

---

## License

MIT © 2025
