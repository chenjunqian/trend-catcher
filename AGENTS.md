# AGENTS.md — Trend Catcher

## Project Overview

**Trend Catcher** (猎趋) is an AI-powered daily and weekly trend aggregator for indie developers. It scrapes Product Hunt, Hacker News, and GitHub Trending every day, generates bilingual (EN/ZH) summaries via an LLM agent loop, and delivers daily reports via email and a web dashboard. Every Sunday, it synthesizes the past week's daily reports into a weekly trend report.

- **Runtime**: Cloudflare Workers
- **Web framework**: Hono.js (JSX server-side rendering)
- **DB**: Cloudflare D1 (SQLite)
- **Queue**: Cloudflare Queues
- **Cron**: Daily at UTC 1:00 AM
- **LLM**: DeepSeek (via `@ai-sdk/openai` → `api.deepseek.com/v1`)
- **Email**: Cloudflare Email Send (`[[send_email]]` binding, no API key needed)
- **Language**: TypeScript (strict mode), all code and configuration in English

---

## Architecture

### Daily Flow

```
Cron Trigger (UTC 1:00)
  → generator.ts: creates scrape tasks in D1 + enqueues to scrape-queue
  → On Sunday: also enqueues a weekly task via enqueueWeeklyTask()
      ↓
Queue Consumer (concurrent, up to 5-min execution)
  → processors/*.ts: scrapes each website
  → Updates D1 task status to completed
  → When all tasks done → triggers container aggregation
      ↓
Container Orchestrator (aggregator/container.ts)
  → getContainer() → DurableObjectStub for AggregatorContainer
  → container.fetch() → retried with exponential backoff
  → DO's containerFetch() starts Firecracker VM, boots Node.js server
      ↓
Container HTTP Server (container/server.ts)
  → Receives raw scraped data + DeepSeek API key via POST /aggregate
  → Creates in-memory agent tools (no D1 access needed)
  → Runs LLM agent loop: getRawDataByWebsite → webSearch → saveSiteSummary → saveFinalReport
  → Returns { siteSummaries, reportEn, reportZh } back to orchestrator
      ↓
Orchestrator saves to D1 + performs post-aggregation validation (fillMissingSiteSummary)
      + sends email to all confirmed subscribers via Cloudflare Email Send
      ↓
Web Dashboard (Hono JSX)
  → GET /                     : list of daily + weekly reports (cursor pagination)
  → GET /reports/:date        : detailed daily report
  → GET /reports/weekly/:date : detailed weekly trend report
  → i18n: ?lang=en / ?lang=zh / Accept-Language header
```

### Weekly Flow (Sunday only)

```
Cron Trigger detects Sunday → enqueueWeeklyTask()
  → scrape-queue receives a single type:"weekly" task
      ↓
Queue Consumer (weekly path)
  → Waits for Sunday's daily scrape tasks to complete
  → Marks weekly task as completed
  → Triggers weekly aggregation (container or direct Worker)
      ↓
Container Orchestrator (triggerWeeklyContainerAggregation)
  → Fetches all 7 daily summaries for the past week from D1
  → POST /aggregate-weekly to container with { weekStartDate, dailySummaries, apiKey }
      ↓
Container HTTP Server (handleWeeklyAggregation)
  → Creates in-memory weekly agent tools (receives pre-loaded daily summaries)
  → Runs weekly agent loop: getDailySummaries → webSearch → saveSiteSummary → saveFinalReport
  → Returns { siteSummaries, reportEn, reportZh } back to orchestrator
      ↓
Orchestrator saves to weekly_summaries table + sends weekly email to subscribers
```

---

## Route Structure

Routes are split into two Hono sub-apps mounted in `src/index.tsx`:

- `src/routes/pages.tsx` — Page routes: `GET /`, `/reports/:date`, `/reports/weekly/:date`, `/api/confirm`, `/unsubscribe`, `/manifest.json`, `/offline`
- `src/routes/api.ts` — API routes: `POST /api/subscribe`, `POST /internal/*`, `POST /internal/send-email`

---

## Key Design Notes

