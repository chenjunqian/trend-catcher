import { Resend } from "resend";
import { getSummaryByDate, getWeeklySummaryByDate, updateSummaryNotified, updateWeeklySummaryNotified } from "../db/client";
import type { D1Database } from "@cloudflare/workers-types";
import { buildEmailHtml } from "./template";

export async function sendDailyEmail(
  db: D1Database,
  resendApiKey: string,
  notificationEmail: string,
  date: string
): Promise<boolean> {
  if (!resendApiKey || !notificationEmail) {
    console.warn("Missing Resend API key or notification email, skipping email");
    return false;
  }

  const summary = await getSummaryByDate(db, date);
  if (!summary) {
    console.warn(`No summary found for ${date}, skipping email`);
    return false;
  }

  const from = "Porkast <noreply@porkast.com>";

  const resend = new Resend(resendApiKey);

  const html = buildEmailHtml(summary.full_report_en, summary.full_report_zh, `Trend Catcher / 猎趋 Daily — ${date}`);
  const subject = `Trend Catcher Daily / 猎趋日报 — ${date}`;

  console.log(`[email:daily] Sending email: from="${from}" to="${notificationEmail}" subject="${subject}" htmlLength=${html.length}`);

  try {
    const result = await resend.emails.send({
      from,
      to: [notificationEmail],
      subject,
      html,
    });

    if (result.error) {
      console.error(`[email:daily] Resend API error (date=${date}):`, JSON.stringify(result.error));
      return false;
    }

    console.log(`[email:daily] Email sent successfully, id=${result.data?.id}`);

    await updateSummaryNotified(db, date);
    return true;
  } catch (err) {
    const e = err as Record<string, unknown>;
    if (e.statusCode) {
      console.error(`[email:daily] Resend error (date=${date}): statusCode=${e.statusCode} name=${e.name} message=${e.message}`);
    } else if (e.cause) {
      console.error(`[email:daily] Network error (date=${date}): message=${e.message} cause=${JSON.stringify(e.cause)}`);
    } else {
      console.error(`[email:daily] Unknown error (date=${date}):`, err);
    }
    return false;
  }
}

export async function sendWeeklyEmail(
  db: D1Database,
  resendApiKey: string,
  notificationEmail: string,
  weekStartDate: string
): Promise<boolean> {
  if (!resendApiKey || !notificationEmail) {
    console.warn("Missing Resend API key or notification email, skipping weekly email");
    return false;
  }

  const summary = await getWeeklySummaryByDate(db, weekStartDate);
  if (!summary) {
    console.warn(`No weekly summary found for ${weekStartDate}, skipping email`);
    return false;
  }

  const from = "Porkast <noreply@porkast.com>";

  const resend = new Resend(resendApiKey);

  const html = buildEmailHtml(summary.full_report_en, summary.full_report_zh, `Trend Catcher / 猎趋 Weekly — Week of ${weekStartDate}`);
  const subject = `Trend Catcher Weekly / 猎趋周报 — ${weekStartDate}`;

  console.log(`[email:weekly] Sending email: from="${from}" to="${notificationEmail}" subject="${subject}" htmlLength=${html.length}`);

  try {
    const result = await resend.emails.send({
      from,
      to: [notificationEmail],
      subject,
      html,
    });

    if (result.error) {
      console.error(`[email:weekly] Resend API error (week=${weekStartDate}):`, JSON.stringify(result.error));
      return false;
    }

    console.log(`[email:weekly] Email sent successfully, id=${result.data?.id}`);

    await updateWeeklySummaryNotified(db, weekStartDate);
    return true;
  } catch (err) {
    const e = err as Record<string, unknown>;
    if (e.statusCode) {
      console.error(`[email:weekly] Resend error (week=${weekStartDate}): statusCode=${e.statusCode} name=${e.name} message=${e.message}`);
    } else if (e.cause) {
      console.error(`[email:weekly] Network error (week=${weekStartDate}): message=${e.message} cause=${JSON.stringify(e.cause)}`);
    } else {
      console.error(`[email:weekly] Unknown error (week=${weekStartDate}):`, err);
    }
    return false;
  }
}
