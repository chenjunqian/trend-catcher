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
    summary_date TEXT NOT NULL UNIQUE,
    full_report_en TEXT NOT NULL DEFAULT '',
    full_report_zh TEXT NOT NULL DEFAULT '',
    site_summaries TEXT DEFAULT '{}',
    is_notified INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