- **DeepSeek cache optimization**: System prompt and first user message are completely static (no dates, no dynamic data). Only tool results contain dynamic content. This maximizes prefix cache hits and reduces API costs.
- **Idempotency**: Queue consumer checks `status === 'pending'` before processing. Tasks use `INSERT OR IGNORE`.
- **Completion detection**: After each batch, checks `getPendingTaskCountForDate()`. Failed tasks don't block aggregation.
- **Post-aggregation validation**: After daily aggregation, `fillMissingSiteSummary()` checks all 3 sites have summaries. Missing ones are regenerated individually.
- **Weekly waits for daily completion**: The weekly task `msg.retry()`s until Sunday's daily scrape tasks finish, ensuring all 7 days of data exist before aggregation.
- **Weekly as pure synthesis**: The weekly system does NOT scrape. It reads 7 pre-generated daily summaries and synthesizes them into a cross-week trend report.
- **Container module isolation (CRITICAL)**: `src/aggregator/aggregate.ts` and `src/aggregator/weekly-aggregate.ts` must NOT import any Workers-only modules (`@cloudflare/containers`, `cloudflare:workers`). They are shared between the Worker and the Container (Node.js) runtime. Workers-only imports live in `src/aggregator/container.ts` which is only imported by the Worker. The IT test Phase 0 enforces this.
- **Container retry logic**: Uses `container.fetch()` in a 6-attempt exponential backoff loop instead of `startAndWaitForPorts()` to work around a `@cloudflare/containers` race condition where `getTcpPort()` throws before the Firecracker VM reaches "running" state.
- **Email sender abstraction**: `email.ts` defines an `EmailSender` interface. The Worker provides a Cloudflare Email Send implementation; the interface could be swapped for other providers.
- **Newsletter with double opt-in**: Subscribers table with `is_confirmed` flag. A confirmation email is sent on subscribe; users click a link to confirm. Unsubscribe uses a unique per-subscriber token.
- **Cursor pagination**: Homepage timeline uses cursor-based pagination (`created_at` timestamp, 20 items per page) for efficient infinite scroll.
- **Light theme**: UI uses a light color scheme (white background, black text, gray borders, `theme-color: #ffffff`).

---

## Project Structure

