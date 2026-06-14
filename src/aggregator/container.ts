import type { D1Database } from "@cloudflare/workers-types";
import { getContainer } from "@cloudflare/containers";
import {
  getCompletedTasksByDate,
  upsertDailySummary,
  getDailySummariesForWeek,
  upsertWeeklySummary,
} from "../db/client";
import { getDateRangeForWeek } from "../utils/date";
import type { EmailSender } from "../notifier/email";

export async function triggerContainerAggregation(
  db: D1Database,
  containerBinding: unknown,
  emailSender: EmailSender,
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

  const container = getContainer(containerBinding as Parameters<typeof getContainer>[0], "trend-catcher");

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

  const baseUrl = "https://trendcatcher.guoshaotech.com";
  const { sendDailyEmail } = await import("../notifier/email");
  await sendDailyEmail(db, emailSender, date, baseUrl);

  console.log("[container-orch] Email sent");
}

export async function triggerWeeklyContainerAggregation(
  db: D1Database,
  containerBinding: unknown,
  emailSender: EmailSender,
  weekStartDate: string,
  deepseekApiKey: string
) {
  console.log("[container-orch:weekly] Reading daily summaries for week", weekStartDate);

  const weekDates = getDateRangeForWeek(weekStartDate);
  const weekEndDate = weekDates[6];
  const dailyResult = await getDailySummariesForWeek(db, weekStartDate, weekEndDate);

  const dailySummaries = (dailyResult.results ?? []).map((s) => ({
    summary_date: s.summary_date,
    full_report_en: s.full_report_en,
    full_report_zh: s.full_report_zh,
    site_summaries: s.site_summaries,
  }));

  console.log(`[container-orch:weekly] Sending ${dailySummaries.length} daily summaries to container`);

  if (dailySummaries.length === 0) {
    console.log("[container-orch:weekly] No daily summaries found for this week, skipping aggregation");
    return;
  }

  const container = getContainer(containerBinding as Parameters<typeof getContainer>[0], "trend-catcher");

  const request = new Request("http://container/aggregate-weekly", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weekStartDate, dailySummaries, apiKey: deepseekApiKey }),
  });

  let containerResp: Response | undefined;
  let lastError = "";

  for (let attempt = 0; attempt < 6; attempt++) {
    const delay = attempt === 0 ? 0 : Math.pow(2, attempt) * 1000;
    if (delay > 0) {
      console.log(`[container-orch:weekly] Retry ${attempt}/${5}, waiting ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      containerResp = await container.fetch(request.clone());
      if (containerResp.ok) break;
      const errText = await containerResp.text();
      lastError = `HTTP ${containerResp.status}: ${errText.slice(0, 200)}`;
      console.log(`[container-orch:weekly] Attempt ${attempt}: ${lastError}`);
    } catch (err) {
      lastError = (err as Error).message;
      console.log(`[container-orch:weekly] Attempt ${attempt}: ${lastError}`);
    }
  }

  if (!containerResp?.ok) {
    throw new Error(`Weekly container aggregation failed after retries: ${lastError}`);
  }

  const containerResult = (await containerResp.json()) as {
    success: boolean;
    siteSummaries: Record<string, { en: string; zh: string }>;
    reportEn: string;
    reportZh: string;
  };

  console.log(`[container-orch:weekly] Got results: ${Object.keys(containerResult.siteSummaries).length} sites`);

  await upsertWeeklySummary(db, {
    week_start_date: weekStartDate,
    site_summaries: JSON.stringify(containerResult.siteSummaries),
    full_report_en: containerResult.reportEn,
    full_report_zh: containerResult.reportZh,
  });

  console.log("[container-orch:weekly] Saved to D1, sending email");

  const baseUrl = "https://trendcatcher.guoshaotech.com";
  const { sendWeeklyEmail } = await import("../notifier/email");
  await sendWeeklyEmail(db, emailSender, weekStartDate, baseUrl);

  console.log("[container-orch:weekly] Email sent");
}
