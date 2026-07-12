// BuyrWorld service worker — offline-capable app shell + runtime caching.
// Bump CACHE when the caching strategy changes; hashed build assets are cached
// at runtime, so their new names are picked up automatically on deploy.
const CACHE = 'buyrworld-v2';   // v2: never intercept media (Range) requests — fixes silent MP3 music
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let cross-origin (fonts, etc.) hit the network

  // Media MUST bypass the service worker. Browsers fetch <audio>/<video> with HTTP
  // Range requests, and a SW that answers them from cache (or without proper 206
  // handling) silently breaks playback — this is what muted the MP3 soundtrack.
  // Let anything ranged or any audio/video file go straight to the network.
  if (req.headers.has('range') || /\.(mp3|ogg|wav|m4a|aac|flac|webm|mp4)$/i.test(url.pathname) || url.pathname.indexOf('/music/') === 0) return;

  // Navigations: network-first so a new deploy is picked up, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('/index.html', res.clone())); return res; })
                .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first, and populate the cache as they're fetched.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') { const clone = res.clone(); caches.open(CACHE).then((c) => c.put(req, clone)); }
      return res;
    }).catch(() => hit))
  );
});