```
trend-catcher/
├── wrangler.toml              # CF Workers config (D1, Queue, Cron, Containers, Email Send, Observability)
├── Dockerfile                 # Container image (Node.js 22 Alpine, tsx runtime, port 4000)
├── package.json
├── tsconfig.json
├── vitest.config.ts           # Vitest config (globals: true, environment: node)
├── .dev.vars                  # Local env vars (gitignored)
├── .env.example               # Env var template (DEEPSEEK_API_KEY + INTERNAL_SECRET)
├── AGENTS.md                  # This file
├── public/                    # Static assets (icons, manifest, SW, JS)
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── site.webmanifest       # Static PWA manifest
│   ├── sw.js                  # Service worker (cache-first, offline fallback)
│   ├── register-sw.js         # SW registration script
│   └── pull-to-refresh.js     # Mobile pull-to-refresh gesture
├── scripts/
│   ├── test-scrapers.ts       # Manual scraper test runner
│   ├── it-test.ts             # Full integration test (Phase 0→1→2→3→5→4)
│   └── proxy.ts               # Auto-detect https_proxy for local dev
└── src/
    ├── index.tsx              # Hono app entry (routes mount, queue handler, cron handler, AggregatorContainer DO)
    ├── db/
    │   ├── schema.sql         # D1 tables (scrape_tasks, daily_summaries, weekly_summaries, newsletter_subscribers)
    │   └── client.ts          # D1 query helpers (CRUD + getHomeTimeline + subscribe/confirm/unsubscribe)
    ├── tasks/
    │   ├── generator.ts       # Cron handler: creates + enqueues tasks, also enqueueWeeklyTask() on Sunday
    │   ├── consumer.ts        # Queue consumer: processes + triggers daily/weekly aggregation
    │   └── processors/
    │       ├── producthunt.ts # Atom RSS feed parser (Cloudflare blocks HTML)
    │       ├── hackernews.ts  # Firebase API (free, no auth)
    │       └── github.ts      # cheerio HTML scraper
    ├── aggregator/
    │   ├── llm.ts             # DeepSeek provider setup
    │   ├── tools.ts           # Agent tools (createAgentTools for Worker, createInMemoryAgentTools for Container)
    │   ├── aggregate.ts       # Agent loop: runAggregation + fillMissingSiteSummary (shared, NO Workers-only imports)
    │   ├── weekly-aggregate.ts # Weekly agent loop: runWeeklyAgentLoop, runWeeklyAggregation
    │   ├── weekly-tools.ts    # Weekly agent tools (createWeeklyAgentTools, createInMemoryWeeklyAgentTools)
    │   ├── container.ts       # Container orchestrator: triggerContainerAggregation + triggerWeeklyContainerAggregation
    │   └── search.ts          # DuckDuckGo HTML search (shared)
    ├── container/
    │   └── server.ts          # Container Node.js HTTP server (handles /aggregate + /aggregate-weekly)
    ├── notifier/
    │   ├── email.ts           # EmailSender interface + sendDailyEmail/sendWeeklyEmail via Cloudflare Email Send
    │   └── template.ts        # Shared email HTML builder (buildEmailHtml + markdownToHtml)
    ├── routes/
    │   ├── pages.tsx          # Page routes: /, /reports/:date, /reports/weekly/:date, /confirm, /unsubscribe, /manifest.json, /offline
    │   ├── api.ts             # API routes: /api/subscribe, /internal/*, /internal/send-email
    │   ├── layout.tsx         # Layout component (light theme, newsletter form, pull-to-refresh, lang switch)
    │   ├── home.tsx           # GET / — report list with cursor pagination (20 per page, load more)
    │   ├── report.tsx         # GET /reports/:date + /reports/weekly/:date — bilingual report detail
    │   ├── markdown.ts        # Client-side Markdown → HTML renderer
    │   └── newsletter.tsx     # Confirm / Unsubscribe / UnsubscribeSuccess / NotFound pages
    ├── pwa/
    │   ├── manifest.ts        # /manifest.json endpoint (dynamic)
    │   ├── manifest.test.ts   # Manifest tests
    │   └── sw.test.ts         # Service worker tests (tests public/sw.js)
    ├── i18n/
    │   ├── index.ts           # Translations, lang detection (newsletter + weekly + site keys)
    │   └── index.test.ts      # i18n tests
    ├── test-utils/
    │   └── d1-mock.ts         # Shared D1 mock factory for tests
    └── utils/
        ├── date.ts            # Date formatting (getTodayDateString, getLastWeekMonday, getDateRangeForWeek)
        ├── date.test.ts       # Date utility tests
        └── fetcher.ts         # HTTP fetch with retry + timeout
```

---

## Development Commands

```bash
# Start local dev server (D1 local, no Cloudflare account needed)
npm run dev                    # → http://localhost:8787

# Type checking
npx tsc --noEmit

# Test scrapers manually
npm run test:scrapers

# Run all tests
npm run test                   # Single run (vitest run)
npm run test:watch             # Watch mode (vitest)

# Full integration test (Phase 0: container module check → Phase 4: Docker smoke test)
# Note: phases run as 0→1→2→3→5→4 (weekly aggregate before Docker smoke)
npm run it-test

# Local D1 operations
npm run db:migrate:local       # Run schema.sql on local D1
npx wrangler d1 execute trend-catcher-db --local --command="SELECT ..."

# Enable email sending (one-time)
npx wrangler email sending enable guoshaotech.com

# Deploy
npm run deploy
```

---

## TDD Workflow (REQUIRED)

**All feature development must follow Test-Driven Development. No exceptions.**

### Red-Green-Refactor Cycle

```
1. RED   — Write a failing test that describes the desired behavior
2. GREEN — Write the minimum code to make the test pass
3. REFACTOR — Clean up the code, keep tests green
4. COMMIT — Only after all tests pass
```

### Test Framework

Use **vitest** with `@cloudflare/vitest-pool-workers` for integration tests, and plain vitest for unit tests.

```bash
# Install (run once during setup)
npm install --save-dev vitest @cloudflare/vitest-pool-workers

# Run tests
npx vitest                    # Watch mode
npx vitest run                # Single run
npx vitest run --coverage     # With coverage
```

### Test Files (16 total)

