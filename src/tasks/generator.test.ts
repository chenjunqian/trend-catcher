import { describe, it, expect, vi } from "vitest";
import type { Queue } from "@cloudflare/workers-types";
import { generateAndEnqueueTasks, enqueueWeeklyTask, type TaskMessage } from "./generator";
import { mockD1, newStmt } from "../test-utils/d1-mock";

function mockQueue() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: vi.fn().mockResolvedValue(undefined),
  };
}

describe("generateAndEnqueueTasks", () => {
  it("creates and enqueues tasks for all 3 websites", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const queue = mockQueue();

    const count = await generateAndEnqueueTasks(db, queue as unknown as Queue<TaskMessage>);

    expect(count).toBe(3);
    expect(queue.sendBatch).toHaveBeenCalledTimes(1);

    const calls = (queue.sendBatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calls).toHaveLength(3);
    expect(calls[0].body.website).toBe("producthunt");
    expect(calls[1].body.website).toBe("hackernews");
    expect(calls[2].body.website).toBe("github");
  });

  it("uses today's date for task generation", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const queue = mockQueue();

    await generateAndEnqueueTasks(db, queue as unknown as Queue<TaskMessage>);

    const calls = (queue.sendBatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const todayPattern = /^\d{4}-\d{2}-\d{2}$/;
    expect(calls[0].body.scheduled_date).toMatch(todayPattern);
  });

  it("batches D1 inserts", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const queue = mockQueue();

    await generateAndEnqueueTasks(db, queue as unknown as Queue<TaskMessage>);

    expect(m.batch).toHaveBeenCalledTimes(1);
  });
});

describe("enqueueWeeklyTask", () => {
  it("enqueues a single weekly message with correct shape", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const queue = mockQueue();

    await enqueueWeeklyTask(db, queue as unknown as Queue<TaskMessage>);

    expect(queue.send).toHaveBeenCalledTimes(1);
    const message = (queue.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as TaskMessage;
    expect(message.type).toBe("weekly");
    expect(message.website).toBe("weekly");
    expect(message.item).toBe("report");
    expect(message.scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("generates an id containing the week start date", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const queue = mockQueue();

    await enqueueWeeklyTask(db, queue as unknown as Queue<TaskMessage>);

    const message = (queue.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as TaskMessage;
    expect(message.id).toContain("_weekly_report");
    expect(message.id).toMatch(/^\d{4}-\d{2}-\d{2}_weekly_report$/);
  });

  it("inserts task into D1 with INSERT OR IGNORE", async () => {
    const s = newStmt();
    const m = mockD1(s);
    const db = m as unknown as D1Database;
    const queue = mockQueue();

    await enqueueWeeklyTask(db, queue as unknown as Queue<TaskMessage>);

    expect(m.prepare).toHaveBeenCalled();
    const sqlArg = (m.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sqlArg).toContain("INSERT OR IGNORE");
    expect(sqlArg).toContain("scrape_tasks");
  });
});
