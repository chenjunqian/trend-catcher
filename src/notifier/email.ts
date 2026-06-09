import { Resend } from "resend";
import { getSummaryByDate, getWeeklySummaryByDate, updateSummaryNotified, updateWeeklySummaryNotified } from "../db/client";
import type { D1Database } from "@cloudflare/workers-types";

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

  const isProd = !notificationEmail.includes("@example");
  const from = isProd
    ? `Trend Catcher <report@${notificationEmail.split("@")[1]}>`
    : "Trend Catcher <onboarding@resend.dev>";

  const resend = new Resend(resendApiKey);

  const html = buildEmailHtml(summary.full_report_en, summary.full_report_zh, date);

  try {
    await resend.emails.send({
      from,
      to: [notificationEmail],
      subject: `Trend Catcher Daily / 猎趋日报 — ${date}`,
      html,
    });

    await updateSummaryNotified(db, date);
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

function buildEmailHtml(enReport: string, zhReport: string, date: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f1117; color: #e1e4e8; padding: 20px;">
  <h1 style="color: #f78166;">Trend Catcher / 猎趋 Daily — ${date}</h1>

  <div style="background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin: 16px 0;">
    <h2 style="color: #58a6ff;">English Report</h2>
    ${markdownToHtml(enReport)}
  </div>

  <div style="background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin: 16px 0;">
    <h2 style="color: #58a6ff;">中文报告</h2>
    ${markdownToHtml(zhReport)}
  </div>

  <p style="color: #484f58; font-size: 13px;">
    Powered by Cloudflare Workers &amp; AI · <a href="https://github.com" style="color: #58a6ff;">Trend Catcher</a>
  </p>
</body>
</html>`;
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "\n<li>")
    .replace(/(<li>.*)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith("<")) return line;
      return `<p>${line}</p>`;
    })
    .replace(/<\/ul><p><\/p><ul>/g, "</ul><ul>");
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

  const isProd = !notificationEmail.includes("@example");
  const from = isProd
    ? `Trend Catcher <report@${notificationEmail.split("@")[1]}>`
    : "Trend Catcher <onboarding@resend.dev>";

  const resend = new Resend(resendApiKey);

  const html = buildWeeklyEmailHtml(summary.full_report_en, summary.full_report_zh, weekStartDate);

  try {
    await resend.emails.send({
      from,
      to: [notificationEmail],
      subject: `Trend Catcher Weekly / 猎趋周报 — ${weekStartDate}`,
      html,
    });

    await updateWeeklySummaryNotified(db, weekStartDate);
    return true;
  } catch (err) {
    console.error("Failed to send weekly email:", err);
    return false;
  }
}

function buildWeeklyEmailHtml(enReport: string, zhReport: string, weekStartDate: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f1117; color: #e1e4e8; padding: 20px;">
  <h1 style="color: #f78166;">Trend Catcher / 猎趋 Weekly — Week of ${weekStartDate}</h1>

  <div style="background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin: 16px 0;">
    <h2 style="color: #58a6ff;">English Report</h2>
    ${markdownToHtml(enReport)}
  </div>

  <div style="background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin: 16px 0;">
    <h2 style="color: #58a6ff;">中文报告</h2>
    ${markdownToHtml(zhReport)}
  </div>

  <p style="color: #484f58; font-size: 13px;">
    Powered by Cloudflare Workers &amp; AI · <a href="https://github.com" style="color: #58a6ff;">Trend Catcher</a>
  </p>
</body>
</html>`;
}
