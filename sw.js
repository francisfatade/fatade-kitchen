// Offline cache + update flow.
// release.ps1 bumps VERSION; the changed file makes the fridge see a new
// worker, which waits until someone taps "Update" in the app.
const VERSION = '1.12.0';
const CACHE = 'fatade-kitchen-' + VERSION;
const FILES = ['./', './index.html', './prices.js', './recipes.js', './family.js', './glucose.js', './profiles.js', './hungry.js', './votes.js', './updater.js','./family.css', './theme.css','./manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'version') e.source.postMessage({ version: VERSION });
});

// App files come from this version's cache (works offline, changes only on Update).
// Anything else (recipe pages, store sites) goes straight to the network.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
