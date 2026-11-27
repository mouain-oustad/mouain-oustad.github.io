/* يعمل التطبيق دون إنترنت: تخزين الملفات الأساسية عند التثبيت */
const CACHE = 'mouin-v62';
const CORE = ['./', './index.html', './manifest.webmanifest', './privacy.html',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'mouin-rem').map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* الإعلانات لا تُخزَّن */
  if (/googlesyndication|doubleclick|googleads|adservice|googletagmanager|google-analytics|analytics\.google/.test(url.hostname)) return;
  /* معطيات الحصص: الشبكة دائماً (التطبيق يحفظها بنفسه) */
  if (url.pathname.indexOf('/data/') > -1) return;
  /* لا تخزين لطلبات GitHub (لوحة المشرف) */
  if (url.hostname === 'api.github.com') return;
  /* صفحات التطبيق: الشبكة أولاً ثم النسخة المخزنة */
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  /* باقي الملفات والخطوط: النسخة المخزنة أولاً */
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.hostname))) {
      const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c));
    }
    return r;
  })));
});

/* ===== التذكيرات: الخادم يرسل نبضة فارغة والنص يُبنى هنا من إعدادات الأستاذ ===== */
const TXT = {
  kh: ['هل حضّرت خطاطتك أستاذ(ة)؟', 'خطاطتك تنتظرك أستاذ(ة)، دقائق وتكتمل.', 'لا تنسَ خطاطة الحصة القادمة أستاذ(ة).'],
  md: ['هل كتبت المذكرة اليومية أستاذ(ة)؟', 'مذكرتك اليومية في انتظارك.', 'أكمل مذكرة اليوم قبل أن تنسى التفاصيل.'],
  jd: ['هل قمت بتحضير جذاذاتك أستاذ(ة)؟', 'جذاذاتك تنتظرك، افتح معين الأستاذ.', 'هل جذاذات الأسبوع جاهزة أستاذ(ة)؟']
};
async function readRem() {
  try { const r = await (await caches.open('mouin-rem')).match('rem.json'); return r ? await r.json() : null; } catch (e) { return null; }
}
function nowMA() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return { m: (+g('hour')) * 60 + (+g('minute')), d: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[g('weekday')] };
}
async function showRem() {
  let k = null;
  const st = await readRem(), n = nowMA();
  if (st && Array.isArray(st.rem)) {
    let best = 1e9;
    st.rem.forEach(r => {
      if (!r || !TXT[r.k] || !Array.isArray(r.d) || r.d.indexOf(n.d) < 0) return;
      const a = r.t.split(':'), diff = Math.abs((+a[0]) * 60 + (+a[1]) - n.m);
      if (diff < best) { best = diff; k = r.k; }
    });
    if (best > 90) k = null;
  }
  const list = k ? TXT[k] : null;
  const body = list ? list[Math.floor(Math.random() * list.length)] : 'لديك تذكير من معين الأستاذ.';
  return self.registration.showNotification('معين الأستاذ', { body, icon: './icon-192.png', badge: './icon-192.png', lang: 'ar', dir: 'rtl', tag: 'mouin-' + (k || 'x'), renotify: true, data: { k } });
}
self.addEventListener('push', e => { e.waitUntil(showRem()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
