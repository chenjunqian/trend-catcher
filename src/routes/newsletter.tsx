import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import { t } from "../i18n";

interface PageProps {
  lang: Lang;
  path: string;
}

const pageStyle = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; margin: 0; }
  .container { max-width: 480px; margin: 80px auto 0; padding: 24px; text-align: center; }
  h1 { font-size: 22px; font-weight: 400; margin-bottom: 16px; }
  p { color: #555; margin-bottom: 24px; line-height: 1.6; }
  .btn { display: inline-block; padding: 10px 24px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; cursor: pointer; background: #fff; color: #111; text-decoration: none; }
  .btn:hover { background: #f5f5f5; }
  .btn-danger { background: #f78166; color: #fff; border-color: #f78166; }
  .btn-danger:hover { background: #e07050; }
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
