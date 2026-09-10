import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import { KAMI_TOKENS, STANDALONE_STYLES } from "./styles";

interface PageProps {
  lang: Lang;
  path: string;
}

const StandaloneLayout: FC<{ title: string; lang: Lang; children?: any }> = ({
  title,
  lang,
  children,
}) => (
  <html lang={lang === "zh" ? "zh-CN" : "en"}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#f5f4ed" />
      <title>
        {title} — {t(lang, "site.title")}
      </title>
      <style dangerouslySetInnerHTML={{ __html: KAMI_TOKENS + STANDALONE_STYLES }} />
    </head>
    <body>
      <main class="standalone">{children}</main>
    </body>
  </html>
);

export const ConfirmPage: FC<PageProps> = ({ lang }) => (
  <StandaloneLayout title={t(lang, "newsletter.confirm.title")} lang={lang}>
    <div class="panel">
      <h1>{t(lang, "newsletter.confirm.title")}</h1>
      <p>{t(lang, "newsletter.confirm.body")}</p>
      <div class="panel-actions">
        <a href={`/?lang=${lang}`} class="btn-primary">
          {t(lang, "newsletter.confirm.home")}
        </a>
      </div>
    </div>
  </StandaloneLayout>
);

export const UnsubscribePage: FC<PageProps & { token: string }> = ({ lang, token }) => (
  <StandaloneLayout title={t(lang, "newsletter.unsubscribe.title")} lang={lang}>
    <div class="panel">
      <h1>{t(lang, "newsletter.unsubscribe.title")}</h1>
      <p>{t(lang, "newsletter.unsubscribe.text")}</p>
      <form method="post" action="/unsubscribe">
        <input type="hidden" name="token" value={token} />
        <div class="panel-actions">
          <button type="submit" class="btn-primary">
            {t(lang, "newsletter.unsubscribe.button")}
          </button>
        </div>
      </form>
    </div>
  </StandaloneLayout>
);

export const UnsubscribeSuccessPage: FC<PageProps> = ({ lang }) => (
  <StandaloneLayout title={t(lang, "newsletter.unsubscribe.title")} lang={lang}>
    <div class="panel">
      <h1>{t(lang, "newsletter.unsubscribe.success")}</h1>
      <div class="panel-actions">
        <a href={`/?lang=${lang}`} class="btn-primary">
          {t(lang, "newsletter.confirm.home")}
        </a>
      </div>
    </div>
  </StandaloneLayout>
);

export const NotFoundPage: FC<PageProps & { message?: string }> = ({ lang, message }) => (
  <StandaloneLayout title={t(lang, "not_found.title")} lang={lang}>
    <div class="panel">
      <h1>{t(lang, "not_found.title")}</h1>
      <p>{message ?? t(lang, "not_found.body")}</p>
      <div class="panel-actions">
        <a href={`/?lang=${lang}`} class="btn-primary">
          {t(lang, "newsletter.confirm.home")}
        </a>
      </div>
    </div>
  </StandaloneLayout>
);

export const OfflinePage: FC<PageProps> = ({ lang }) => (
  <StandaloneLayout title={t(lang, "offline.title")} lang={lang}>
    <div class="panel">
      <h1>{t(lang, "offline.title")}</h1>
      <p>{t(lang, "offline.body")}</p>
      <div class="panel-actions">
        <a href={`/?lang=${lang}`} class="btn-ghost">
          {t(lang, "offline.retry")}
        </a>
      </div>
    </div>
  </StandaloneLayout>
);
