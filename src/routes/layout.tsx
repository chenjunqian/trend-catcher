import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import { t, switchLang } from "../i18n";

const Layout: FC<{ title: string; lang: Lang; children?: any }> = ({
  title,
  lang,
  children,
}) => {
  const altLang = switchLang(lang);

  return (
    <html lang={lang === "zh" ? "zh-CN" : "en"}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#f78166" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trend Catcher" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <title>
          {title} — {t(lang, "site.title")}
        </title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1117; color: #e1e4e8; line-height: 1.6; }
          a { color: #58a6ff; text-decoration: none; }
          a:hover { text-decoration: underline; }
          header { border-bottom: 1px solid #21262d; padding: 16px 24px; background: #161b22; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
          header h1 { font-size: 20px; font-weight: 600; }
          header h1 span { color: #f78166; }
          header nav { display: flex; gap: 16px; align-items: center; }
          header nav a { font-size: 14px; }
          .lang-switch { padding: 4px 12px; border: 1px solid #30363d; border-radius: 6px; font-size: 13px; }
          .lang-switch:hover { background: #21262d; text-decoration: none; }
          main { max-width: 840px; margin: 0 auto; padding: 24px 16px; }
          footer { border-top: 1px solid #21262d; padding: 16px 24px; text-align: center; color: #484f58; font-size: 13px; }
          .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
          .card:hover { border-color: #30363d; }
          .card h3 { font-size: 16px; margin-bottom: 8px; }
          .card .meta { color: #8b949e; font-size: 13px; }
          .card p { margin-top: 8px; color: #c9d1d9; font-size: 14px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; background: #1f6feb22; color: #58a6ff; }
          .report h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #21262d; }
          .report h3 { font-size: 16px; margin: 16px 0 8px; }
          .report p { margin: 8px 0; }
          .report ul, .report ol { margin: 8px 0; padding-left: 24px; }
          .back-link { display: inline-block; margin-bottom: 16px; font-size: 14px; }
          .empty { text-align: center; padding: 60px 20px; color: #8b949e; }
          .lang-section { margin-top: 24px; }
          .lang-section h2 { margin: 16px 0 12px; }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
`,
          }}
        />
      </head>
      <body>
        <header>
          <h1>
            <a href={`/?lang=${lang}`}>
              {t(lang, "site.title")} <span>Trend Catcher</span>
            </a>
          </h1>
          <nav>
            <a href={`/?lang=${altLang}`} class="lang-switch">
              {t(lang, "lang.switch")}
            </a>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          &copy; {new Date().getFullYear()} Trend Catcher —{" "}
          {t(lang, "footer")}
        </footer>
      </body>
    </html>
  );
};

export default Layout;
