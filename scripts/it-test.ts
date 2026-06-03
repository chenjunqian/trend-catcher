import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import "./proxy";
import { fetchProductHuntTop20 } from "../src/tasks/processors/producthunt";
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

  // ── Phase 4: Docker smoke test ─────────────────
  console.log("\n── Phase 4: Container Docker test ──");

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
        console.log(`  [CT]  ✅ Endpoint responds: ${curlResult.split("\nHTTP:")[0]}`);
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
