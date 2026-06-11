import { Hono } from "hono";
import type {
  D1Database,
  Queue,
  ScheduledController,
  MessageBatch,
  DurableObjectNamespace,
  SendEmail,
} from "@cloudflare/workers-types";
import { Container } from "@cloudflare/containers";
import pages from "./routes/pages";
import api from "./routes/api";
import { generateAndEnqueueTasks, enqueueWeeklyTask } from "./tasks/generator";
import { queueConsumer } from "./tasks/consumer";
import type { TaskMessage } from "./tasks/generator";

export class AggregatorContainer extends Container {
  defaultPort = 4000;
  sleepAfter = "20s";
}

export type Bindings = {
  DB: D1Database;
  SCRAPE_QUEUE: Queue<TaskMessage>;
  AGGREGATOR_CONTAINER: DurableObjectNamespace;
  DEEPSEEK_API_KEY: string;
  EMAIL: SendEmail;
  INTERNAL_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", pages);
app.route("/", api);

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch<TaskMessage>,
    env: Bindings,
    ctx: ExecutionContext
  ) {
    await queueConsumer(batch, env, ctx);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    _ctx: ExecutionContext
  ) {
    const { DB, SCRAPE_QUEUE } = env;

    const count = await generateAndEnqueueTasks(DB, SCRAPE_QUEUE);
    console.log(`Enqueued ${count} scrape tasks`);

    if (new Date().getUTCDay() === 0) {
      await enqueueWeeklyTask(DB, SCRAPE_QUEUE);
      console.log("Enqueued weekly task (Sunday)");
    }
  },
};
