import type { D1Database } from "@cloudflare/workers-types";
import {
  getSummaryByDate,
  getWeeklySummaryByDate,
  getAllConfirmedSubscribers,
} from "../db/client";
import { buildEmailHtml } from "./template";

export interface EmailSender {
  send(message: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

const FROM: { email: string; name: string } = { email: "trendcatcher@guoshaotech.com", name: "Trend Catcher" };

function buildUnsubscribeUrl(token: string, lang: string, baseUrl: string): string {
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}&lang=${lang}`;
}

async function sendToSubscribers(
  db: D1Database,
  emailSender: EmailSender,
  enReport: string,
  zhReport: string,
  title: string,
  subject: string,
  baseUrl: string
): Promise<{ sent: number; failed: number }> {
  const subscribers = await getAllConfirmedSubscribers(db);
  const list = subscribers.results ?? [];
  if (list.length === 0) {
    console.log("[email] No confirmed subscribers, skipping send");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of list) {
    const unsubscribeUrl = buildUnsubscribeUrl(sub.unsubscribe_token, sub.lang, baseUrl);
    const html = buildEmailHtml(enReport, zhReport, title, unsubscribeUrl);
    const textPlain = `Trend Catcher Report\n\nUnsubscribe: ${unsubscribeUrl}`;

    try {
      await emailSender.send({
        to: sub.email,
        from: FROM,
        subject,
        html,
        text: textPlain,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch (err) {
      failed++;
      const e = err as Error & { code?: string };
      console.error(`[email] Failed to send to ${sub.email}: code=${e.code ?? "unknown"} message=${e.message}`);
    }
  }

  console.log(`[email] Sent ${sent} emails, ${failed} failed`);
  return { sent, failed };
}

export async function sendDailyEmail(
  db: D1Database,
  emailSender: EmailSender,
  date: string,
  baseUrl: string
): Promise<boolean> {
  const summary = await getSummaryByDate(db, date);
  if (!summary) {
    console.warn(`[email:daily] No summary found for ${date}, skipping email`);
    return false;
  }

  const subject = `Trend Catcher Daily / 猎趋日报 — ${date}`;
  const title = `Trend Catcher / 猎趋 Daily — ${date}`;

  console.log(`[email:daily] Sending daily report for ${date}`);
  const result = await sendToSubscribers(
    db,
    emailSender,
    summary.full_report_en,
    summary.full_report_zh,
    title,
    subject,
    baseUrl
  );

  return result.sent > 0;
}

export async function sendWeeklyEmail(
  db: D1Database,
  emailSender: EmailSender,
  weekStartDate: string,
  baseUrl: string
): Promise<boolean> {
  const summary = await getWeeklySummaryByDate(db, weekStartDate);
  if (!summary) {
    console.warn(`[email:weekly] No weekly summary found for ${weekStartDate}, skipping email`);
    return false;
  }

  const subject = `Trend Catcher Weekly / 猎趋周报 — ${weekStartDate}`;
  const title = `Trend Catcher / 猎趋 Weekly — Week of ${weekStartDate}`;

  console.log(`[email:weekly] Sending weekly report for ${weekStartDate}`);
  const result = await sendToSubscribers(
    db,
    emailSender,
    summary.full_report_en,
    summary.full_report_zh,
    title,
    subject,
    baseUrl
  );

  return result.sent > 0;
}
