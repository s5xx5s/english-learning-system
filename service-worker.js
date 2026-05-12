/* =====================================================================
   service-worker.js
   Cache-first for shared assets; network-first for everything else with
   an offline.html fallback.

   Scope: same as where this file lives. On GitHub Pages that's
   `https://s5xx5s.github.io/english-learning-system/`. All URLs are
   resolved against `self.registration.scope` so the SW works equally
   well at `file://` and `localhost`.
   ===================================================================== */

const VERSION    = 'v1-2026-05-12';
const CACHE_NAME = 'english-shell-' + VERSION;

/* Files we precache for offline use. Keep this list small — anything
   weighty or dynamic should be cached on demand at fetch time. */
const PRECACHE_PATHS = [
  '',                            // root (index.html)
  'index.html',
  'offline.html',
  'manifest.json',
  'shared/styles.css',
  'shared/interactive.js',
  'shared/storage.js',
  'shared/audio.js',
  'icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const scope = self.registration.scope;
    const urls = PRECACHE_PATHS.map(p => new URL(p, scope).toString());
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // wipe old caches
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('english-shell-') && n !== CACHE_NAME)
           .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Don't intercept calls that go to other origins (Supabase REST,
  // LanguageTool API, esm.sh, Google Fonts). They have their own
  // browser-level cache + offline behaviour.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache  = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    // Stale-while-revalidate: serve cached if we have it, refresh in
    // background. Falls back to offline.html for navigation requests.
    const networkFetch = fetch(req).then(res => {
      // only cache successful, basic-type GET responses
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(async () => {
      if (req.mode === 'navigate') {
        const offline = await cache.match(
          new URL('offline.html', self.registration.scope).toString()
        );
        if (offline) return offline;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    });

    return cached || networkFetch;
  })());
});

/* Optional: respond to a "skip waiting" message so the page can prompt
   the user to refresh after a new version is detected. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
