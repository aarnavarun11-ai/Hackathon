/* GhostFit service worker — makes the app installable and usable offline after the first visit.
   • App files: served from cache, refreshed in the background (stale-while-revalidate)
   • The pose AI (MediaPipe library + model) is cached after first use, so tracking works without Wi-Fi later
   • Nothing personal is cached here: workouts and history live only in this browser's local storage */
const VERSION = 'gf-v9';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/design.css', 'css/fonts.css', 'css/premium.css', 'js/core/adapt.js', 'js/core/app.js', 'js/core/art.js', 'js/core/bodymap.js', 'js/core/coach-engine.js', 'js/core/fx.js', 'js/core/link.js', 'js/core/store.js', 'js/core/util.js', 'js/core/viewer3d.js', 'js/core/voice.js', 'js/data/library.js', 'js/data/rehab.js', 'js/data/workouts.js', 'js/tracking/engine.js', 'js/tracking/exercises.js', 'js/tracking/ghost.js', 'js/tracking/pose.js', 'js/tracking/sim.js', 'js/views/builder.js', 'js/views/coach.js', 'js/views/components.js', 'js/views/dashboard.js', 'js/views/progress.js', 'js/views/rehab.js', 'js/views/replay.js', 'js/views/session.js', 'js/views/settings.js', 'js/views/tour.js', 'js/views/workouts.js', 'fonts/bricolage.woff2', 'fonts/instrument-sans.woff2', 'fonts/jetbrains-mono.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg', 'vendor/jsQR.js', 'vendor/qrcode.js', 'vendor/three.min.js'];
const AI_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'gf-ai').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (AI_HOSTS.includes(url.hostname) && /mediapipe/.test(url.pathname)) {
    // pose AI files never change for a given version: cache-first
    e.respondWith(caches.open('gf-ai').then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { caches.open(VERSION).then(c => c.put('index.html', res.clone())); return res; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
