/* يعمل التطبيق دون إنترنت: تخزين الملفات الأساسية عند التثبيت */
const CACHE = 'mouin-v17';
const CORE = ['./', './index.html', './manifest.webmanifest', './privacy.html',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* الإعلانات لا تُخزَّن */
  if (/googlesyndication|doubleclick|googleads|adservice/.test(url.hostname)) return;
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
