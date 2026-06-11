import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import { t, switchLang } from "../i18n";

const Layout: FC<{ title: string; lang: Lang; path: string; children?: any }> = ({
  title,
  lang,
  path,
  children,
}) => {
  const altLang = switchLang(lang);

  return (
    <html lang={lang === "zh" ? "zh-CN" : "en"}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
          html { overscroll-behavior: contain; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; line-height: 1.6; }
          a { color: #111; text-decoration: none; }
          a:hover { text-decoration: underline; }
          header { border-bottom: 1px solid #e5e5e5; padding: 16px 24px; background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
          header h1 { font-size: 20px; font-weight: 400; letter-spacing: -0.5px; }
          header nav { display: flex; gap: 16px; align-items: center; }
          header nav a { font-size: 14px; }
          .lang-switch { padding: 4px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; color: #666; }
          .lang-switch:hover { background: #f0f0f0; text-decoration: none; color: #111; }
          main { max-width: 840px; margin: 0 auto; padding: 24px 16px; }
          footer { border-top: 1px solid #e5e5e5; padding: 16px 24px; text-align: center; color: #999; font-size: 12px; }
          .card { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4px; padding: 20px; margin-bottom: 16px; transition: border-color .2s; }
          .card:hover { border-color: #ccc; }
          .card h3 { font-size: 16px; font-weight: 400; margin-bottom: 8px; }
          .card .meta { color: #999; font-size: 13px; }
          .card p { margin-top: 8px; color: #555; font-size: 14px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 2px; font-size: 11px; background: #000; color: #fff; font-weight: 500; }
          .report h2 { font-size: 18px; font-weight: 400; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
          .report h3 { font-size: 16px; font-weight: 400; margin: 16px 0 8px; }
          .report p { margin: 8px 0; }
          .report ul, .report ol { margin: 8px 0; padding-left: 24px; }
          .back-link { display: inline-block; margin-bottom: 16px; font-size: 14px; color: #666; }
          .empty { text-align: center; padding: 60px 20px; color: #999; }
          .lang-section { margin-top: 24px; }
          .lang-section h2 { margin: 16px 0 12px; }
          .pull-indicator { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; display: flex; justify-content: center; align-items: flex-end; height: 0; overflow: hidden; background: #fff; transition: height .15s ease-out; }
          .pull-indicator .spinner { width: 20px; height: 20px; border: 2px solid #e5e5e5; border-top-color: #111; border-radius: 50%; animation: ptr-spin .6s linear infinite; margin-bottom: 10px; }
          @keyframes ptr-spin { to { transform: rotate(360deg); } }
        `}</style>
        <script src="/register-sw.js" />
        <script src="/pull-to-refresh.js" />
      </head>
      <body>
        <header>
          <h1>
            <a href={`/?lang=${lang}`}>
              {t(lang, "site.title")}
            </a>
          </h1>
          <nav>
            <form id="nl-form" style="display:flex;gap:6px;align-items:center;">
              <input
                type="email"
                id="nl-email"
                placeholder={t(lang, "newsletter.placeholder")}
                style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;width:170px;"
                required
              />
              <button
                type="submit"
                style="padding:4px 10px;border:1px solid #ddd;border-radius:4px;font-size:12px;background:#fff;cursor:pointer;white-space:nowrap;"
              >
                {t(lang, "newsletter.subscribe")}
              </button>
            </form>
            <span id="nl-msg" style="font-size:11px;"></span>
            <a href={`${path}?lang=${altLang}`} class="lang-switch">
              {t(lang, "lang.switch")}
            </a>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          &copy; {new Date().getFullYear()} Trend Catcher —{" "}
          {t(lang, "footer")}
        </footer>
        <script>
          {`(function(){
            var f=document.getElementById('nl-form');
            var m=document.getElementById('nl-msg');
            f.addEventListener('submit',async function(e){
              e.preventDefault();
              var email=document.getElementById('nl-email').value.trim();
              if(!email)return;
              m.style.color='#999';
              m.textContent='...';
              try{
                var r=await fetch('/api/subscribe',{
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({email:email,lang:document.documentElement.lang==='zh-CN'?'zh':'en'})
                });
                var d=await r.json();
                if(r.ok){m.style.color='#333';m.textContent=d.message;}
                else{m.style.color='#f78166';m.textContent=d.error;}
              }catch(e){m.style.color='#f78166';m.textContent='Network error';}
            });
          })();`}
        </script>
      </body>
    </html>
  );
};

export default Layout;
