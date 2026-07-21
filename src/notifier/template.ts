export function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #111;">$1</a>')
    .replace(/\n- /g, "\n<li>")
    .replace(/(<li>.*)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith("<")) return line;
      return `<p>${line}</p>`;
    })
    .replace(/<\/ul><p><\/p><ul>/g, "</ul><ul>");
}

export function buildEmailHtml(enReport: string, zhReport: string, title: string, unsubscribeUrl?: string): string {
  const unsubscribeHtml = unsubscribeUrl
    ? `<div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:12px;color:#999;">
       <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe / 取消订阅</a>
       </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style>
    @media (max-width: 600px) {
      body {
        padding: 12px !important;
      }
      .header {
        padding: 12px 16px !important;
        margin: -12px -12px 16px !important;
      }
      .header h1 {
        font-size: 16px !important;
      }
      .section {
        padding: 14px !important;
      }
      .section h2 {
        font-size: 15px !important;
      }
      .footer {
        padding: 12px 16px !important;
        margin: 0 -12px -12px !important;
      }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #111; line-height: 1.6; padding: 20px; -webkit-text-size-adjust: 100%;">
  <header class="header" style="border-bottom: 1px solid #e5e5e5; padding: 16px 24px; background: #fafafa; margin: -20px -20px 24px;">
    <h1 style="font-size: 20px; font-weight: 400; letter-spacing: -0.5px; margin: 0; color: #111;">${title}</h1>
  </header>

  <main style="max-width: 840px; margin: 0 auto;">
    <div class="section" style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
      <h2 style="font-size: 18px; font-weight: 400; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; color: #111;">English Report</h2>
      ${markdownToHtml(enReport)}
    </div>

    <div class="section" style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
      <h2 style="font-size: 18px; font-weight: 400; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; color: #111;">中文报告</h2>
      ${markdownToHtml(zhReport)}
    </div>
    ${unsubscribeHtml}
  </main>

  <footer class="footer" style="border-top: 1px solid #e5e5e5; padding: 16px 24px; text-align: center; color: #999; font-size: 12px; margin: 0 -20px -20px;">
    &copy; ${new Date().getFullYear()} Trend Catcher — Powered by Cloudflare Workers &amp; AI
  </footer>
</body>
</html>`;
}
