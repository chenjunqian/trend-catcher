# AGENTS.md — Trend Catcher

## Project Overview

**Trend Catcher** (猎趋) is an AI-powered daily trend aggregator for indie developers. It scrapes Product Hunt, Hacker News, and GitHub Trending every day, generates bilingual (EN/ZH) summaries via an LLM agent loop, and delivers them via email and a web dashboard.

- **Runtime**: Cloudflare Workers
- **Web framework**: Hono.js (JSX server-side rendering)
- **DB**: Cloudflare D1 (SQLite)
- **Queue**: Cloudflare Queues
- **Cron**: Daily at UTC 1:00 AM
- **LLM**: DeepSeek (via `@ai-sdk/openai` → `api.deepseek.com/v1`)
- **Email**: Resend
- **Language**: TypeScript (strict mode), all code and configuration in English

---

## Architecture

```
Cron Trigger (UTC 1:00)
  → generator.ts: creates scrape tasks in D1 + enqueues to scrape-queue
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
Orchestrator saves to D1 + sends email
      ↓
Web Dashboard (Hono JSX)
  → GET /          : list of daily reports
  → GET /reports/:date : detailed bilingual report
  → i18n: ?lang=en / ?lang=zh / Accept-Language header
```

## Key Design Notes

- **DeepSeek cache optimization**: System prompt and first user message are completely static (no dates, no dynamic data). Only tool results contain dynamic content. This maximizes prefix cache hits and reduces API costs.
- **Idempotency**: Queue consumer checks `status === 'pending'` before processing. Tasks use `INSERT OR IGNORE`.
- **Completion detection**: After each batch, checks `getPendingTaskCountForDate()`. Failed tasks don't block aggregation.
- **Container module isolation (CRITICAL)**: `src/aggregator/aggregate.ts` must NOT import any Workers-only modules (`@cloudflare/containers`, `cloudflare:workers`). It is shared between the Worker and the Container (Node.js) runtime. Workers-only imports live in `src/aggregator/container.ts` which is only imported by the Worker. The IT test Phase 0 enforces this.
- **Container retry logic**: Uses `container.fetch()` in a 6-attempt exponential backoff loop instead of `startAndWaitForPorts()` to work around a `@cloudflare/containers` race condition where `getTcpPort()` throws before the Firecracker VM reaches "running" state.

---

## Project Structure

