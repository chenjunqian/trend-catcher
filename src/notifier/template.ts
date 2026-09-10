const SERIF_STACK =
  "Charter, Georgia, 'TsangerJinKai02', 'Source Han Serif SC', 'Songti SC', Georgia, serif";
const UI_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function inline(text: string): string {
  return text
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong style="font-weight:500;color:#141413;">$1</strong>'
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:#1B365D;text-decoration:underline;">$1</a>'
    );
}

export function markdownToHtml(md: string): string {
  const blocks = md.trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").filter((line) => line.trim().length > 0);
      if (lines.length === 0) return "";

      if (lines.every((line) => /^[-*]\s+/.test(line.trim()))) {
        const items = lines
          .map(
            (line) =>
              `<li style="margin:0 0 4px;text-wrap:pretty;">${inline(line.trim().replace(/^[-*]\s+/, ""))}</li>`
          )
          .join("");
        return `<ul style="margin:0 0 12px;padding-left:20px;">${items}</ul>`;
      }

      const heading = lines[0].match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const size = level === 1 ? "19px" : level === 2 ? "17px" : "15px";
        const headingHtml = `<h${level} style="font-family:${SERIF_STACK};font-size:${size};font-weight:500;line-height:1.3;color:#141413;margin:22px 0 8px;">${inline(heading[2])}</h${level}>`;
        const rest = lines.slice(1).join(" ");
        return rest
          ? headingHtml +
              `<p style="font-family:${SERIF_STACK};font-size:15px;line-height:1.55;color:#3d3d3a;margin:0 0 12px;text-wrap:pretty;">${inline(rest)}</p>`
          : headingHtml;
      }

      return `<p style="font-family:${SERIF_STACK};font-size:15px;line-height:1.55;color:#3d3d3a;margin:0 0 12px;text-wrap:pretty;">${inline(lines.join(" "))}</p>`;
    })
    .join("");
}

export function buildEmailHtml(
  enReport: string,
  zhReport: string,
  title: string,
  unsubscribeUrl?: string
): string {
  const unsubscribeHtml = unsubscribeUrl
    ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e3d8;text-align:center;font-family:${UI_STACK};font-size:12px;color:#6b6a64;">
       <a href="${unsubscribeUrl}" style="color:#6b6a64;text-decoration:underline;">Unsubscribe / 取消订阅</a>
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
      .wrap {
        padding: 12px !important;
      }
      .header {
        padding: 0 0 16px !important;
      }
      .header h1 {
        font-size: 18px !important;
      }
      .section {
        padding: 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #f5f4ed;">
  <div class="wrap" style="max-width: 720px; margin: 0 auto; padding: 24px;">
    <header class="header" style="padding: 0 0 20px;">
      <h1 style="font-family: ${SERIF_STACK}; font-size: 20px; font-weight: 500; line-height: 1.3; color: #141413; margin: 0;">${title}</h1>
    </header>

    <main>
      <div class="section" style="background: #faf9f5; border-radius: 8px; padding: 22px 24px; margin-bottom: 16px;">
        <h2 style="font-family: ${SERIF_STACK}; font-size: 17px; font-weight: 500; line-height: 1.3; color: #141413; margin: 0 0 12px;">English Report</h2>
        ${markdownToHtml(enReport)}
      </div>

      <div class="section" style="background: #faf9f5; border-radius: 8px; padding: 22px 24px; margin-bottom: 16px;">
        <h2 style="font-family: ${SERIF_STACK}; font-size: 17px; font-weight: 500; line-height: 1.3; color: #141413; margin: 0 0 12px;">中文报告</h2>
        ${markdownToHtml(zhReport)}
      </div>

      ${unsubscribeHtml}
    </main>

    <footer style="border-top: 1px solid #e5e3d8; padding: 16px 0 0; text-align: center; font-family: ${UI_STACK}; font-size: 12px; color: #6b6a64;">
      &copy; ${new Date().getFullYear()} Trend Catcher — Powered by Cloudflare Workers &amp; AI
    </footer>
  </div>
</body>
</html>`;
}
