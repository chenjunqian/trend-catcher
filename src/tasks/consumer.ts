// Queue consumer: processes scrape tasks, then triggers aggregation when all tasks complete.

import type { D1Database, MessageBatch } from "@cloudflare/workers-types";
import {
  getTaskById,
  updateTaskToProcessing,
  updateTaskStatus,
  getPendingTaskCountForDate,
} from "../db/client";
import { fetchProductHuntTop20 } from "./processors/producthunt";
import { fetchHackerNewsTop30 } from "./processors/hackernews";
import { fetchGitHubTrending } from "./processors/github";
import { runAggregation } from "../aggregator/aggregate";
import { sendDailyEmail } from "../notifier/email";
import type { TaskMessage } from "./generator";

export interface Env {
  DB: D1Database;
  DEEPSEEK_API_KEY: string;
  RESEND_API_KEY: string;
  NOTIFICATION_EMAIL: string;
}

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
  const firstMsg = batch.messages[0];
  if (firstMsg) {
    const date = firstMsg.body.scheduled_date;
    const remaining = await getPendingTaskCountForDate(env.DB, date);

    if (remaining === 0) {
      ctx.waitUntil(triggerAggregation(env, date));
    }
  }
}

async function triggerAggregation(env: Env, date: string): Promise<void> {
  try {
    console.log("All tasks completed, starting aggregation...");
    await runAggregation(env.DB, env.DEEPSEEK_API_KEY, date);
    console.log("Aggregation complete, sending email...");

    await sendDailyEmail(env.DB, env.RESEND_API_KEY, env.NOTIFICATION_EMAIL, date);
    console.log("Email sent");
  } catch (err) {
    console.error("Aggregation failed:", err);
  }
}
