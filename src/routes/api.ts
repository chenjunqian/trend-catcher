import { Hono } from "hono";
import { subscribeEmail, getHomeTimeline } from "../db/client";
import { runAggregation } from "../aggregator/aggregate";
import { runWeeklyAggregation } from "../aggregator/weekly-aggregate";
import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "../aggregator/container";
import { sendDailyEmail, sendWeeklyEmail } from "../notifier/email";
import { getTodayDateString, getLastWeekMonday } from "../utils/date";
import { detectLang, t } from "../i18n";
import type { Bindings } from "../index";

const BASE_URL = "https://trendcatcher.guoshaotech.com";
const PAGE_SIZE = 20;

const api = new Hono<{ Bindings: Bindings }>();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

api.get("/api/timeline", async (c) => {
  const { DB } = c.env;
  const cursorStr = c.req.query("cursor");
  const cursor = cursorStr ? parseInt(cursorStr, 10) : undefined;

  const result = await getHomeTimeline(DB, cursor, PAGE_SIZE);
  const rows = result.results ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].created_at) : null;

  return c.json({ items, nextCursor });
});

api.post("/api/subscribe", async (c) => {
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

api.post("/internal/aggregate", async (c) => {
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

api.post("/internal/weekly-aggregate", async (c) => {
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

api.post("/internal/send-email", async (c) => {
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

export default api;
