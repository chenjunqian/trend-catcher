import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import { t, switchLang } from "../i18n";
import { KAMI_TOKENS, LAYOUT_STYLES } from "./styles";

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
        <meta name="theme-color" content="#f5f4ed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Trend Catcher" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {lang === "zh" && (
          <>
            <link
              rel="preload"
              as="font"
              type="font/woff2"
              href="/fonts/TsangerJinKai02-W04.woff2"
              crossorigin="anonymous"
            />
            <link
              rel="preload"
              as="font"
              type="font/woff2"
              href="/fonts/TsangerJinKai02-W05.woff2"
              crossorigin="anonymous"
            />
          </>
        )}
        <title>
          {title} — {t(lang, "site.title")}
        </title>
        <style dangerouslySetInnerHTML={{ __html: KAMI_TOKENS + LAYOUT_STYLES }} />
        <script src="/register-sw.js" />
        <script src="/pull-to-refresh.js" />
      </head>
      <body>
        <header class="site-header">
          <div class="site-header-inner">
            <div class="brand">
              <h1 class="brand-title">
                <a href={`/?lang=${lang}`}>{t(lang, "site.title")}</a>
              </h1>
              <p class="brand-tagline">{t(lang, "site.tagline")}</p>
            </div>
            <div class="header-actions">
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
              <span id="nl-msg" />
              <a href={`${path}?lang=${altLang}`} class="lang-switch">
                {t(lang, "lang.switch")}
              </a>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer class="site-footer">
          <div class="site-footer-inner">
            <div class="footer-brand">
              <span class="footer-name">{t(lang, "site.title")}</span>
              <span class="footer-line">{t(lang, "site.tagline")}</span>
            </div>
            <div class="footer-colophon">
              <p>
                &copy; {new Date().getFullYear()} {t(lang, "site.title")} —{" "}
                {t(lang, "footer")}
              </p>
            </div>
          </div>
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
              m.style.color='#6b6a64';
              m.textContent='...';
              try{
                var r=await fetch('/api/subscribe',{
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({email:email,lang:document.documentElement.lang==='zh-CN'?'zh':'en'})
                });
                var d=await r.json();
                if(r.ok){m.style.color='#1B365D';m.textContent=d.message;}
                else{m.style.color='#8C4B3F';m.textContent=d.error;}
              }catch(e){m.style.color='#8C4B3F';m.textContent='Network error';}
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
              msg.style.color=isError?'#8C4B3F':'#6b6a64';
            }
            function clearMsg(){if(msg){msg.textContent='';msg.style.color='#6b6a64';}}
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
                  html+='<a href="'+href+'" class="entry">'+
                    '<div class="entry-top">'+
                      '<span class="entry-date">'+escapeHtml(label)+'</span>'+
                      '<span class="tag'+(it.type==='weekly'?' tag--weekly':'')+'">'+escapeHtml(badge)+'</span>'+
                    '</div>'+
                    '<p class="entry-preview">'+escapeHtml(stripPreview(report))+'</p>'+
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
