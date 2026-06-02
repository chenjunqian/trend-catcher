import { Hono } from "hono";
import type {
  D1Database,
  Queue,
  ScheduledController,
  MessageBatch,
} from "@cloudflare/workers-types";
import Home from "./routes/home";
import Report from "./routes/report";
import { getRecentSummaries, getSummaryByDate } from "./db/client";
import { generateAndEnqueueTasks } from "./tasks/generator";
import { queueConsumer } from "./tasks/consumer";
import { runAggregation } from "./aggregator/aggregate";
import { sendDailyEmail } from "./notifier/email";
import { getTodayDateString } from "./utils/date";
import { detectLang } from "./i18n";
import type { TaskMessage } from "./tasks/generator";
import { manifest } from "./pwa/manifest";

type Bindings = {
  DB: D1Database;
  SCRAPE_QUEUE: Queue<TaskMessage>;
  DEEPSEEK_API_KEY: string;
  RESEND_API_KEY: string;
  NOTIFICATION_EMAIL: string;
  INTERNAL_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);
  const result = await getRecentSummaries(DB, 30);

  return c.html(
    <Home summaries={result.results ?? []} lang={lang} path={c.req.path} />
  );
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
  const { DB, DEEPSEEK_API_KEY, RESEND_API_KEY, NOTIFICATION_EMAIL, INTERNAL_SECRET } = c.env;

  const auth = c.req.header("Authorization") || "";
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!DEEPSEEK_API_KEY) {
    return c.json({ error: "DEEPSEEK_API_KEY not configured" }, 500);
  }

  c.executionCtx.waitUntil(
    (async () => {
      try {
        const date = getTodayDateString();
        console.log("Starting aggregation for", date);
        await runAggregation(DB, DEEPSEEK_API_KEY, date);
        console.log("Aggregation complete, sending email");

        await sendDailyEmail(DB, RESEND_API_KEY, NOTIFICATION_EMAIL, date);
        console.log("Email sent");
      } catch (err) {
        console.error("Aggregation failed:", err);
      }
    })()
  );

  return c.json({ ok: true, message: "Aggregation started" });
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
          body { font-family: sans-serif; background: #0f1117; color: #e1e4e8; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .box { text-align: center; }
          .box h1 { font-size: 24px; color: #f78166; }
          .box p { color: #8b949e; margin-top: 8px; }
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
    _controller: ScheduledController,
    env: Bindings,
    _ctx: ExecutionContext
  ) {
    const { DB, SCRAPE_QUEUE } = env;
    const count = await generateAndEnqueueTasks(DB, SCRAPE_QUEUE);
    console.log(`Enqueued ${count} scrape tasks`);
  },
};
