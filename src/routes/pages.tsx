import { Hono } from "hono";
import Home from "./home";
import Report from "./report";
import {
  ConfirmPage,
  UnsubscribePage,
  UnsubscribeSuccessPage,
  NotFoundPage,
  OfflinePage,
} from "./newsletter";
import { getSummaryByDate, getWeeklySummaryByDate, getHomeTimeline } from "../db/client";
import { confirmSubscription, unsubscribeByToken, getSubscriberByToken } from "../db/client";
import { detectLang, t } from "../i18n";
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
    return c.html(
      <NotFoundPage
        lang={lang}
        path={c.req.path}
        message={t(lang, "newsletter.not_found")}
      />,
      404
    );
  }

  const result = await confirmSubscription(DB, token);
  if (!result.meta.changes) {
    return c.html(
      <NotFoundPage
        lang={lang}
        path={c.req.path}
        message={t(lang, "newsletter.not_found")}
      />,
      404
    );
  }

  return c.html(<ConfirmPage lang={lang} path={c.req.path} />);
});

pages.get("/unsubscribe", async (c) => {
  const { DB } = c.env;
  const lang = detectLang(c.req.raw);

  const token = c.req.query("token") ?? "";
  if (!token) {
    return c.html(
      <NotFoundPage
        lang={lang}
        path={c.req.path}
        message={t(lang, "newsletter.not_found")}
      />,
      404
    );
  }

  const subscriber = await getSubscriberByToken(DB, token);
  if (!subscriber) {
    return c.html(
      <NotFoundPage
        lang={lang}
        path={c.req.path}
        message={t(lang, "newsletter.not_found")}
      />,
      404
    );
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
      return c.html(
        <NotFoundPage
          lang={lang}
          path={c.req.path}
          message={t(lang, "newsletter.not_found")}
        />,
        404
      );
    }
  }

  const token = body.token ?? "";
  if (!token) {
    return c.html(
      <NotFoundPage
        lang={lang}
        path={c.req.path}
        message={t(lang, "newsletter.not_found")}
      />,
      404
    );
  }

  await unsubscribeByToken(DB, token);

  return c.html(<UnsubscribeSuccessPage lang={lang} path={c.req.path} />);
});

pages.get("/manifest.json", (c) => {
  return c.json(manifest);
});

pages.get("/offline", (c) => {
  const lang = detectLang(c.req.raw);
  return c.html(<OfflinePage lang={lang} path={c.req.path} />);
});

export default pages;
