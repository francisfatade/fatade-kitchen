// Offline cache + update flow.
// release.ps1 bumps VERSION; the changed file makes the fridge see a new
// worker, which waits until someone taps "Update" in the app.
const VERSION = '1.17.0';
const CACHE = 'fatade-kitchen-' + VERSION;
const PHOTO_CACHE = 'fatade-photos';   // meal photos (kept across versions)
const FILES = ['./', './index.html', './prices.js', './recipes.js', './photos.js', './family.js', './glucose.js', './profiles.js', './hungry.js', './votes.js', './updater.js', './planner.js', './howto.js', './videos.js', './recipeview.js','./family.css', './theme.css','./manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PHOTO_CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'version') e.source.postMessage({ version: VERSION });
});

// App files come from this version's cache (works offline, changes only on Update).
// Anything else (recipe pages, store sites) goes straight to the network.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const host = new URL(e.request.url).hostname;
  // Meal photos: keep a copy the first time they load, so they show offline too
  if (host === 'commons.wikimedia.org' || host === 'upload.wikimedia.org') {
    e.respondWith(caches.open(PHOTO_CACHE).then(c => c.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => { if (res.ok || res.type === 'opaque') c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
