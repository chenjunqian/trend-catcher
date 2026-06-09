import { Hono } from "hono";
import type {
  D1Database,
  Queue,
  ScheduledController,
  MessageBatch,
  DurableObjectNamespace,
} from "@cloudflare/workers-types";
import { Container } from "@cloudflare/containers";
import Home from "./routes/home";
import Report from "./routes/report";
import { getRecentSummaries, getRecentWeeklySummaries, getSummaryByDate, getWeeklySummaryByDate } from "./db/client";
import { generateAndEnqueueTasks, enqueueWeeklyTask } from "./tasks/generator";
import { queueConsumer } from "./tasks/consumer";
import { runAggregation } from "./aggregator/aggregate";
import { runWeeklyAggregation } from "./aggregator/weekly-aggregate";
import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "./aggregator/container";
import { sendDailyEmail, sendWeeklyEmail } from "./notifier/email";
import { getTodayDateString, getLastWeekMonday } from "./utils/date";
import { detectLang } from "./i18n";
import type { TaskMessage } from "./tasks/generator";
import { manifest } from "./pwa/manifest";

export class AggregatorContainer extends Container {
  defaultPort = 4000;
  sleepAfter = "20s";
}

type Bindings = {
  DB: D1Database;
  SCRAPE_QUEUE: Queue<TaskMessage>;
  AGGREGATOR_CONTAINER: DurableObjectNamespace;
  DEEPSEEK_API_KEY: string;
  RESEND_API_KEY: string;
  NOTIFICATION_EMAIL: string;
  INTERNAL_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);
  const dailyResult = await getRecentSummaries(DB, 30);
  const weeklyResult = await getRecentWeeklySummaries(DB, 10);

  return c.html(
    <Home
      dailySummaries={dailyResult.results ?? []}
      weeklySummaries={weeklyResult.results ?? []}
      lang={lang}
      path={c.req.path}
    />
  );
});

app.get("/reports/weekly/:date", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);
  const date = c.req.param("date");
  const summary = await getWeeklySummaryByDate(DB, date);

  if (!summary) {
    return c.notFound();
  }

  return c.html(<Report summary={summary} lang={lang} path={c.req.path} isWeekly={true} />);
});

app.get("/reports/:date", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);
  const date = c.req.param("date");
  const summary = await getSummaryByDate(DB, date);

  if (!summary) {
    return c.notFound();
  }

  return c.html(<Report summary={summary} lang={lang} path={c.req.path} />);
});

// Internal endpoint: manually trigger aggregation + email
app.post("/internal/aggregate", async (c) => {
  const { DB, AGGREGATOR_CONTAINER, DEEPSEEK_API_KEY, RESEND_API_KEY, NOTIFICATION_EMAIL, INTERNAL_SECRET } = c.env;

  const auth = c.req.header("Authorization") || "";
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!DEEPSEEK_API_KEY) {
    return c.json({ error: "DEEPSEEK_API_KEY not configured" }, 500);
  }

  const date = getTodayDateString();

  c.executionCtx.waitUntil(
    (async () => {
      try {
        if (AGGREGATOR_CONTAINER) {
          try {
            console.log("Starting container aggregation for", date);
            await triggerContainerAggregation(
              DB, AGGREGATOR_CONTAINER, RESEND_API_KEY, NOTIFICATION_EMAIL, date, DEEPSEEK_API_KEY
            );
            return;
          } catch (containerErr) {
            console.warn("Container aggregation failed, falling back to Worker:", (containerErr as Error).message);
          }
        }
        console.log("Starting direct aggregation for", date);
        await runAggregation(DB, DEEPSEEK_API_KEY, date);
        await sendDailyEmail(DB, RESEND_API_KEY, NOTIFICATION_EMAIL, date);
      } catch (err) {
        console.error("Aggregation failed:", err);
      }
    })()
  );

  return c.json({ ok: true, message: "Aggregation started" });
});

app.post("/internal/weekly-aggregate", async (c) => {
  const { DB, AGGREGATOR_CONTAINER, DEEPSEEK_API_KEY, RESEND_API_KEY, NOTIFICATION_EMAIL, INTERNAL_SECRET } = c.env;

  const auth = c.req.header("Authorization") || "";
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!DEEPSEEK_API_KEY) {
    return c.json({ error: "DEEPSEEK_API_KEY not configured" }, 500);
  }

  const weekStartDate = getLastWeekMonday();

  c.executionCtx.waitUntil(
    (async () => {
      try {
        if (AGGREGATOR_CONTAINER) {
          try {
            console.log("Starting container weekly aggregation for", weekStartDate);
            await triggerWeeklyContainerAggregation(
              DB, AGGREGATOR_CONTAINER, RESEND_API_KEY, NOTIFICATION_EMAIL, weekStartDate, DEEPSEEK_API_KEY
            );
            return;
          } catch (containerErr) {
            console.warn("Container weekly aggregation failed, falling back to Worker:", (containerErr as Error).message);
          }
        }
        console.log("Starting direct weekly aggregation for", weekStartDate);
        await runWeeklyAggregation(DB, DEEPSEEK_API_KEY, weekStartDate);
        await sendWeeklyEmail(DB, RESEND_API_KEY, NOTIFICATION_EMAIL, weekStartDate);
      } catch (err) {
        console.error("Weekly aggregation failed:", err);
      }
    })()
  );

  return c.json({ ok: true, message: "Weekly aggregation started" });
});

// PWA routes
app.get("/manifest.json", (c) => {
  return c.json(manifest);
});

app.get("/offline", (c) => {
  const lang = detectLang(c.req.raw);
  return c.html(
    <html lang={lang}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Offline — Trend Catcher</title>
        <style>{`
          body { font-family: sans-serif; background: #fff; color: #111; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .box { text-align: center; }
          .box h1 { font-size: 24px; color: #f78166; }
          .box p { color: #666; margin-top: 8px; }
        `}</style>
      </head>
      <body>
        <div class="box">
          <h1>📡 Offline</h1>
          <p>{lang === "zh" ? "您当前处于离线状态，请检查网络连接。" : "You are currently offline. Please check your connection."}</p>
        </div>
      </body>
    </html>
  );
});

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
    controller: ScheduledController,
    env: Bindings,
    _ctx: ExecutionContext
  ) {
    const { DB, SCRAPE_QUEUE } = env;

    if (controller.cron === "0 4 * * 0") {
      await enqueueWeeklyTask(DB, SCRAPE_QUEUE);
      console.log("Enqueued weekly task");
    } else {
      const count = await generateAndEnqueueTasks(DB, SCRAPE_QUEUE);
      console.log(`Enqueued ${count} scrape tasks`);
    }
  },
};