```
trend-catcher/
├── wrangler.toml              # CF Workers config (D1, Queue, Cron, Assets, Containers)
├── Dockerfile                 # Container image (Node.js 22 Alpine, tsx runtime)
├── package.json
├── tsconfig.json
├── .dev.vars                  # Local env vars (gitignored)
├── .env.example               # Env var template
├── AGENTS.md                  # This file
├── public/                    # Static assets (icons, manifest)
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   └── android-chrome-512x512.png
├── scripts/
│   ├── test-scrapers.ts       # Manual scraper test runner
│   ├── it-test.ts             # Full integration test (Phase 0: module check → Phase 4: Docker smoke)
│   └── proxy.ts               # Auto-detect https_proxy for local dev
├── src/
│   ├── index.tsx              # Hono app entry (routes, queue, cron, PWA, AggregatorContainer DO)
│   ├── db/
│   │   ├── schema.sql         # D1 table definitions
│   │   └── client.ts          # D1 query helpers (CRUD)
│   ├── tasks/
│   │   ├── generator.ts       # Cron handler: creates + enqueues tasks
│   │   ├── consumer.ts        # Queue consumer: processes + triggers aggregation
│   │   └── processors/
│   │       ├── producthunt.ts # Atom RSS feed parser (Cloudflare blocks HTML)
│   │       ├── hackernews.ts  # Firebase API (free, no auth)
│   │       └── github.ts      # cheerio HTML scraper
│   ├── aggregator/
│   │   ├── llm.ts             # DeepSeek provider setup
│   │   ├── tools.ts           # Agent tools (createAgentTools for Worker, createInMemoryAgentTools for Container)
│   │   ├── aggregate.ts       # Agent loop: runAgentLoop, runAggregation (shared, NO Workers-only imports)
│   │   ├── container.ts       # Container orchestrator: triggerContainerAggregation (Workers-only imports OK)
│   │   └── search.ts          # DuckDuckGo HTML search (shared)
│   ├── container/
│   │   └── server.ts          # Container Node.js HTTP server (imports from aggregator/, no Workers deps)
│   ├── notifier/
│   │   └── email.ts           # Resend email with bilingual report
│   ├── routes/
│   │   ├── layout.tsx         # Layout component (PWA meta, dark theme, lang switch)
│   │   ├── home.tsx           # GET / — report list
│   │   └── report.tsx         # GET /reports/:date — bilingual report detail
│   ├── pwa/
│   │   ├── manifest.ts        # PWA manifest JSON
│   │   └── sw.ts              # Service worker (cache-first, offline fallback)
│   ├── i18n/
│   │   └── index.ts           # Translations, lang detection
│   └── utils/
│       ├── date.ts            # Date formatting
│       └── fetcher.ts         # HTTP fetch with retry + timeout
└── migrations/                # (future) D1 migration files
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

# Full integration test (Phase 0: container module check → Phase 4: Docker smoke test)
npm run it-test

# Local D1 operations
npm run db:migrate:local       # Run schema.sql on local D1
npx wrangler d1 execute trend-catcher-db --local --command="SELECT ..."

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

### Test File Convention

```
src/
├── tasks/
│   ├── processors/
│   │   ├── producthunt.ts
│   │   ├── producthunt.test.ts      # <— alongside source
│   │   ├── hackernews.ts
│   │   ├── hackernews.test.ts
│   │   ├── github.ts
│   │   └── github.test.ts
│   ├── generator.ts
│   ├── generator.test.ts
│   ├── consumer.ts
│   └── consumer.test.ts
├── aggregator/
│   ├── aggregate.ts
│   └── aggregate.test.ts
│   ├── tools.ts
│   └── tools.test.ts
...
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
| `aggregator/container.ts` | Unit | Mock `@cloudflare/containers`, verify retry logic |
| `container/server.ts` | Integration | IT test Phase 0 (real Node.js import check), Phase 4 (Docker smoke test) |
| `routes/*.tsx` | Integration | Workers pool, test HTTP responses |
| `i18n/index.ts` | Unit | Pure functions, no mocking needed |
| `pwa/*.ts` | Unit | Verify manifest shape, SW content |

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

### Before Committing

```bash
npx tsc --noEmit && npx vitest run
```

Both MUST pass. If either fails, fix before committing.

When changing files in the container's import chain (`aggregator/aggregate.ts`, `aggregator/tools.ts`, `aggregator/llm.ts`, `aggregator/search.ts`, `utils/fetcher.ts`), also run IT test Phase 0 to verify no Workers-only imports leaked:

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

---

## PWA

- `public/` served as static assets via `[assets]` config
- Service worker at `/sw.js` (cache-first, offline fallback to `/offline`)
- Manifest at `/manifest.json` (dynamically generated for proper name/description)
- Icons: 192x192, 512x512 PNG + favicon.ico + apple-touch-icon

---

## Important Constraints

- **Cloudflare free tier**: Cron trigger must finish within 10ms CPU (only enqueue tasks, no I/O)
- **Queue consumer**: Up to 5-minute execution window — scrapers + aggregation run here
- **Container isolation**: `src/aggregator/aggregate.ts` must NOT import `@cloudflare/containers` or `cloudflare:workers` — these modules don't exist in Node.js. The container server crashes on import if this is violated.
- **Container resources**: 0.0625 vCPU / 256 MiB — minimal; LLM tasks are network-I/O bound so this is sufficient.
- **Container networking**: Private mode — Docker image must have all dependencies pre-installed (no runtime `npm install`/`npx` downloads).
- **Cheerio in Workers**: Requires `nodejs_compat` compatibility flag
- **Product Hunt**: Homepage HTML is Cloudflare-protected. Use Atom RSS feed at `/feed` instead
- **Hacker News**: Use official Firebase API (free, no auth, rate-limited at ~10k/hour)
- **GitHub Trending**: Server-rendered HTML, parsed with cheerio
- **DeepSeek**: Uses OpenAI-compatible API at `https://api.deepseek.com/v1`, model `deepseek-chat`
