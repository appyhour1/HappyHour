/* service-worker.js — Appy Hour PWA v3 */
const CACHE = 'appy-hour-v3'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Delete ALL old caches on every update
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return

  // Always go to network first — only fall back to cache if offline
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Only cache successful responses for offline support
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return response
      })
      .catch(() => caches.match(e.request))
  )
})
