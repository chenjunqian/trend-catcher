import type { D1Database } from "@cloudflare/workers-types";

export interface ScrapeTask {
  id: string;
  scheduled_date: string;
  website: string;
  item: string;
  status: "pending" | "processing" | "completed" | "failed";
  raw_data: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

export interface DailySummary {
  id: number;
  summary_date: string;
  full_report_en: string;
  full_report_zh: string;
  site_summaries: string;
  is_notified: number;
  created_at: number;
  updated_at: number;
}

export interface WeeklySummary {
  id: number;
  week_start_date: string;
  full_report_en: string;
  full_report_zh: string;
  site_summaries: string;
  is_notified: number;
  created_at: number;
  updated_at: number;
}

export function createTask(
  db: D1Database,
  task: {
    id: string;
    scheduled_date: string;
    website: string;
    item: string;
  }
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `INSERT OR IGNORE INTO scrape_tasks (id, scheduled_date, website, item, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    )
    .bind(task.id, task.scheduled_date, task.website, task.item, now, now)
    .run();
}

export function createTasksBatch(
  db: D1Database,
  tasks: { id: string; scheduled_date: string; website: string; item: string }[]
) {
  const now = Math.floor(Date.now() / 1000);
  const stmts = tasks.map((t) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO scrape_tasks (id, scheduled_date, website, item, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`
      )
      .bind(t.id, t.scheduled_date, t.website, t.item, now, now)
  );
  return db.batch(stmts);
}

