// Service Worker：快取 App 外殼和字體，讓 App 可以離線開啟。個人紀錄存在 IndexedDB，不在這裡。
const VERSION = 'ontime-v12';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/sync.js', './js/legacy.js', './js/actions.js', './js/logic.js', './js/time.js', './js/ui.js',
  './js/views/shared.js', './js/views/today.js', './js/views/hero.js', './js/views/timeline.js', './js/views/week.js',
  './js/views/sleep.js', './js/views/meals.js', './js/views/stats.js', './js/views/settings.js', './js/views/sheet.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
const FONT_CACHE = 'ontime-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // 外殼：先用快取，背景更新；頁面導覽離線時回到 index.html。
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
    if (hit) { net.catch(() => {}); return hit; }
    try { return await net; } catch { return (await c.match('./index.html')) || Response.error(); }
  }));
});
