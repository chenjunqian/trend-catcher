import type { D1Database } from "@cloudflare/workers-types";
import { getContainer } from "@cloudflare/containers";
import {
  getCompletedTasksByDate,
  upsertDailySummary,
  getDailySummariesForWeek,
  upsertWeeklySummary,
} from "../db/client";
import { getDateRangeForWeek } from "../utils/date";
import { createDeepSeekModel } from "./llm";
import { ensureCompleteSummary } from "./aggregate";
import { ensureCompleteWeeklySummary } from "./weekly-aggregate";
import type { EmailSender } from "../notifier/email";

function isNonRetryableError(errorText: string): boolean {
  return (
    errorText.includes("Container service disconnected") ||
    errorText.includes("Container port connection closed unexpectedly") ||
    errorText.includes("connection closed unexpectedly")
  );
}

async function fetchContainerWithRetry(
  container: ReturnType<typeof getContainer>,
  request: Request,
  logPrefix: string,
  errorLabel: string
): Promise<Response> {
  let containerResp: Response | undefined;
  let lastError = "";

  for (let attempt = 0; attempt < 6; attempt++) {
    const delay = attempt === 0 ? 0 : Math.pow(2, attempt) * 1000;
    if (delay > 0) {
      console.log(`[${logPrefix}] Retry ${attempt}/${5}, waiting ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const attemptStart = Date.now();
    try {
      containerResp = await container.fetch(request.clone());
      if (containerResp.ok) break;
      const errText = await containerResp.text();
      lastError = `HTTP ${containerResp.status}: ${errText.slice(0, 200)}`;
      console.log(`[${logPrefix}] Attempt ${attempt}: ${lastError}`);
    } catch (err) {
      lastError = (err as Error).message;
      console.log(`[${logPrefix}] Attempt ${attempt}: ${lastError}`);
    }

    if (isNonRetryableError(lastError) || (Date.now() - attemptStart > 30_000 && !containerResp?.ok)) {
      console.log(`[${logPrefix}] Aborting retries: ${lastError}`);
      break;
    }
  }

  if (!containerResp?.ok) {
    throw new Error(`${errorLabel} failed after retries: ${lastError}`);
  }

  return containerResp;
}

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
    googletrends: [],
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
  console.log(`[container-orch] Sending ${totalItems} items to container (ph=${rawData.producthunt.length}, hn=${rawData.hackernews.length}, gh=${rawData.github.length}, gt=${rawData.googletrends.length})`);

  const container = getContainer(containerBinding as Parameters<typeof getContainer>[0], "trend-catcher");

  const request = new Request("http://container/aggregate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, rawData, apiKey: deepseekApiKey }),
  });

  const containerResp = await fetchContainerWithRetry(
    container,
    request,
    "container-orch",
    "Container aggregation"
  );

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

  const model = createDeepSeekModel(deepseekApiKey);
  const completeness = await ensureCompleteSummary(db, model, date);
  if (!completeness.complete) {
    throw new Error(
      `Container aggregation incomplete for ${date}: missing sites [${completeness.missingSites.join(", ") || "none"}]${completeness.missingReport ? ", missing full report" : ""}`
    );
  }

  console.log("[container-orch] Summary validated, sending email");

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

  const containerResp = await fetchContainerWithRetry(
    container,
    request,
    "container-orch:weekly",
    "Weekly container aggregation"
  );

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

  const model = createDeepSeekModel(deepseekApiKey);
  const completeness = await ensureCompleteWeeklySummary(db, model, weekStartDate);
  if (!completeness.complete) {
    throw new Error(
      `Weekly container aggregation incomplete for ${weekStartDate}: missing sites [${completeness.missingSites.join(", ") || "none"}]${completeness.missingReport ? ", missing full report" : ""}`
    );
  }

  console.log("[container-orch:weekly] Summary validated, sending email");

  const baseUrl = "https://trendcatcher.guoshaotech.com";
  const { sendWeeklyEmail } = await import("../notifier/email");
  await sendWeeklyEmail(db, emailSender, weekStartDate, baseUrl);

  console.log("[container-orch:weekly] Email sent");
}
