import "./proxy";
import { fetchProductHuntTop20 } from "../src/tasks/processors/producthunt";
import { fetchHackerNewsTop30 } from "../src/tasks/processors/hackernews";
import { fetchGitHubTrending } from "../src/tasks/processors/github";

function summary(data: unknown): string {
  if (Array.isArray(data)) {
    return `${data.length} items`;
  }
  return JSON.stringify(data).slice(0, 100);
}

async function test(name: string, fn: () => Promise<unknown>) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Testing: ${name}`);
  console.log(`${"=".repeat(60)}`);
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - start;
    console.log(`  Status: ✅ Success (${elapsed}ms, ${summary(result)})`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.log(`  Status: ❌ Failed (${elapsed}ms)`);
    console.error(`  Error: ${err.message ?? err}`);
    if (err.stack) {
      console.error(`  Stack: ${err.stack.split("\n").slice(0, 5).join("\n  ")}`);
    }
  }
}

(async () => {
  console.log("Starting scraper tests...\n");

  await test("Product Hunt Top 20", fetchProductHuntTop20);
  await test("Hacker News Top 30", fetchHackerNewsTop30);
  await test("GitHub Trending", fetchGitHubTrending);

  console.log(`\n${"=".repeat(60)}`);
  console.log("  All tests complete.");
  console.log(`${"=".repeat(60)}\n`);
})();
