import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import "./proxy";
import { fetchProductHuntTop10 } from "../src/tasks/processors/producthunt";
import { fetchHackerNewsTop30 } from "../src/tasks/processors/hackernews";
import { fetchGitHubTrending } from "../src/tasks/processors/github";
import { getTodayDateString } from "../src/utils/date";

const TASK_ID_PH = "producthunt_top10";
const TASK_ID_HN = "hackernews_top30";
const TASK_ID_GH = "github_trending";
const D1_DB = "trend-catcher-db";
const NOW = Math.floor(Date.now() / 1000);
const DATE = getTodayDateString();
const SECRET = "change-me-to-a-random-string";

function wrangler(sql: string) {
  const file = join(tmpdir(), `it-test-${Date.now()}.sql`);
  writeFileSync(file, sql);
  console.log(`  [D1] ${sql.slice(0, 80)}...`);
  try {
    execSync(
      `npx wrangler d1 execute ${D1_DB} --local --file=${file}`,
      { stdio: "pipe" }
    );
  } finally {
    unlinkSync(file);
  }
}

function insertTask(id: string, website: string, item: string, rawData: string) {
  const escaped = rawData.replace(/'/g, "''");
  wrangler(
    `INSERT OR REPLACE INTO scrape_tasks (id, scheduled_date, website, item, status, raw_data, created_at, updated_at) VALUES ('${DATE}_${id}', '${DATE}', '${website}', '${item}', 'completed', '${escaped}', ${NOW}, ${NOW});`
  );
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Trend Catcher — IT Test                    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Date: ${DATE}\n`);

  // ── Phase 1: Scrape ────────────────────────────
  console.log("── Phase 1: Scraping ──");

  let ph: unknown = [];
  let hn: unknown = [];
  let gh: unknown = [];

  try {
    console.log("  [PH]  Product Hunt...");
    ph = await fetchProductHuntTop10();
    console.log(`  [PH]  ✅ ${(ph as unknown[]).length} items`);
  } catch (err) {
    console.log(`  [PH]  ❌ ${(err as Error).message}`);
  }

  try {
    console.log("  [HN]  Hacker News...");
    hn = await fetchHackerNewsTop30();
    console.log(`  [HN]  ✅ ${(hn as unknown[]).length} items`);
  } catch (err) {
    console.log(`  [HN]  ❌ ${(err as Error).message}`);
  }

  try {
    console.log("  [GH]  GitHub Trending...");
    gh = await fetchGitHubTrending();
    console.log(`  [GH]  ✅ ${(gh as unknown[]).length} items`);
  } catch (err) {
    console.log(`  [GH]  ❌ ${(err as Error).message}`);
  }

  console.log("");

  // ── Phase 2: Reset + Insert into D1 ────────────
  console.log("── Phase 2: Writing to D1 ──");

  wrangler(`DELETE FROM scrape_tasks WHERE scheduled_date = '${DATE}';`);

  if (Array.isArray(ph) && ph.length > 0) {
    insertTask(TASK_ID_PH, "producthunt", "top10", JSON.stringify(ph));
  }
  if (Array.isArray(hn) && hn.length > 0) {
    insertTask(TASK_ID_HN, "hackernews", "top30", JSON.stringify(hn));
  }
  if (Array.isArray(gh) && gh.length > 0) {
    insertTask(TASK_ID_GH, "github", "trending", JSON.stringify(gh));
  }

  const taskCount = [ph, hn, gh].filter(
    (a) => Array.isArray(a) && (a as unknown[]).length > 0
  ).length;
  console.log(`  ✅ ${taskCount} tasks written to D1\n`);

  // ── Phase 3: Trigger aggregation ───────────────
  console.log("── Phase 3: Trigger aggregation ──");

  try {
    console.log("  Triggering AI agent loop (may take 30-60s)...");
    execSync(
      `curl -s -X POST http://localhost:8787/internal/aggregate -H "Content-Type: application/json" -H "Authorization: Bearer ${SECRET}"`,
      { stdio: "pipe" }
    );
    console.log("  ✅ Aggregation triggered!\n");
  } catch {
    console.log("  ⚠️  Could not reach server. Is 'npm run dev' running?");
    console.log("  Run this manually:");
    console.log(
      `    curl -s -X POST http://localhost:8787/internal/aggregate -H "Authorization: Bearer ${SECRET}"`
    );
  }
  console.log("");
  console.log("── Verify ──");
  console.log("  Open:  http://localhost:8787");
  console.log("  Check: your email for the report");
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   IT test setup complete! 🎉                 ║");
  console.log("╚══════════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("IT test failed:", err.message ?? err);
  process.exit(1);
});
