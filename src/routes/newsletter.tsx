import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import { t } from "../i18n";

interface PageProps {
  lang: Lang;
  path: string;
}

const pageStyle = `
  body { font-family: Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", "SimSun", serif; background: #fdfcf8; color: #1a1a1a; margin: 0; }
  .container { max-width: 460px; margin: 80px auto 0; padding: 32px 28px; text-align: center; border-top: 5px solid #1a1a1a; border-bottom: 2px solid #1a1a1a; }
  h1 { font-size: 26px; font-weight: 700; margin-bottom: 16px; }
  p { color: #555; margin-bottom: 24px; line-height: 1.7; }
  .btn { display: inline-block; padding: 10px 24px; border: 1px solid #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; background: #fff; color: #1a1a1a; text-decoration: none; }
  .btn:hover { background: #1a1a1a; color: #fff; }
  .btn-danger { background: #b03a2e; color: #fff; border-color: #b03a2e; }
  .btn-danger:hover { background: #933026; }
`;

export const ConfirmPage: FC<PageProps> = ({ lang, path }) => (
  <html lang={lang === "zh" ? "zh-CN" : "en"}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{t(lang, "newsletter.confirm.title")} — Trend Catcher</title>
      <style>{pageStyle}</style>
    </head>
    <body>
      <div class="container">
        <h1>{t(lang, "newsletter.confirm.title")}</h1>
        <p>{t(lang, "newsletter.confirm.body")}</p>
        <a href={`/?lang=${lang}`} class="btn">{t(lang, "newsletter.confirm.home")}</a>
      </div>
    </body>
  </html>
);

export const UnsubscribePage: FC<PageProps & { token: string }> = ({ lang, path, token }) => (
  <html lang={lang === "zh" ? "zh-CN" : "en"}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{t(lang, "newsletter.unsubscribe.title")} — Trend Catcher</title>
      <style>{pageStyle}</style>
    </head>
    <body>
      <div class="container">
        <h1>{t(lang, "newsletter.unsubscribe.title")}</h1>
        <p>{t(lang, "newsletter.unsubscribe.text")}</p>
        <form method="post" action="/unsubscribe">
          <input type="hidden" name="token" value={token} />
          <button type="submit" class="btn btn-danger">
            {t(lang, "newsletter.unsubscribe.button")}
          </button>
        </form>
      </div>
    </body>
  </html>
);

export const UnsubscribeSuccessPage: FC<PageProps> = ({ lang, path }) => (
  <html lang={lang === "zh" ? "zh-CN" : "en"}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{t(lang, "newsletter.unsubscribe.title")} — Trend Catcher</title>
      <style>{pageStyle}</style>
    </head>
    <body>
      <div class="container">
        <h1>{t(lang, "newsletter.unsubscribe.success")}</h1>
        <a href={`/?lang=${lang}`} class="btn">{t(lang, "newsletter.confirm.home")}</a>
      </div>
    </body>
  </html>
);

export const NotFoundPage: FC<PageProps> = ({ lang, path }) => (
  <html lang={lang === "zh" ? "zh-CN" : "en"}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{t(lang, "newsletter.not_found")} — Trend Catcher</title>
      <style>{pageStyle}</style>
    </head>
    <body>
      <div class="container">
        <h1>{t(lang, "newsletter.not_found")}</h1>
        <a href={`/?lang=${lang}`} class="btn">{t(lang, "newsletter.confirm.home")}</a>
      </div>
    </body>
  </html>
);
