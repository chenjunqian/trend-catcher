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
import Home from "./routes/home";
import Report from "./routes/report";
import { ConfirmPage, UnsubscribePage, UnsubscribeSuccessPage, NotFoundPage } from "./routes/newsletter";
import { getRecentSummaries, getRecentWeeklySummaries, getSummaryByDate, getWeeklySummaryByDate } from "./db/client";
import { subscribeEmail, confirmSubscription, unsubscribeByToken, getSubscriberByToken } from "./db/client";
import { generateAndEnqueueTasks, enqueueWeeklyTask } from "./tasks/generator";
import { queueConsumer } from "./tasks/consumer";
import { runAggregation } from "./aggregator/aggregate";
import { runWeeklyAggregation } from "./aggregator/weekly-aggregate";
import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "./aggregator/container";
import { sendDailyEmail, sendWeeklyEmail } from "./notifier/email";
import { getTodayDateString, getLastWeekMonday } from "./utils/date";
import { detectLang, t } from "./i18n";
import type { TaskMessage } from "./tasks/generator";
import { manifest } from "./pwa/manifest";

export class AggregatorContainer extends Container {
  defaultPort = 4000;
  sleepAfter = "20s";
}

const BASE_URL = "https://trendcatcher.guoshaotech.com";

type Bindings = {
  DB: D1Database;
  SCRAPE_QUEUE: Queue<TaskMessage>;
  AGGREGATOR_CONTAINER: DurableObjectNamespace;
  DEEPSEEK_API_KEY: string;
  EMAIL: SendEmail;
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/subscribe", async (c) => {
  const { DB, EMAIL } = c.env;
  const lang = detectLang(c.req.raw);

  let body: { email?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: t(lang, "newsletter.invalid_email") }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return c.json({ error: t(lang, "newsletter.invalid_email") }, 400);
  }

  const token = crypto.randomUUID();

  try {
    await subscribeEmail(DB, email, lang, token);

    const confirmUrl = `${BASE_URL}/api/confirm?token=${encodeURIComponent(token)}&lang=${lang}`;
    await EMAIL.send({
      to: email,
      from: { email: "trendcatcher@guoshaotech.com", name: "Trend Catcher" },
      subject: t(lang, "email.confirm_subject"),
      html: `<p>${lang === "zh" ? "请点击以下链接确认订阅猎趋：" : "Please click the link below to confirm your subscription:"}</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
      text: `${lang === "zh" ? "请点击以下链接确认订阅猎趋：" : "Please click the link below to confirm your subscription:"} ${confirmUrl}`,
    });
  } catch (err) {
    const e = err as Error;
    console.error("[subscribe] Failed:", e.message);
    return c.json({ error: t(lang, "newsletter.already_exists") }, 409);
  }

  return c.json({ ok: true, message: t(lang, "newsletter.sub_success") });
});

app.get("/api/confirm", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);

  const token = c.req.query("token") ?? "";
  if (!token) {
    return c.html(<NotFoundPage lang={lang} path={c.req.path} />, 404);
  }

  const result = await confirmSubscription(DB, token);
  if (!result.meta.changes) {
    return c.html(<NotFoundPage lang={lang} path={c.req.path} />, 404);
  }

  return c.html(<ConfirmPage lang={lang} path={c.req.path} />);
});

app.get("/unsubscribe", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);

  const token = c.req.query("token") ?? "";
  if (!token) {
    return c.html(<NotFoundPage lang={lang} path={c.req.path} />, 404);
  }

  const subscriber = await getSubscriberByToken(DB, token);
  if (!subscriber) {
    return c.html(<NotFoundPage lang={lang} path={c.req.path} />, 404);
  }

  return c.html(<UnsubscribePage lang={lang} path={c.req.path} token={token} />);
});

app.post("/api/unsubscribe", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);

  let body: { token?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    try {
      const formData = await c.req.formData();
      body = { token: formData.get("token")?.toString() ?? "" };
    } catch {
      return c.html(<NotFoundPage lang={lang} path={c.req.path} />, 404);
    }
  }

  const token = body.token ?? "";
  if (!token) {
    return c.html(<NotFoundPage lang={lang} path={c.req.path} />, 404);
  }

  await unsubscribeByToken(DB, token);

  return c.html(<UnsubscribeSuccessPage lang={lang} path={c.req.path} />);
});

// Internal endpoint: manually trigger aggregation + email
app.post("/internal/aggregate", async (c) => {
  const { DB, AGGREGATOR_CONTAINER, DEEPSEEK_API_KEY, EMAIL, INTERNAL_SECRET } = c.env;

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
              DB, AGGREGATOR_CONTAINER, EMAIL, date, DEEPSEEK_API_KEY
            );
            return;
          } catch (containerErr) {
            console.warn("Container aggregation failed, falling back to Worker:", (containerErr as Error).message);
          }
        }
        console.log("Starting direct aggregation for", date);
        await runAggregation(DB, DEEPSEEK_API_KEY, date);
        await sendDailyEmail(DB, EMAIL, date, BASE_URL);
      } catch (err) {
        console.error("Aggregation failed:", err);
      }
    })()
  );

  return c.json({ ok: true, message: "Aggregation started" });
});

app.post("/internal/weekly-aggregate", async (c) => {
  const { DB, AGGREGATOR_CONTAINER, DEEPSEEK_API_KEY, EMAIL, INTERNAL_SECRET } = c.env;

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
              DB, AGGREGATOR_CONTAINER, EMAIL, weekStartDate, DEEPSEEK_API_KEY
            );
            return;
          } catch (containerErr) {
            console.warn("Container weekly aggregation failed, falling back to Worker:", (containerErr as Error).message);
          }
        }
        console.log("Starting direct weekly aggregation for", weekStartDate);
        await runWeeklyAggregation(DB, DEEPSEEK_API_KEY, weekStartDate);
        await sendWeeklyEmail(DB, EMAIL, weekStartDate, BASE_URL);
      } catch (err) {
        console.error("Weekly aggregation failed:", err);
      }
    })()
  );

  return c.json({ ok: true, message: "Weekly aggregation started" });
});

app.post("/internal/send-email", async (c) => {
  const { DB, EMAIL, INTERNAL_SECRET } = c.env;

  const auth = c.req.header("Authorization") || "";
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { date?: string; type?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { date, type } = body;

  if (!date || !type) {
    return c.json({ error: "date and type are required" }, 400);
  }
  if (type !== "daily" && type !== "weekly") {
    return c.json({ error: "type must be 'daily' or 'weekly'" }, 400);
  }

  console.log(`[internal] Manual send-email requested: type=${type} date=${date}`);

  const success = type === "daily"
    ? await sendDailyEmail(DB, EMAIL, date, BASE_URL)
    : await sendWeeklyEmail(DB, EMAIL, date, BASE_URL);

  if (!success) {
    return c.json({ ok: false, error: "Email send failed — check logs for details" }, 500);
  }

  return c.json({ ok: true, message: `Email sent for ${type} ${date}` });
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
