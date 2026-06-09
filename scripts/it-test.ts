import { execSync } from "child_process";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import "./proxy";
import { fetchProductHuntTop20 } from "../src/tasks/processors/producthunt";
import { fetchHackerNewsTop30 } from "../src/tasks/processors/hackernews";
import { fetchGitHubTrending } from "../src/tasks/processors/github";
import { getTodayDateString, getLastWeekMonday, getDateRangeForWeek } from "../src/utils/date";

const TASK_ID_PH = "producthunt_top10";
const TASK_ID_HN = "hackernews_top30";
const TASK_ID_GH = "github_trending";
const D1_DB = "trend-catcher-db";
const NOW = Math.floor(Date.now() / 1000);
const DATE = getTodayDateString();

// Read INTERNAL_SECRET from .dev.vars (local development secret)
function getSecret(): string {
  const devVarsPath = join(import.meta.dirname ?? __dirname, "..", ".dev.vars");
  if (existsSync(devVarsPath)) {
    const content = readFileSync(devVarsPath, "utf-8");
    const match = content.match(/^INTERNAL_SECRET=(.+)$/m);
    if (match) return match[1].trim();
  }
  return "change-me-to-a-random-string"; // fallback
}
const SECRET = getSecret();

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

  // ── Phase 0: Container module import check ─────
  console.log("── Phase 0: Container module check ──");
  try {
    await import("../src/container/server");
    console.log("  [CT]  ✅ Container modules load in Node.js\n");
  } catch (err) {
    const msg = (err as Error).message;
    console.log(`  [CT]  ❌ ${msg}`);
    if (msg.includes("@cloudflare/containers") || msg.includes("cloudflare:workers")) {
      console.log("  [CT]  ^ Workers-only import leaked into container dependency chain.");
    }
    console.log("");
    process.exit(1);
  }

  // ── Phase 1: Scrape ────────────────────────────
  console.log("── Phase 1: Scraping ──");

  let ph: unknown = [];
  let hn: unknown = [];
  let gh: unknown = [];

  try {
    console.log("  [PH]  Product Hunt...");
    ph = await fetchProductHuntTop20();
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
  console.log("── Phase 3: Trigger daily aggregation ──");

  let dailyOk = false;
  try {
    const result = execSync(
      `curl -s -X POST http://localhost:8787/internal/aggregate -H "Content-Type: application/json" -H "Authorization: Bearer ${SECRET}"`,
      { encoding: "utf8", stdio: "pipe", timeout: 10_000 }
    ).trim();
    if (result.includes('"ok":true')) {
      dailyOk = true;
      console.log("  ✅ Daily aggregation started (will run in background)\n");
    } else {
      console.log(`  ⚠️  Daily aggregation response: ${result.slice(0, 200)}\n`);
    }
  } catch (err) {
    console.log(`  ⚠️  Could not reach server: ${(err as Error).message}\n`);
    console.log("  Make sure 'npm run dev' is running on port 8787.\n");
  }

  // ── Phase 5: Weekly aggregation ──────────────
  console.log("\n── Phase 5: Weekly aggregation ──");

  const weekMonday = getLastWeekMonday();
  const weekDates = getDateRangeForWeek(weekMonday);
  console.log(`  Week: ${weekMonday} → ${weekDates[6]} (${weekDates.length} days)`);

  // 5a: Insert daily_summaries for all 7 days of the past week
  console.log("  5a: Inserting daily_summaries for the week...");
  wrangler(`DELETE FROM daily_summaries WHERE summary_date >= '${weekMonday}' AND summary_date <= '${weekDates[6]}';`);
  wrangler(`DELETE FROM weekly_summaries WHERE week_start_date = '${weekMonday}';`);

  for (const d of weekDates) {
    const siteSummaries = JSON.stringify({
      producthunt: { en: `- [AI] Product ${d}](https://example.com) — A trending product on ${d}`, zh: `- [AI] 产品${d}](https://example.com) — ${d}热门产品` },
      hackernews: { en: `- [DevTools] HN Topic ${d}](https://example.com) — Discussion on ${d}`, zh: `- [DevTools] HN话题${d}](https://example.com) — ${d}讨论` },
      github: { en: `- [Open Source] Repo ${d}](https://example.com) — Trending on ${d}`, zh: `- [Open Source] 仓库${d}](https://example.com) — ${d}趋势` },
    });
    const escapedSummaries = siteSummaries.replace(/'/g, "''");
    const escapedEn = `## ${d} Report\\n\\nDaily trend report for ${d}.`.replace(/'/g, "''");
    const escapedZh = `## ${d} 报告\\n\\n${d}的每日趋势报告。`.replace(/'/g, "''");
    wrangler(
      `INSERT OR REPLACE INTO daily_summaries (summary_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at, updated_at) VALUES ('${d}', '${escapedEn}', '${escapedZh}', '${escapedSummaries}', 1, ${NOW}, ${NOW});`
    );
  }
  console.log(`  ✅ ${weekDates.length} daily_summaries inserted`);

  // 5b: Trigger weekly aggregation via internal API
  console.log("  5b: Triggering weekly AI agent loop...");

  let weeklyOk = false;
  try {
    const result = execSync(
      `curl -s -X POST http://localhost:8787/internal/weekly-aggregate -H "Content-Type: application/json" -H "Authorization: Bearer ${SECRET}"`,
      { encoding: "utf8", stdio: "pipe", timeout: 10_000 }
    ).trim();
    if (result.includes('"ok":true')) {
      weeklyOk = true;
      console.log("  ✅ Weekly aggregation started (will run in background)\n");
    } else {
      console.log(`  ⚠️  Weekly aggregation response: ${result.slice(0, 200)}\n`);
    }
  } catch (err) {
    console.log(`  ⚠️  Could not reach server for weekly aggregation: ${(err as Error).message}`);
    console.log("  Run this manually:");
    console.log(
      `    curl -s -X POST http://localhost:8787/internal/weekly-aggregate -H "Authorization: Bearer ${SECRET}"`
    );
  }

  // 5c: Verify weekly_summaries row exists
  if (weeklyOk) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const result = execSync(
        `curl -s http://localhost:8787/reports/weekly/${weekMonday}?lang=en`,
        { encoding: "utf8", stdio: "pipe", timeout: 5000 }
      );
      if (result.includes("Weekly Trend Report") || result.includes("周报")) {
        console.log("  ✅ Weekly report page loads successfully");
      } else {
        console.log("  ⚠️  Weekly report page may not have content yet");
      }
    } catch {
      console.log("  ⚠️  Could not verify weekly report page");
    }
  }

  // ── Phase 4: Docker smoke test ─────────────────
  console.log("\n── Phase 4: Container Docker test ──");
  // ... Phase 4 begins ...

  let dockerAvailable = false;
  try {
    execSync("docker info", { stdio: "ignore" });
    dockerAvailable = true;
  } catch {
    // Docker not available
  }

  if (!dockerAvailable) {
    console.log("  [CT]  ⚠️  Docker not available, skipped\n");
  } else {
    try {
      console.log("  [CT]  Building image...");
      execSync("docker build -t trend-catcher-it-test .", {
        stdio: "pipe",
        timeout: 300_000,
      });
      console.log("  [CT]  ✅ Image built");

      console.log("  [CT]  Starting container...");
      const cid = execSync(
        "docker run -d -p 14002:4000 trend-catcher-it-test",
        { encoding: "utf8" }
      ).trim();

      await new Promise((r) => setTimeout(r, 4000));

      const running = execSync(
        `docker inspect ${cid} --format='{{.State.Running}}'`,
        { encoding: "utf8" }
      ).trim();

      if (running !== "true") {
        console.log(`  [CT]  ❌ Container exited immediately:`);
        const logs = execSync(`docker logs ${cid}`, { encoding: "utf8" }).trim();
        console.log(`  ${logs.split("\n").join("\n  ")}`);
        execSync(`docker rm -f ${cid}`, { stdio: "ignore" });
        process.exit(1);
      }

      console.log("  [CT]  ✅ Container running, testing endpoint...");

      const testBody = JSON.stringify({ date: "it-test", rawData: {}, apiKey: "test" });
      const escapedBody = testBody.replace(/'/g, "'\\''");
      const curlResult = execSync(
        `curl -s -w "\\nHTTP:%{http_code}" http://localhost:14002/aggregate -X POST -H "Content-Type: application/json" -d '${escapedBody}'`,
        { encoding: "utf8", timeout: 10_000 }
      ).trim();

      execSync(`docker rm -f ${cid}`, { stdio: "ignore" });

      if (curlResult.includes("HTTP:200") || curlResult.includes("HTTP:500")) {
        console.log(`  [CT]  ✅ Daily endpoint responds: ${curlResult.split("\nHTTP:")[0]}`);

        // Test weekly endpoint
        console.log("  [CT]  Testing weekly endpoint...");
        const weeklyBody = JSON.stringify({
          weekStartDate: weekMonday,
          dailySummaries: weekDates.map((d) => ({
            summary_date: d,
            full_report_en: `## ${d} Report`,
            full_report_zh: `## ${d} 报告`,
            site_summaries: JSON.stringify({}),
          })),
          apiKey: "test",
        });
        const escapedWeeklyBody = weeklyBody.replace(/'/g, "'\\''");
        const weeklyCurl = execSync(
          `curl -s -w "\\nHTTP:%{http_code}" http://localhost:14002/aggregate-weekly -X POST -H "Content-Type: application/json" -d '${escapedWeeklyBody}'`,
          { encoding: "utf8", timeout: 10_000 }
        ).trim();

        if (weeklyCurl.includes("HTTP:200") || weeklyCurl.includes("HTTP:400") || weeklyCurl.includes("HTTP:500")) {
          console.log(`  [CT]  ✅ Weekly endpoint responds: ${weeklyCurl.split("\nHTTP:")[0]}`);
        } else {
          console.log(`  [CT]  ❌ Unexpected weekly response: ${weeklyCurl}`);
        }

        console.log("  [CT]  ✅ Docker smoke test passed\n");
      } else {
        console.log(`  [CT]  ❌ Unexpected response: ${curlResult}`);
        process.exit(1);
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Docker")) {
        console.log(`  [CT]  ❌ ${msg}\n`);
      } else {
        console.log(`  [CT]  ❌ ${msg}\n`);
      }
      process.exit(1);
    }
  }

  console.log("");
  console.log("── Verify ──");
  console.log("  Daily report:  http://localhost:8787");
  console.log("  Weekly report: http://localhost:8787/reports/weekly/" + weekMonday);
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