```
src/
├── tasks/
│   ├── processors/
│   │   ├── producthunt.test.ts
│   │   ├── hackernews.test.ts
│   │   └── github.test.ts
│   ├── generator.test.ts
│   └── consumer.test.ts
├── aggregator/
│   ├── aggregate.test.ts
│   ├── tools.test.ts
│   ├── weekly-aggregate.test.ts
│   ├── weekly-tools.test.ts
│   └── container.test.ts
├── routes/
│   ├── home.test.tsx
│   └── report.test.tsx
├── pwa/
│   ├── manifest.test.ts
│   └── sw.test.ts
├── i18n/
│   └── index.test.ts
└── utils/
    └── date.test.ts
```

### What to Test

| Layer | Test type | Mock strategy |
|-------|-----------|---------------|
| `processors/*.ts` | Unit | Mock `fetch`, verify data extraction |
| `utils/fetcher.ts` | Unit | Mock `fetch`, test retry/timeout logic |
| `utils/date.ts` | Unit | Pure functions, no mocking needed |
| `db/client.ts` | Integration | `@cloudflare/vitest-pool-workers` provides real D1 |
| `tasks/generator.ts` | Integration | Workers pool with D1 + Queue bindings |
| `tasks/consumer.ts` | Integration | Workers pool, mock fetch calls |
| `aggregator/tools.ts` | Unit | Mock D1, verify tool execute shapes |
| `aggregator/aggregate.ts` | Unit | Mock `generateText`, verify prompts |
| `aggregator/weekly-aggregate.ts` | Unit | Mock `generateText`, verify weekly prompts |
| `aggregator/weekly-tools.ts` | Unit | Mock D1, verify weekly tool shapes |
| `aggregator/container.ts` | Unit | Mock `@cloudflare/containers`, verify retry logic (daily + weekly) |
| `container/server.ts` | Integration | IT test Phase 0 (real Node.js import check), Phase 4 (Docker smoke test) |
| `routes/home.tsx` | Integration | Workers pool, test HTTP + cursor pagination |
| `routes/report.tsx` | Integration | Workers pool, test HTTP report rendering |
| `i18n/index.ts` | Unit | Pure functions, no mocking needed |
| `pwa/manifest.ts` | Unit | Verify manifest shape |
| `pwa/sw.test.ts` | Unit | Read public/sw.js, verify caching logic |

### Example Test

```typescript
// src/utils/date.test.ts
import { describe, it, expect } from "vitest";
import { getTodayDateString } from "./date";

describe("getTodayDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = getTodayDateString();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns valid calendar date", () => {
    const date = getTodayDateString();
    const parsed = new Date(date + "T00:00:00Z");
    expect(parsed.toString()).not.toBe("Invalid Date");
  });
});
```

### TDD for Edge Cases

Every new function must have tests covering:
- **Happy path** — normal input produces expected output
- **Empty/null/undefined** — handles missing data gracefully
- **Error cases** — network failures, malformed data, timeouts
- **Boundary conditions** — max/min values, empty arrays, long strings

### Commit Policy — Always Ask First

**Never commit or push changes without explicit user confirmation.** For every request, you must ask the user whether to commit/push before running any `git commit` or `git push` command — even if the user confirmed a commit/push in a previous request within the same session. Each request/session is independent.

### Before Committing

```bash
npx tsc --noEmit && npx vitest run
```

Both MUST pass before asking the user to confirm a commit. If either fails, fix before asking.

When changing files in the container's import chain (`aggregator/aggregate.ts`, `aggregator/weekly-aggregate.ts`, `aggregator/tools.ts`, `aggregator/weekly-tools.ts`, `aggregator/llm.ts`, `aggregator/search.ts`, `utils/fetcher.ts`), also run IT test Phase 0 to verify no Workers-only imports leaked:

```bash
npm run it-test    # or at minimum, verify Phase 0 passes
```

---

## Coding Conventions

### All Code and Config in English (REQUIRED)

- **Variable names**, **function names**, **type/interface names**, **file names**, and **comments** must all be in English.
- **Configuration files** (`wrangler.toml`, `package.json`, `tsconfig.json`, `.env.example`) must use English keys, values, and comments.
- **Database schemas** (`schema.sql`) must use English table/column names and comments.
- **Exception**: i18n translation strings (`src/i18n/index.ts`) and LLM-generated bilingual content (Chinese reports/summaries) are the only places where Chinese is allowed.

