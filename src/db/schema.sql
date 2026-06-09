CREATE TABLE IF NOT EXISTS scrape_tasks (
    id TEXT PRIMARY KEY,
    scheduled_date TEXT NOT NULL,
    website TEXT NOT NULL,
    item TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    raw_data TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_date_website_status ON scrape_tasks (scheduled_date, website, status);
CREATE INDEX IF NOT EXISTS idx_date_website_item ON scrape_tasks (scheduled_date, website, item);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_date TEXT NOT NULL UNIQUE,      -- one row per date
    full_report_en TEXT NOT NULL DEFAULT '',-- English Markdown final report (1500-3000 chars)
    full_report_zh TEXT NOT NULL DEFAULT '',-- Chinese Markdown final report
    site_summaries TEXT DEFAULT '{}',       -- JSON: { "producthunt": {en,zh}, "hackernews": {en,zh}, ... }
    is_notified INTEGER DEFAULT 0,          -- 0 = not emailed, 1 = emailed
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start_date TEXT NOT NULL UNIQUE,   -- Monday date, e.g. "2026-06-01"
    full_report_en TEXT NOT NULL DEFAULT '',
    full_report_zh TEXT NOT NULL DEFAULT '',
    site_summaries TEXT DEFAULT '{}',       -- same JSON format as daily
    is_notified INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
