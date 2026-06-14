// Queue consumer: processes scrape tasks, then triggers aggregation when all tasks complete.

import type { D1Database, MessageBatch, DurableObjectNamespace, SendEmail } from "@cloudflare/workers-types";
import {
  getTaskById,
  updateTaskToProcessing,
  updateTaskStatus,
  getPendingTaskCountForDate,
} from "../db/client";
import { fetchProductHuntTop20 } from "./processors/producthunt";
import { fetchHackerNewsTop30 } from "./processors/hackernews";
import { fetchGitHubTrending } from "./processors/github";
import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "../aggregator/container";
import type { TaskMessage } from "./generator";

export interface Env {
  DB: D1Database;
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
  const firstMsg = batch.messages[0];
  if (!firstMsg) return;

  if (firstMsg.body.type === "manual-daily") {
    const date = firstMsg.body.scheduled_date;
    firstMsg.ack();
    ctx.waitUntil(triggerAggregation(env, date));
    return;
  }

  if (firstMsg.body.type === "manual-weekly") {
    const weekStartDate = firstMsg.body.scheduled_date;
    firstMsg.ack();
    ctx.waitUntil(triggerWeeklyAggregation(env, weekStartDate));
    return;
  }

  if (firstMsg.body.type === "weekly") {
    const weekStartDate = firstMsg.body.scheduled_date;

    // Compute the Sunday of this week (6 days after Monday)
    const mondayDate = new Date(weekStartDate + "T00:00:00Z");
    const sundayDate = new Date(mondayDate);
    sundayDate.setUTCDate(mondayDate.getUTCDate() + 6);
    const sundayStr = sundayDate.toISOString().slice(0, 10);

    // Wait until Sunday's daily scrape tasks are done
    const sundayRemaining = await getPendingTaskCountForDate(env.DB, sundayStr);
    if (sundayRemaining > 0) {
      firstMsg.retry();
      return;
    }

    try {
      await processTask(env.DB, firstMsg.body);
      firstMsg.ack();
      ctx.waitUntil(triggerWeeklyAggregation(env, weekStartDate));
    } catch {
      firstMsg.retry();
    }
    return;
  }

  const promises = batch.messages.map(async (msg) => {
    try {
      await processTask(env.DB, msg.body);
      msg.ack();
    } catch {
      msg.retry();
    }
  });

  await Promise.all(promises);

  // Check if all tasks for today are done
  const date = firstMsg.body.scheduled_date;
  const remaining = await getPendingTaskCountForDate(env.DB, date);

  if (remaining === 0) {
    ctx.waitUntil(triggerAggregation(env, date));
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
  } catch (err) {
    console.error("Aggregation failed:", err);
  }
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
  } catch (err) {
    console.error("Weekly aggregation failed:", err);
  }
}
