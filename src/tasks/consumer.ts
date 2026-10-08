// Queue consumer: processes scrape tasks, then triggers aggregation when all tasks complete.

import type { D1Database, MessageBatch, DurableObjectNamespace, Queue, SendEmail } from "@cloudflare/workers-types";
import {
  getTaskById,
  updateTaskToProcessing,
  updateTaskStatus,
  getPendingTaskCountForDate,
} from "../db/client";
import { fetchProductHuntTop20 } from "./processors/producthunt";
import { fetchHackerNewsTop30 } from "./processors/hackernews";
import { fetchGitHubTrending } from "./processors/github";
import { fetchGoogleTrends } from "./processors/googletrends";
import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "../aggregator/container";
import { runAggregation } from "../aggregator/aggregate";
import { runWeeklyAggregation } from "../aggregator/weekly-aggregate";
import { sendDailyEmail, sendWeeklyEmail } from "../notifier/email";
import type { TaskMessage } from "./generator";

export interface Env {
  DB: D1Database;
  SCRAPE_QUEUE: Queue<TaskMessage>;
  AGGREGATOR_CONTAINER?: DurableObjectNamespace;
  DEEPSEEK_API_KEY: string;
  EMAIL: SendEmail;
}

const BASE_URL = "https://trendcatcher.guoshaotech.com";

async function processTask(
  db: D1Database,
  message: TaskMessage
): Promise<void> {
  // Idempotency: skip if already processed
  const existing = await getTaskById(db, message.id);
  if (!existing || existing.status !== "pending") {
    return;
  }

  await updateTaskToProcessing(db, message.id);

  try {
    let rawData: unknown;

    switch (message.website) {
      case "producthunt":
        rawData = await fetchProductHuntTop20();
        break;
      case "hackernews":
        rawData = await fetchHackerNewsTop30();
        break;
      case "github":
        rawData = await fetchGitHubTrending();
        break;
      case "googletrends":
        rawData = await fetchGoogleTrends();
        break;
      case "weekly":
        await updateTaskStatus(db, message.id, "completed");
        return;
      default:
        throw new Error(`Unknown website: ${message.website}`);
    }

    await updateTaskStatus(
      db,
      message.id,
      "completed",
      JSON.stringify(rawData)
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateTaskStatus(db, message.id, "failed", undefined, errorMessage);
    throw err;
  }
}

export async function queueConsumer(
  batch: MessageBatch<TaskMessage>,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  if (batch.messages.length === 0) return;

  const dailyAggregateMessages = batch.messages.filter(
    (m) => m.body.type === "manual-daily" || m.body.type === "aggregate"
  );
  const weeklyAggregateMessages = batch.messages.filter(
    (m) => m.body.type === "manual-weekly"
  );
  const weeklyMessages = batch.messages.filter((m) => m.body.type === "weekly");
  const dailyMessages = batch.messages.filter(
    (m) =>
      m.body.type !== "weekly" &&
      m.body.type !== "manual-daily" &&
      m.body.type !== "manual-weekly" &&
      m.body.type !== "aggregate"
  );

  // Process daily scrape tasks
  if (dailyMessages.length > 0) {
    await Promise.all(
      dailyMessages.map(async (msg) => {
        try {
          await processTask(env.DB, msg.body);
          msg.ack();
        } catch {
          msg.retry();
        }
      })
    );

    const date = dailyMessages[0].body.scheduled_date;
    const remaining = await getPendingTaskCountForDate(env.DB, date);

    if (remaining === 0) {
      await enqueueAggregateTask(env, ctx, date);
    }
  }

  // Process daily aggregation requests (manual or enqueued after scraping)
  for (const msg of dailyAggregateMessages) {
    try {
      await triggerAggregation(env, msg.body.scheduled_date);
      msg.ack();
    } catch (err) {
      console.error(`Daily aggregation failed for ${msg.body.scheduled_date}:`, err);
      msg.retry();
    }
  }

  // Process weekly aggregation requests
  for (const msg of weeklyAggregateMessages) {
    try {
      await triggerWeeklyAggregation(env, msg.body.scheduled_date);
      msg.ack();
    } catch (err) {
      console.error(`Weekly aggregation failed for ${msg.body.scheduled_date}:`, err);
      msg.retry();
    }
  }

  // Process weekly tasks
  for (const msg of weeklyMessages) {
    const weekStartDate = msg.body.scheduled_date;

    const mondayDate = new Date(weekStartDate + "T00:00:00Z");
    const sundayDate = new Date(mondayDate);
    sundayDate.setUTCDate(mondayDate.getUTCDate() + 6);
    const sundayStr = sundayDate.toISOString().slice(0, 10);

    const sundayRemaining = await getPendingTaskCountForDate(env.DB, sundayStr);
    if (sundayRemaining > 0) {
      msg.retry();
      continue;
    }

    try {
      await processTask(env.DB, msg.body);
      await triggerWeeklyAggregation(env, weekStartDate);
      msg.ack();
    } catch {
      msg.retry();
    }
  }
}

async function enqueueAggregateTask(
  env: Env,
  ctx: ExecutionContext,
  date: string
): Promise<void> {
  try {
    await env.SCRAPE_QUEUE.send({
      id: `${date}_aggregate`,
      scheduled_date: date,
      website: "aggregate",
      item: "aggregate",
      type: "aggregate",
    });
    console.log(`Enqueued aggregate task for ${date}`);
  } catch (err) {
    console.error("Failed to enqueue aggregate task, running aggregation in-process:", err);
    ctx.waitUntil(
      triggerAggregation(env, date).catch((aggregationErr) => {
        console.error("In-process aggregation failed:", aggregationErr);
      })
    );
  }
}

async function triggerAggregation(env: Env, date: string): Promise<void> {
  try {
    console.log("All tasks completed, starting aggregation...");
    console.log("Using container for aggregation");
    await triggerContainerAggregation(
      env.DB,
      env.AGGREGATOR_CONTAINER!,
      env.EMAIL,
      date,
      env.DEEPSEEK_API_KEY
    );
    return;
  } catch (err) {
    console.error("Container aggregation failed, falling back to direct Worker aggregation:", err);
  }

  await runAggregation(env.DB, env.DEEPSEEK_API_KEY, date);
  await sendDailyEmail(env.DB, env.EMAIL, date, BASE_URL);
}

async function triggerWeeklyAggregation(env: Env, weekStartDate: string): Promise<void> {
  try {
    console.log("Starting weekly aggregation...");
    console.log("Using container for weekly aggregation");
    await triggerWeeklyContainerAggregation(
      env.DB,
      env.AGGREGATOR_CONTAINER!,
      env.EMAIL,
      weekStartDate,
      env.DEEPSEEK_API_KEY
    );
    return;
  } catch (err) {
    console.error("Weekly container aggregation failed, falling back to direct Worker weekly aggregation:", err);
  }

  await runWeeklyAggregation(env.DB, env.DEEPSEEK_API_KEY, weekStartDate);
  await sendWeeklyEmail(env.DB, env.EMAIL, weekStartDate, BASE_URL);
}
