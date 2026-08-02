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
        <meta name="theme-color" content="#fdfcf8" />
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
          body { font-family: Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", "SimSun", serif; background: #fdfcf8; color: #1a1a1a; line-height: 1.7; }
          a { color: inherit; text-decoration: none; }
          a:hover { text-decoration: underline; }

          .masthead { border-top: 6px solid #1a1a1a; border-bottom: 2px solid #1a1a1a; padding: 18px 16px 0; background: #fdfcf8; }
          .masthead-inner { max-width: 880px; margin: 0 auto; }
          .masthead-title { font-size: clamp(40px, 8vw, 64px); font-weight: 700; line-height: 1.1; text-align: center; letter-spacing: -1px; }
          .masthead-title a:hover { text-decoration: none; }
          .masthead-tagline { text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #6b6b6b; margin-top: 6px; }
          .masthead-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-top: 1px solid #d8d2c4; margin-top: 14px; padding: 10px 0; }
          .masthead-edition { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #b03a2e; }
          .masthead-nav { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
          .nl-form { display: flex; align-items: stretch; border: 1px solid #1a1a1a; background: #fff; }
          .nl-input { border: 0; outline: none; background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; padding: 6px 10px; width: 170px; color: #1a1a1a; }
          .nl-btn { border: 0; border-left: 1px solid #1a1a1a; background: #1a1a1a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; padding: 7px 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
          .nl-btn:hover { background: #b03a2e; text-decoration: none; }
          #nl-msg { font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .lang-switch { border: 1px solid #1a1a1a; background: #fff; padding: 5px 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #1a1a1a; }
          .lang-switch:hover { background: #1a1a1a; color: #fff; text-decoration: none; }

          main { max-width: 880px; margin: 0 auto; padding: 28px 16px 40px; }
          .section-title { display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 700; margin: 8px 0 22px; }
          .section-title::before, .section-title::after { content: ""; flex: 1; height: 1px; background: #1a1a1a; }
          .badge { display: inline-block; padding: 2px 9px; background: #1a1a1a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; white-space: nowrap; }
          .badge-weekly { background: #b03a2e; }

          .card-link { display: block; }
          .card-link:hover { text-decoration: none; }
          .card-link:hover .card-date { text-decoration: underline; }
          .card { padding: 16px 2px; border-top: 1px solid #e0dbcc; }
          .card-link:first-child .card { border-top: 3px solid #1a1a1a; }
          .card-link:hover .card { background: #f6f3e8; }
          .card-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
          .card-date { font-size: 20px; font-weight: 700; }
          .card-link:first-child .card-date { font-size: 24px; }
          .card-preview { margin-top: 8px; font-size: 14px; line-height: 1.7; color: #4a4a4a; text-align: justify; }

          .back-link { display: inline-block; margin-bottom: 18px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6b6b; }
          .back-link:hover { color: #1a1a1a; }
          .story-head { border-top: 5px solid #1a1a1a; border-bottom: 2px solid #1a1a1a; padding: 16px 0 14px; margin-bottom: 24px; text-align: center; }
          .story-title { font-size: clamp(26px, 5vw, 40px); font-weight: 700; line-height: 1.2; }
          .story-type { display: block; margin-top: 6px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; font-weight: 400; letter-spacing: 0.3em; text-transform: uppercase; color: #b03a2e; }

          .columns { columns: 3; column-gap: 28px; column-rule: 1px solid #d8d2c4; }
          .column { break-inside: avoid; padding-bottom: 6px; }
          .column-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin-bottom: 8px; }
          .column-name { font-size: 17px; font-weight: 700; }
          .column-body { font-size: 13.5px; line-height: 1.65; text-align: justify; }
          .column-body p { margin: 0 0 8px; }
          .column-body h1, .column-body h2, .column-body h3 { font-size: 15px; margin: 10px 0 6px; }
          .column-body ul, .column-body ol { margin: 0 0 8px; padding-left: 18px; }
          .column-body li { margin-bottom: 4px; }
          .column-body a { text-decoration: underline; text-underline-offset: 3px; }

          .report { margin-top: 26px; }
          .lang-section { margin-top: 30px; padding-top: 26px; border-top: 4px solid #1a1a1a; }
          .lang-section h2 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; margin-bottom: 16px; }
          .report-body p { margin: 0 0 14px; text-align: justify; }
          .report-body p:first-of-type::first-letter { float: left; font-size: 3.4em; line-height: 0.85; font-weight: 700; padding: 4px 8px 0 0; color: #b03a2e; }
          .report-body h1, .report-body h2 { font-size: 22px; font-weight: 700; margin: 30px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #1a1a1a; }
          .report-body h3 { font-size: 18px; font-weight: 700; margin: 20px 0 10px; }
          .report-body ul, .report-body ol { margin: 0 0 14px; padding-left: 26px; }
          .report-body li { margin-bottom: 6px; }
          .report-body a { text-decoration: underline; text-underline-offset: 3px; }
          .report-body a:hover { color: #b03a2e; }
          .report-body blockquote { margin: 0 0 14px; padding-left: 16px; border-left: 3px solid #1a1a1a; font-style: italic; color: #555; }
          .report-empty { color: #8a8578; font-style: italic; }

          .empty { text-align: center; padding: 60px 20px; color: #8a8578; font-style: italic; }
          .load-more-wrap { text-align: center; padding: 16px 0 32px; }
          .btn-load-more { padding: 10px 28px; border: 1px solid #1a1a1a; background: #fff; font-family: Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", "SimSun", serif; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: #1a1a1a; cursor: pointer; }
          .btn-load-more:hover { background: #1a1a1a; color: #fff; }

          footer { border-top: 4px double #1a1a1a; padding: 18px 24px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b6b6b; }
          .pull-indicator { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; display: flex; justify-content: center; align-items: flex-end; height: 0; overflow: hidden; background: #fdfcf8; transition: height .15s ease-out; }
          .pull-indicator .spinner { width: 20px; height: 20px; border: 2px solid #e0dbcc; border-top-color: #1a1a1a; border-radius: 50%; animation: ptr-spin .6s linear infinite; margin-bottom: 10px; }
          @keyframes ptr-spin { to { transform: rotate(360deg); } }
          @media (max-width: 720px) {
            .columns { columns: 1; column-rule: none; }
            .column { border-bottom: 1px solid #e0dbcc; padding-bottom: 12px; margin-bottom: 12px; }
            .masthead-actions { justify-content: center; }
          }
        `}</style>
        <script src="/register-sw.js" />
        <script src="/pull-to-refresh.js" />
      </head>
      <body>
        <header class="masthead">
          <div class="masthead-inner">
            <h1 class="masthead-title">
              <a href={`/?lang=${lang}`}>
                {t(lang, "site.title")}
              </a>
            </h1>
            <p class="masthead-tagline">{t(lang, "site.tagline")}</p>
            <div class="masthead-actions">
              <span class="masthead-edition">
                {t(lang, "badge.daily")} · {t(lang, "badge.weekly")}
              </span>
              <nav class="masthead-nav">
                <form id="nl-form" class="nl-form">
                  <input
                    type="email"
                    id="nl-email"
                    class="nl-input"
                    placeholder={t(lang, "newsletter.placeholder")}
                    required
                  />
                  <button type="submit" class="nl-btn">
                    {t(lang, "newsletter.subscribe")}
                  </button>
                </form>
                <span id="nl-msg"></span>
                <a href={`${path}?lang=${altLang}`} class="lang-switch">
                  {t(lang, "lang.switch")}
                </a>
              </nav>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          &copy; {new Date().getFullYear()} Trend Catcher —{" "}
          {t(lang, "footer")}
        </footer>
        <script
          dangerouslySetInnerHTML={{
            __html: String.raw`(function(){
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
          })();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: String.raw`(function(){
            var btn=document.getElementById('load-more');
            if(!btn)return;
            var container=document.getElementById('items-container');
            var msg=document.getElementById('load-more-msg');
            function setMsg(text,isError){
              if(!msg)return;
              msg.textContent=text;
              msg.style.color=isError?'#f78166':'#999';
            }
            function clearMsg(){if(msg){msg.textContent='';msg.style.color='#999';}}
            function escapeHtml(s){
              return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            }
            function stripPreview(md,maxLen){
              if(maxLen===undefined)maxLen=200;
              var text=md.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^#+\s/gm,'').replace(/\n\n/g,' ').replace(/\n/g,' ');
              return text.slice(0,maxLen)+(md.length>maxLen?'...':'');
            }
            btn.addEventListener('click',async function(){
              var cursor=this.dataset.cursor;
              var lang=this.dataset.lang;
              this.disabled=true;
              this.textContent='...';
              setMsg(lang==='zh'?'加载中...':'Loading...');
              try{
                var r=await fetch('/api/timeline?cursor='+encodeURIComponent(cursor)+'&lang='+encodeURIComponent(lang));
                if(!r.ok){
                  var errBody='';
                  try{errBody=' ('+(await r.json()).error+')';}catch(e){}
                  throw new Error('HTTP '+r.status+errBody);
                }
                var d=await r.json();
                if(!d.items||!d.items.length){
                  setMsg(lang==='zh'?'没有更多报告了':'No more reports');
                  btn.remove();
                  return;
                }
                var html='';
                for(var i=0;i<d.items.length;i++){
                  var it=d.items[i];
                  var href=it.type==='weekly'?'/reports/weekly/'+it.display_date+'?lang='+lang:'/reports/'+it.display_date+'?lang='+lang;
                  var badge=it.type==='weekly'?(lang==='zh'?'周报':'Weekly'):(lang==='zh'?'日报':'Daily');
                  var label=it.type==='weekly'?(lang==='zh'?it.display_date+' 所在周':'Week of '+it.display_date):it.display_date;
                  var report=lang==='zh'?it.full_report_zh:it.full_report_en;
                  html+='<a href="'+href+'" class="card-link">'+
                    '<div class="card">'+
                      '<div class="card-top">'+
                        '<span class="card-date">'+escapeHtml(label)+'</span>'+
                        '<span class="badge'+(it.type==='weekly'?' badge-weekly':'')+'">'+escapeHtml(badge)+'</span>'+
                      '</div>'+
                      '<p class="card-preview">'+escapeHtml(stripPreview(report))+'</p>'+
                    '</div>'+
                  '</a>';
                }
                container.insertAdjacentHTML('beforeend',html);
                clearMsg();
                if(d.nextCursor){
                  btn.dataset.cursor=d.nextCursor;
                  btn.disabled=false;
                  btn.textContent=lang==='zh'?'加载更多':'Load more';
                }else{
                  btn.remove();
                }
              }catch(e){
                var errMsg=lang==='zh'?'加载失败，请重试':'Failed to load. Please try again.';
                setMsg(errMsg,true);
                alert(errMsg+'\n'+e.message);
                btn.disabled=false;
                btn.textContent=lang==='zh'?'加载更多':'Load more';
              }
            });
          })();`,
          }}
        />
      </body>
    </html>
  );
};

export default Layout;
