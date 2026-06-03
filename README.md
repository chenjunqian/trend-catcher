# Trend Catcher (猎趋)

> AI-powered daily trend aggregator for indie developers. Scrapes Product Hunt, Hacker News, and GitHub Trending, generates bilingual (EN/ZH) summaries via DeepSeek LLM, and delivers them via email and a web dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-4.x-purple)](https://hono.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Architecture

```
Cron Trigger (UTC 1:00 AM)
    │
    ▼
Generator ──► Queue ──► Scrapers
  (D1 tasks)  (batch)   ├── Product Hunt (RSS)
                         ├── Hacker News (Firebase API)
                         └── GitHub Trending (HTML)
                              │
                              ▼
                    Container Orchestrator
              (starts Firecracker VM, sends data)
                              │
                              ▼
                     Container (Node.js)
                  (DeepSeek LLM Agent Loop)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              D1 Database         Email (Resend)
                    │
                    ▼
            Web Dashboard
         (Hono JSX + PWA)
```

## Features

- **3 Data Sources** — Product Hunt, Hacker News, GitHub Trending scraped daily
- **AI Summaries** — DeepSeek LLM generates bilingual (English / Chinese) reports
- **Container Isolation** — LLM agent loop runs in a Cloudflare Container (Firecracker VM) for extended execution
- **Email Delivery** — Daily reports sent via Resend to your inbox
- **Web Dashboard** — View reports via browser with i18n support (`?lang=en` / `?lang=zh`)
- **PWA** — Installable as a standalone app with offline support
- **Cost Efficient** — LLM prefix cache optimization reduces API costs significantly

## Tech Stack

| Layer           | Technology                              |
| --------------- | --------------------------------------- |
| Runtime         | Cloudflare Workers                      |
| Container       | Cloudflare Containers (Firecracker VM)  |
| Framework       | Hono.js (JSX server-side rendering)     |
| Database        | Cloudflare D1 (SQLite)                  |
| Queue           | Cloudflare Queues                       |
| LLM             | DeepSeek (`deepseek-chat`, OpenAI SDK)  |
| Email           | Resend                                  |
| Language        | TypeScript (strict mode)                |
| Testing         | Vitest + `@cloudflare/vitest-pool-workers` |

## Project Structure

```
trend-catcher/
├── wrangler.toml              # Cloudflare Workers config
├── Dockerfile                 # Container image (Node.js server)
├── package.json
├── tsconfig.json
├── public/                    # Static assets (icons, manifest)
├── scripts/
│   ├── test-scrapers.ts       # Manual scraper test runner
│   ├── it-test.ts             # Full integration test (scrape → D1 → LLM → container smoke)
│   └── proxy.ts               # Auto-detect https_proxy for local dev
└── src/
    ├── index.tsx              # Hono app entry (routes, queue, cron, PWA, Container DO)
    ├── db/
    │   ├── schema.sql         # D1 table definitions
    │   └── client.ts          # D1 query helpers
    ├── tasks/
    │   ├── generator.ts       # Cron handler: creates & enqueues tasks
    │   ├── consumer.ts        # Queue consumer: processes & triggers aggregation
    │   └── processors/
    │       ├── producthunt.ts # Atom RSS feed parser
    │       ├── hackernews.ts  # Firebase API client
    │       └── github.ts      # cheerio HTML scraper
    ├── aggregator/
    │   ├── llm.ts             # DeepSeek provider setup
    │   ├── tools.ts           # Agent tools (D1-backed + in-memory variants)
    │   ├── aggregate.ts       # Agent loop: system prompt + generateText (shared)
    │   ├── container.ts       # Container orchestrator: start, send data, save results
    │   └── search.ts          # Web search via DuckDuckGo HTML
    ├── container/
    │   └── server.ts          # Container HTTP server (Node.js, receives data, runs LLM agent)
    ├── notifier/
    │   └── email.ts           # Resend email sender
    ├── routes/
    │   ├── layout.tsx         # Layout component (dark theme, lang switch)
    │   ├── home.tsx           # GET / — report list
    │   └── report.tsx         # GET /reports/:date — report detail
    ├── pwa/
    │   ├── manifest.ts        # PWA manifest JSON
    │   └── sw.ts              # Service worker
    ├── i18n/
    │   └── index.ts           # Translations, lang detection
    └── utils/
        ├── date.ts            # Date formatting
        └── fetcher.ts         # HTTP fetch with retry + timeout
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) (for container smoke test; optional for development)
- A Cloudflare account (free tier works)
- [DeepSeek API key](https://platform.deepseek.com/)
- [Resend API key](https://resend.com/)

### 1. Clone and Install

```bash
git clone https://github.com/<your-username>/trend-catcher.git
cd trend-catcher
npm install
```

### 2. Configure Environment

```bash
cp .env.example .dev.vars
```

Edit `.dev.vars` with your API keys:

```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
NOTIFICATION_EMAIL=you@example.com
INTERNAL_SECRET=your-random-secret
```

### 3. Create D1 Database

```bash
npx wrangler d1 create trend-catcher-db
```

Copy the returned `database_id` into `wrangler.toml`.

### 4. Run Database Migration

```bash
npm run db:migrate:local
```

### 5. Start Dev Server

```bash
npm run dev
```

Visit **http://localhost:8787** to see the dashboard.

## Usage

### Scrape Manually (Local Dev)

```bash
curl -X POST http://localhost:8787/internal/trigger \
  -H "Authorization: Bearer your-random-secret"
```

### View Reports

| URL                    | Description              |
| ---------------------- | ------------------------ |
| `/`                    | Report list (30 days)    |
| `/reports/2025-06-01`  | Detailed bilingual report |
| `/?lang=zh`            | Chinese UI               |
| `/reports/2025-06-01?lang=zh` | Chinese report detail     |

### Test Scrapers

```bash
npm run test:scrapers
```

### Run All Tests

```bash
npm run test
```

### Deploy to Cloudflare

```bash
# Set production secrets
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put INTERNAL_SECRET

# Deploy
npm run deploy
```

The cron trigger (UTC 1:00 AM daily) will activate automatically after deployment.

## REST API

### Internal Endpoints (require `Authorization: Bearer <INTERNAL_SECRET>`)

| Method | Path                   | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| POST   | `/internal/trigger`    | Manually trigger today's full pipeline         |
| POST   | `/internal/test-email` | Send a test email to `NOTIFICATION_EMAIL`      |
| POST   | `/internal/scrape`     | Run scrapers only (no aggregation/email)        |
| POST   | `/internal/aggregate`  | Run aggregation via container (or fallback direct Worker)

## License

MIT © 2025

---

Built with [Hono](https://hono.dev/), [Cloudflare Workers](https://workers.cloudflare.com/), and [DeepSeek](https://www.deepseek.com/).
