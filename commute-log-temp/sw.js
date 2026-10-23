const VERSION = '1.0.0';
const CACHE = 'commute-log-temp-' + VERSION;
const SHELL = ['./','./index.html','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u,{cache:'reload'}))))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('commute-log-temp-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request,{ignoreSearch:e.request.mode==='navigate'});
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request,r.clone()); return r; });
    if (hit) { net.catch(()=>{}); return hit; }
    try { return await net; } catch { return (await c.match('./index.html')) || Response.error(); }
  }));
});