/* يعمل التطبيق دون إنترنت مع تحديث موثوق للنسخة المخزنة */
const CACHE = 'mouin-v82';
const REM_CACHE = 'mouin-rem';
const CORE = ['./', './index.html', './manifest.webmanifest', './privacy.html', './ministry-logo.jpg', './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png', './apple-touch-icon.png'];
const APP_URL = new URL('./index.html', self.registration.scope).href;
const ROOT_PATH = new URL('./', self.registration.scope).pathname;
const APP_PATH = new URL('./index.html', self.registration.scope).pathname;
self.addEventListener('install', event => {
  event.waitUntil((async () => { const cache = await caches.open(CACHE); await cache.addAll(CORE); await self.skipWaiting(); })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(key => key.startsWith('mouin-') && key !== CACHE && key !== REM_CACHE).map(key => caches.delete(key))); await self.clients.claim(); })());
});
async function refreshNavigation(req, cache) {
  const response = await fetch(req, {cache: 'no-store'});
  if (response && response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
    const url = new URL(req.url);
    await cache.put(req, response.clone());
    if (url.origin === self.location.origin && (url.pathname === ROOT_PATH || url.pathname === APP_PATH)) {
      await cache.put(APP_URL, response.clone());
      await cache.put(new URL('./', self.registration.scope).href, response.clone());
    }
  }
  return response;
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/googlesyndication|doubleclick|googleads|adservice|googletagmanager|google-analytics|analytics\.google/.test(url.hostname)) return;
  if (url.pathname.indexOf('/data/') > -1 || url.hostname === 'api.github.com') return;

  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    const cachePromise = caches.open(CACHE);
    const updatePromise = cachePromise.then(cache => refreshNavigation(req, cache));
    /* التحديث يعمل في الخلفية؛ لا نربطه بزمن استجابة الصفحة المخزنة. */
    event.waitUntil(updatePromise.then(() => undefined).catch(() => undefined));
    event.respondWith((async () => {
      const cache = await cachePromise;
      const cached = await cache.match(req)
        || ((url.pathname === ROOT_PATH || url.pathname === APP_PATH) ? await cache.match(APP_URL) : null)
        || ((url.pathname === ROOT_PATH || url.pathname === APP_PATH) ? await cache.match(new URL('./', self.registration.scope).href) : null);
      if (cached) return cached;
      try {
        return await updatePromise;
      } catch (e) {
        const fallback = await cache.match(APP_URL) || await cache.match(new URL('./', self.registration.scope).href);
        if (fallback) return fallback;
        return new Response('التطبيق غير متاح حالياً. اتصل بالإنترنت وافتح معين الأستاذ مرة أخرى.', {
          status: 503,
          headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const response = await fetch(req);
    if (response && response.ok && (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.hostname))) {
      try { const cache = await caches.open(CACHE); await cache.put(req, response.clone()); } catch (e) {}
    }
    return response;
  })());
});
/* ===== التذكيرات: الخادم يرسل نبضة فارغة والنص يُبنى هنا من إعدادات الأستاذ ===== */
const TXT = {
  kh: ['هل حضّرت خطاطتك أستاذ(ة)؟', 'خطاطتك تنتظرك أستاذ(ة)، دقائق وتكتمل.', 'لا تنسَ خطاطة الحصة القادمة أستاذ(ة).'],
  md: ['هل كتبت المذكرة اليومية أستاذ(ة)؟', 'مذكرتك اليومية في انتظارك.', 'أكمل مذكرة اليوم قبل أن تنسى التفاصيل.'],
  jd: ['هل قمت بتحضير جذاذاتك أستاذ(ة)؟', 'جذاذاتك تنتظرك، افتح معين الأستاذ.', 'هل جذاذات الأسبوع جاهزة أستاذ(ة)؟']
};
async function readRem() { try { const r = await (await caches.open(REM_CACHE)).match('rem.json'); return r ? await r.json() : null; } catch (e) { return null; } }
function nowMA() {
  const p = new Intl.DateTimeFormat('en-GB', {timeZone:'Africa/Casablanca',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return {m:(+g('hour'))*60+(+g('minute')),d:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[g('weekday')]};
}
async function showRem() {
  let k=null; const st=await readRem(),n=nowMA();
  if(st&&Array.isArray(st.rem)){let best=1e9;st.rem.forEach(r=>{if(!r||!TXT[r.k]||!Array.isArray(r.d)||r.d.indexOf(n.d)<0)return;const a=String(r.t||'').split(':'),diff=Math.abs((+a[0])*60+(+a[1])-n.m);if(diff<best){best=diff;k=r.k}});if(best>90)k=null}
  const list=k?TXT[k]:null,body=list?list[Math.floor(Math.random()*list.length)]:'لديك تذكير من معين الأستاذ.';
  return self.registration.showNotification('معين الأستاذ',{body,icon:'./icon-192.png',badge:'./icon-192.png',lang:'ar',dir:'rtl',tag:'mouin-'+(k||'x'),renotify:true,data:{k}});
}
self.addEventListener('push',event=>{event.waitUntil(showRem())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const client of clients){if('focus'in client)return client.focus()}return self.clients.openWindow('./')}))});
