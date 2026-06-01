// Task generation and enqueueing for the daily cron trigger.
// Runs at UTC 1:00 AM each day, creates scrape tasks and pushes them to the queue.

import type { D1Database, Queue } from "@cloudflare/workers-types";
import { getTodayDateString } from "../utils/date";
import { createTasksBatch } from "../db/client";

export interface TaskMessage {
  id: string;
  scheduled_date: string;
  website: string;
  item: string;
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