### TypeScript
- Strict mode enabled (`tsconfig.json` → `"strict": true`)
- No `any` — use `unknown` and type guards
- Export interfaces for all data shapes (e.g., `ProductHuntItem`, `TaskMessage`)
- Use `const` assertions (`as const`) for string literal unions

### JSX
- Only `.tsx` files may contain JSX
- Use Hono's `FC` type for components: `import type { FC } from "hono/jsx"`
- Keep components pure — data fetching in route handlers, not components

### File naming
- `kebab-case` for files: `producthunt.ts`, `hackernews.ts`
- `PascalCase` for exported components/interfaces/types
- One export per file unless tightly coupled (e.g., a component + its props type)

### Imports
- No barrel exports (`index.ts` re-exporting everything) — they cause bundler issues in Workers
- Import directly from the source file
- Group imports: external → internal → types

### Database
- All D1 queries through `src/db/client.ts` — no raw SQL in route handlers
- Use parameterized queries (never string interpolation)
- `INSERT OR IGNORE` for idempotent writes
- `ON CONFLICT DO UPDATE` for upserts

### Environment Variables
- API keys: set via `npx wrangler secret put` (production) or `.dev.vars` (local)
- Non-secret config: in `wrangler.toml` `[vars]`
- Always provide fallback or explicit check for missing env vars
- Email uses `[[send_email]]` binding (no API key needed): configure via `npx wrangler email sending enable <domain>`

### No Comments Rule
- **Do not add comments** unless explicitly asked
- Code should be self-documenting through clear naming

---

## Testing Scrapers Locally

```bash
npm run test:scrapers
```

This runs `scripts/test-scrapers.ts` which tests all three scrapers against live websites and prints JSON output. Use this to verify scraper changes before deploying.

---

## i18n

- `src/i18n/index.ts` — translation dictionary (`en` / `zh`)
- `detectLang(request)`: `?lang=` param > `Accept-Language` header > default `en`
- All UI strings use `t(lang, key)`. Add new keys to both languages.
- LLM generates bilingual content encoded in tools: `saveSiteSummary(website, summaryEn, summaryZh)`, `saveFinalReport(reportEn, reportZh)`
- Newsletter keys: `newsletter.*` (subscribe form, confirmation, unsubscribe pages)

---

## PWA

- `public/` served as static assets via `[assets]` config
- Service worker at `public/sw.js` (cache-first, offline fallback to `/offline`)
- Registration via `public/register-sw.js`
- Manifest at `/manifest.json` (dynamically generated from `src/pwa/manifest.ts`)
- Static `public/site.webmanifest` as fallback
- Mobile: `public/pull-to-refresh.js` for pull-to-refresh gesture
- Icons: 192x192, 512x512 PNG + favicon.ico + apple-touch-icon

---

## Important Constraints

- **Cloudflare free tier**: Cron trigger must finish within 10ms CPU (only enqueue tasks, no I/O)
- **Queue consumer**: Up to 5-minute execution window — scrapers + aggregation run here
- **Container isolation**: `src/aggregator/aggregate.ts` and `src/aggregator/weekly-aggregate.ts` must NOT import `@cloudflare/containers` or `cloudflare:workers` — these modules don't exist in Node.js. The container server crashes on import if this is violated.
- **Container resources**: 0.0625 vCPU / 256 MiB — minimal; LLM tasks are network-I/O bound so this is sufficient.
- **Container networking**: Private mode — Docker image must have all dependencies pre-installed (no runtime `npm install`/`npx` downloads).
- **Container port**: 4000 (set via `defaultPort = 4000` on AggregatorContainer DO class).
- **Cheerio in Workers**: Requires `nodejs_compat` compatibility flag
- **Product Hunt**: Homepage HTML is Cloudflare-protected. Use Atom RSS feed at `/feed` instead
- **Hacker News**: Use official Firebase API (free, no auth, rate-limited at ~10k/hour)
- **GitHub Trending**: Server-rendered HTML, parsed with cheerio
- **DeepSeek**: Uses OpenAI-compatible API at `https://api.deepseek.com/v1`, model `deepseek-chat`
