'use strict';

const CACHE_VERSION = 'prometeo-v1.33.0-20260915-logo-sin-marco-final';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const MANAGED_CACHE_NAME_PATTERN = /^(?:prometeo|doren)-v[0-9][a-z0-9._-]*-(?:core|runtime)$/i;
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './assets/prometeo-logo.png',
  './assets/prometeo-logo-horizontal.png',
  './assets/apple-touch-icon.png',
  './pwa/manifest.webmanifest',
  './pwa/icons/icon-192.png',
  './pwa/icons/icon-512.png',
  './pwa/icons/icon-maskable-512.png'
];

function isManagedCacheName(name) {
  return MANAGED_CACHE_NAME_PATTERN.test(String(name || ''));
}

async function deleteObsoleteManagedCaches() {
  const keys = await caches.keys();
  const obsolete = keys.filter(
    (key) => isManagedCacheName(key) && ![CORE_CACHE, RUNTIME_CACHE].includes(key)
  );
  const results = await Promise.all(obsolete.map((key) => caches.delete(key)));
  return results.filter(Boolean).length;
}

async function refreshCoreCache() {
  const cache = await caches.open(CORE_CACHE);
  let refreshed = 0;

  for (const asset of CORE_ASSETS) {
    const url = new URL(asset, self.location.href).href;
    const request = new Request(url, { cache: 'no-store' });
    const response = await fetch(request);
    if (!response || !response.ok) {
      throw new Error(`No se pudo renovar el recurso técnico: ${asset}`);
    }
    await cache.put(request, response.clone());
    refreshed += 1;
  }

  return refreshed;
}

async function refreshPrometeoTechnicalCaches({ refreshCurrent = true } = {}) {
  const removedObsolete = await deleteObsoleteManagedCaches();
  let refreshedCore = 0;
  let runtimeReset = false;

  if (refreshCurrent) {
    refreshedCore = await refreshCoreCache();
    await caches.delete(RUNTIME_CACHE);
    await caches.open(RUNTIME_CACHE);
    runtimeReset = true;
  }

  return { removedObsolete, refreshedCore, runtimeReset };
}

self.addEventListener('install', (event) => {
  event.waitUntil(refreshCoreCache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    deleteObsoleteManagedCaches()
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (event.data?.type === 'PROMETEO_TECHNICAL_RESTART') {
    const port = event.ports?.[0] || null;
    event.waitUntil(
      refreshPrometeoTechnicalCaches({
        refreshCurrent: event.data?.refreshCurrent !== false
      })
        .then((result) => {
          if (port) port.postMessage({ ok: true, ...result });
        })
        .catch((error) => {
          console.warn('[PROMETEO] No se pudo completar la renovación técnica de cachés.', error);
          if (port) port.postMessage({ ok: false, error: String(error?.message || error) });
        })
    );
  }
});

async function networkFirst(request, fallbackUrl = null) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  const path = url.pathname;
  if (path.endsWith('/app.js') || path.endsWith('/styles.css') || path.endsWith('/manifest.webmanifest')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image' || path.includes('/pwa/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
