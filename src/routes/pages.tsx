import { Hono } from "hono";
import Home from "./home";
import Report from "./report";
import { ConfirmPage, UnsubscribePage, UnsubscribeSuccessPage, NotFoundPage } from "./newsletter";
import { getSummaryByDate, getWeeklySummaryByDate, getHomeTimeline } from "../db/client";
import { confirmSubscription, unsubscribeByToken, getSubscriberByToken } from "../db/client";
import { detectLang } from "../i18n";
import { manifest } from "../pwa/manifest";
import type { Bindings } from "../index";

const PAGE_SIZE = 20;

const pages = new Hono<{ Bindings: Bindings }>();

pages.get("/", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);

  const result = await getHomeTimeline(DB, undefined, PAGE_SIZE);
  const rows = result.results ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].created_at) : null;

  return c.html(
    <Home
      items={items}
      nextCursor={nextCursor}
      lang={lang}
      path={c.req.path}
    />
  );
});

pages.get("/reports/weekly/:date", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);
  const date = c.req.param("date");
  const summary = await getWeeklySummaryByDate(DB, date);

  if (!summary) {
    return c.notFound();
  }

  return c.html(<Report summary={summary} lang={lang} path={c.req.path} isWeekly={true} />);
});

pages.get("/reports/:date", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);
  const date = c.req.param("date");
  const summary = await getSummaryByDate(DB, date);

  if (!summary) {
    return c.notFound();
  }

  return c.html(<Report summary={summary} lang={lang} path={c.req.path} />);
});

pages.get("/api/confirm", async (c) => {
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

pages.get("/unsubscribe", async (c) => {
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

pages.post("/unsubscribe", async (c) => {
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

pages.get("/manifest.json", (c) => {
  return c.json(manifest);
});

pages.get("/offline", (c) => {
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

export default pages;
