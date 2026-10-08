import { Hono } from "hono";
import type { Queue } from "@cloudflare/workers-types";
import { subscribeEmail, getHomeTimeline } from "../db/client";
import { sendDailyEmail, sendWeeklyEmail } from "../notifier/email";
import { getTodayDateString, getLastWeekMonday } from "../utils/date";
import { detectLang, t } from "../i18n";
import type { Bindings } from "../index";
import type { TaskMessage } from "../tasks/generator";

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
      html: `<div style="font-family: Charter, Georgia, 'TsangerJinKai02', 'Source Han Serif SC', 'Songti SC', Georgia, serif; background: #f5f4ed; color: #141413; padding: 24px; line-height: 1.55;"><p style="margin: 0 0 12px;">${lang === "zh" ? "请点击以下链接确认订阅猎趋：" : "Please click the link below to confirm your subscription:"}</p><p style="margin: 0;"><a href="${confirmUrl}" style="color: #1B365D;">${confirmUrl}</a></p></div>`,
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
  const { DB, SCRAPE_QUEUE, INTERNAL_SECRET } = c.env;

  const auth = c.req.header("Authorization") || "";
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const date = getTodayDateString();
  const queue = SCRAPE_QUEUE as unknown as Queue<TaskMessage>;

  let body: { date?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const requestedDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : date;

  await queue.send({
    id: `manual_${requestedDate}_daily`,
    scheduled_date: requestedDate,
    website: "daily",
    item: "aggregate",
    type: "manual-daily",
  });

  return c.json({ ok: true, message: `Daily aggregation triggered for ${requestedDate}` });
});

api.post("/internal/weekly-aggregate", async (c) => {
  const { DB, SCRAPE_QUEUE, INTERNAL_SECRET } = c.env;

  const auth = c.req.header("Authorization") || "";
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const weekStartDate = getLastWeekMonday();
  const queue = SCRAPE_QUEUE as unknown as Queue<TaskMessage>;

  await queue.send({
    id: `manual_${weekStartDate}_weekly`,
    scheduled_date: weekStartDate,
    website: "weekly",
    item: "aggregate",
    type: "manual-weekly",
  });

  return c.json({ ok: true, message: "Weekly aggregation triggered" });
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
