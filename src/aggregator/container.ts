import type { D1Database } from "@cloudflare/workers-types";
import { getContainer } from "@cloudflare/containers";
import {
  getCompletedTasksByDate,
  upsertDailySummary,
} from "../db/client";

export async function triggerContainerAggregation(
  db: D1Database,
  containerBinding: unknown,
  resendApiKey: string,
  notificationEmail: string,
  date: string,
  deepseekApiKey: string
) {
  console.log("[container-orch] Reading completed tasks for", date);
  const result = await getCompletedTasksByDate(db, date);

  const rawData: Record<string, unknown[]> = {
    producthunt: [],
    hackernews: [],
    github: [],
  };

  for (const task of result.results ?? []) {
    if (!task.raw_data) continue;
    try {
      rawData[task.website] = rawData[task.website] || [];
      rawData[task.website].push(JSON.parse(task.raw_data));
    } catch {
      // skip unparseable
    }
  }

  const totalItems = Object.values(rawData).reduce((s, arr) => s + arr.length, 0);
  console.log(`[container-orch] Sending ${totalItems} items to container (ph=${rawData.producthunt.length}, hn=${rawData.hackernews.length}, gh=${rawData.github.length})`);

  const container = getContainer(containerBinding as Parameters<typeof getContainer>[0], "daily");

  const request = new Request("http://container/aggregate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, rawData, apiKey: deepseekApiKey }),
  });

  let containerResp: Response | undefined;
  let lastError = "";

  for (let attempt = 0; attempt < 6; attempt++) {
    const delay = attempt === 0 ? 0 : Math.pow(2, attempt) * 1000;
    if (delay > 0) {
      console.log(`[container-orch] Retry ${attempt}/${5}, waiting ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      containerResp = await container.fetch(request.clone());
      if (containerResp.ok) break;
      const errText = await containerResp.text();
      lastError = `HTTP ${containerResp.status}: ${errText.slice(0, 200)}`;
      console.log(`[container-orch] Attempt ${attempt}: ${lastError}`);
    } catch (err) {
      lastError = (err as Error).message;
      console.log(`[container-orch] Attempt ${attempt}: ${lastError}`);
    }
  }

  if (!containerResp?.ok) {
    throw new Error(`Container aggregation failed after retries: ${lastError}`);
  }

  const containerResult = (await containerResp.json()) as {
    success: boolean;
    siteSummaries: Record<string, { en: string; zh: string }>;
    reportEn: string;
    reportZh: string;
  };

  console.log(`[container-orch] Got results: ${Object.keys(containerResult.siteSummaries).length} sites`);

  await upsertDailySummary(db, {
    summary_date: date,
    site_summaries: JSON.stringify(containerResult.siteSummaries),
    full_report_en: containerResult.reportEn,
    full_report_zh: containerResult.reportZh,
  });

  console.log("[container-orch] Saved to D1, sending email");

  const { sendDailyEmail } = await import("../notifier/email");
  await sendDailyEmail(db, resendApiKey, notificationEmail, date);

  console.log("[container-orch] Email sent");
}