export function updateTaskStatus(
  db: D1Database,
  id: string,
  status: ScrapeTask["status"],
  raw_data?: string,
  error_message?: string
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `UPDATE scrape_tasks
       SET status = ?, raw_data = ?, error_message = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(status, raw_data ?? null, error_message ?? null, now, id)
    .run();
}

export function updateTaskToProcessing(
  db: D1Database,
  id: string
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `UPDATE scrape_tasks
       SET status = 'processing', updated_at = ?
       WHERE id = ? AND status = 'pending'`
    )
    .bind(now, id)
    .run();
}

export function getTaskById(
  db: D1Database,
  id: string
): Promise<ScrapeTask | null> {
  return db
    .prepare("SELECT * FROM scrape_tasks WHERE id = ?")
    .bind(id)
    .first<ScrapeTask>();
}

export function getCompletedTasksByDateAndWebsite(
  db: D1Database,
  date: string,
  website: string
): Promise<D1Result<ScrapeTask>> {
  return db
    .prepare(
      "SELECT * FROM scrape_tasks WHERE scheduled_date = ? AND website = ? AND status = 'completed'"
    )
    .bind(date, website)
    .all();
}

export function getCompletedTasksByDate(
  db: D1Database,
  date: string
): Promise<D1Result<ScrapeTask>> {
  return db
    .prepare(
      "SELECT * FROM scrape_tasks WHERE scheduled_date = ? AND status = 'completed'"
    )
    .bind(date)
    .all();
}

export function getPendingTaskCountForDate(
  db: D1Database,
  date: string
): Promise<number> {
  return db
    .prepare(
      "SELECT COUNT(*) as count FROM scrape_tasks WHERE scheduled_date = ? AND status != 'completed' AND status != 'failed'"
    )
    .bind(date)
    .first<{ count: number }>()
    .then((r) => r?.count ?? 0);
}

export function upsertDailySummary(
  db: D1Database,
  summary: {
    summary_date: string;
    full_report_en?: string;
    full_report_zh?: string;
    site_summaries?: string;
    is_notified?: number;
  }
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `INSERT INTO daily_summaries (summary_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(summary_date) DO UPDATE SET
         full_report_en = COALESCE(?, full_report_en),
         full_report_zh = COALESCE(?, full_report_zh),
         site_summaries = COALESCE(?, site_summaries),
         is_notified = COALESCE(?, is_notified),
         updated_at = ?`
    )
    .bind(
      summary.summary_date,
      summary.full_report_en ?? "",
      summary.full_report_zh ?? "",
      summary.site_summaries ?? "{}",
      summary.is_notified ?? 0,
      now,
      now,
      summary.full_report_en ?? null,
      summary.full_report_zh ?? null,
      summary.site_summaries ?? null,
      summary.is_notified ?? null,
      now
    )
    .run();
}

export function getSummaryByDate(
  db: D1Database,
  date: string
): Promise<DailySummary | null> {
  return db
    .prepare("SELECT * FROM daily_summaries WHERE summary_date = ?")
    .bind(date)
    .first<DailySummary>();
}

export function getRecentSummaries(
  db: D1Database,
  limit: number = 30
): Promise<D1Result<DailySummary>> {
  return db
    .prepare(
      "SELECT id, summary_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at FROM daily_summaries ORDER BY summary_date DESC LIMIT ?"
    )
    .bind(limit)
    .all();
}

export function updateSummaryNotified(db: D1Database, date: string) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      "UPDATE daily_summaries SET is_notified = 1, updated_at = ? WHERE summary_date = ?"
    )
    .bind(now, date)
    .run();
}

export function upsertWeeklySummary(
  db: D1Database,
  summary: {
    week_start_date: string;
    full_report_en?: string;
    full_report_zh?: string;
    site_summaries?: string;
    is_notified?: number;
  }
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `INSERT INTO weekly_summaries (week_start_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(week_start_date) DO UPDATE SET
         full_report_en = COALESCE(?, full_report_en),
         full_report_zh = COALESCE(?, full_report_zh),
         site_summaries = COALESCE(?, site_summaries),
         is_notified = COALESCE(?, is_notified),
         updated_at = ?`
    )
    .bind(
      summary.week_start_date,
      summary.full_report_en ?? "",
      summary.full_report_zh ?? "",
      summary.site_summaries ?? "{}",
      summary.is_notified ?? 0,
      now,
      now,
      summary.full_report_en ?? null,
      summary.full_report_zh ?? null,
      summary.site_summaries ?? null,
      summary.is_notified ?? null,
      now
    )
    .run();
}

export function getWeeklySummaryByDate(
  db: D1Database,
  weekStartDate: string
): Promise<WeeklySummary | null> {
  return db
    .prepare("SELECT * FROM weekly_summaries WHERE week_start_date = ?")
    .bind(weekStartDate)
    .first<WeeklySummary>();
}

export function getRecentWeeklySummaries(
  db: D1Database,
  limit: number = 10
): Promise<D1Result<WeeklySummary>> {
  return db
    .prepare(
      "SELECT id, week_start_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at FROM weekly_summaries ORDER BY week_start_date DESC LIMIT ?"
    )
    .bind(limit)
    .all();
}

export function getDailySummariesForWeek(
  db: D1Database,
  weekStartDate: string,
  weekEndDate: string
): Promise<D1Result<DailySummary>> {
  return db
    .prepare(
      "SELECT * FROM daily_summaries WHERE summary_date >= ? AND summary_date <= ? ORDER BY summary_date ASC"
    )
    .bind(weekStartDate, weekEndDate)
    .all();
}

export function updateWeeklySummaryNotified(db: D1Database, weekStartDate: string) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      "UPDATE weekly_summaries SET is_notified = 1, updated_at = ? WHERE week_start_date = ?"
    )
    .bind(now, weekStartDate)
    .run();
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  lang: "en" | "zh";
  unsubscribe_token: string;
  is_confirmed: number;
  created_at: number;
  confirmed_at: number | null;
}

export function subscribeEmail(
  db: D1Database,
  email: string,
  lang: string,
  token: string
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `INSERT INTO newsletter_subscribers (email, lang, unsubscribe_token, is_confirmed, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(email) DO UPDATE SET
         lang = ?,
         unsubscribe_token = ?,
         is_confirmed = 0,
         created_at = ?`
    )
    .bind(email, lang, token, now, lang, token, now)
    .run();
}

export function confirmSubscription(
  db: D1Database,
  token: string
) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      "UPDATE newsletter_subscribers SET is_confirmed = 1, confirmed_at = ? WHERE unsubscribe_token = ? AND is_confirmed = 0"
    )
    .bind(now, token)
    .run();
}

export function unsubscribeByToken(
  db: D1Database,
  token: string
) {
  return db
    .prepare(
      "DELETE FROM newsletter_subscribers WHERE unsubscribe_token = ?"
    )
    .bind(token)
    .run();
}

export function getSubscriberByToken(
  db: D1Database,
  token: string
): Promise<NewsletterSubscriber | null> {
  return db
    .prepare("SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ?")
    .bind(token)
    .first<NewsletterSubscriber>();
}

export function getAllConfirmedSubscribers(
  db: D1Database
): Promise<D1Result<NewsletterSubscriber>> {
  return db
    .prepare("SELECT * FROM newsletter_subscribers WHERE is_confirmed = 1")
    .all();
}

export interface HomeTimelineItem {
  type: "daily" | "weekly";
  display_date: string;
  created_at: number;
  full_report_en: string;
  full_report_zh: string;
}

export function getHomeTimeline(
  db: D1Database,
  cursor?: number,
  limit: number = 20
): Promise<D1Result<HomeTimelineItem>> {
  const fetchLimit = limit + 1;

  if (cursor) {
    return db
      .prepare(
        `SELECT * FROM (
           SELECT 'daily' as type, summary_date as display_date, created_at, full_report_en, full_report_zh
           FROM daily_summaries
           UNION ALL
           SELECT 'weekly' as type, week_start_date as display_date, created_at, full_report_en, full_report_zh
           FROM weekly_summaries
         )
         WHERE created_at < ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(cursor, fetchLimit)
      .all();
  }

  return db
    .prepare(
      `SELECT * FROM (
         SELECT 'daily' as type, summary_date as display_date, created_at, full_report_en, full_report_zh
         FROM daily_summaries
         UNION ALL
         SELECT 'weekly' as type, week_start_date as display_date, created_at, full_report_en, full_report_zh
         FROM weekly_summaries
       )
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(fetchLimit)
    .all();
}
