/*
 * Weathervane service worker (hand-written, no dependencies).
 *
 * What it does
 *  - Pages:      network first (always the newest version when online), cached copy when offline.
 *  - App files:  stale-while-revalidate (instant load, refreshed in the background).
 *  - Weather API: network first; if you are offline, the last successful answer is served,
 *                 so the app still shows your last forecast.
 *  - Fonts:      stale-while-revalidate.
 *
 * To force every user to drop old caches after a risky change: bump VERSION below.
 * To REMOVE the service worker for everyone: see "Kill switch" in INTEGRATION.md.
 */
const VERSION = 'v1';
const SHELL = `wv-shell-${VERSION}`;
const DATA = `wv-data-${VERSION}`;

const API_HOSTS = [
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'air-quality-api.open-meteo.com',
  'api.bigdatacloud.net',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const MAX_DATA_ENTRIES = 40;
const PAGE_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  // Cache the page and the files it references now, so the very first offline visit works too.
  event.waitUntil(precacheShell().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('wv-') && n !== SHELL && n !== DATA).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirstData(request));
  } else if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
  // anything else: let the browser handle it normally
});

async function precacheShell() {
  const cache = await caches.open(SHELL);
  const scope = self.registration.scope;
  const response = await fetch(scope, { cache: 'reload' });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(scope, response);

  // Find the script/style/icon files that index.html references (Angular uses hashed names).
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = new URL(match[1], scope);
    if (url.origin === self.location.origin && /\.(?:js|css|png|svg|webmanifest)$/.test(url.pathname)) urls.add(url.href);
  }
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})));
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await withTimeout(fetch(request), PAGE_TIMEOUT_MS);
    if (response.ok) cache.put(self.registration.scope, response.clone());
    return response;
  } catch {
    return (await cache.match(self.registration.scope)) || Response.error();
  }
}

async function networkFirstData(request) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trim(cache, MAX_DATA_ENTRIES);
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  event.waitUntil(refresh);
  return cached || (await refresh) || Response.error();
}

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}
