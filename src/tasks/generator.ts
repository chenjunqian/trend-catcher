// Task generation and enqueueing for the daily cron trigger.
// Runs at UTC 1:00 AM each day, creates scrape tasks and pushes them to the queue.

import type { D1Database, Queue } from "@cloudflare/workers-types";
import { getTodayDateString, getLastWeekMonday } from "../utils/date";
import { createTasksBatch } from "../db/client";

export interface TaskMessage {
  id: string;
  scheduled_date: string;
  website: string;
  item: string;
  type?: "weekly" | "manual-daily" | "manual-weekly";
}

const WEBSITES = ["producthunt", "hackernews", "github"] as const;

function generateTaskId(website: string, item: string, date: string): string {
  return `${date}_${website}_${item}`;
}

function generateTasks(date: string): TaskMessage[] {
  const tasks: TaskMessage[] = [];

  for (const website of WEBSITES) {
    switch (website) {
      case "producthunt":
        tasks.push({
          id: generateTaskId(website, "top10", date),
          scheduled_date: date,
          website,
          item: "top10",
        });
        break;

      case "hackernews":
        tasks.push({
          id: generateTaskId(website, "top30", date),
          scheduled_date: date,
          website,
          item: "top30",
        });
        break;

      case "github":
        tasks.push({
          id: generateTaskId(website, "trending", date),
          scheduled_date: date,
          website,
          item: "trending",
        });
        break;
    }
  }

  return tasks;
}

// Generates all daily scrape tasks, inserts them into D1, and sends to the queue.
export async function generateAndEnqueueTasks(
  db: D1Database,
  scrapeQueue: Queue<TaskMessage>
): Promise<number> {
  const date = getTodayDateString();
  const tasks = generateTasks(date);

  await createTasksBatch(db, tasks);

  await scrapeQueue.sendBatch(
    tasks.map((t) => ({
      body: t,
      contentType: "json",
    }))
  );

  return tasks.length;
}

export async function enqueueWeeklyTask(
  db: D1Database,
  scrapeQueue: Queue<TaskMessage>
): Promise<void> {
  const weekStartDate = getLastWeekMonday();
  const message: TaskMessage = {
    id: `${weekStartDate}_weekly_report`,
    scheduled_date: weekStartDate,
    website: "weekly",
    item: "report",
    type: "weekly",
  };

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT OR IGNORE INTO scrape_tasks (id, scheduled_date, website, item, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    )
    .bind(message.id, message.scheduled_date, message.website, message.item, now, now)
    .run();

  await scrapeQueue.send(message);

  console.log(`Enqueued weekly task for week ${weekStartDate}`);
}
