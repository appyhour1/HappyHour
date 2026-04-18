/* service-worker.js — Appy Hour PWA */
const CACHE = 'appy-hour-v2'
const STATIC = [
  '/',
  '/static/js/main.chunk.js',
  '/static/css/main.chunk.css',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Only cache GET requests for same origin
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  // Don't cache Supabase API calls
  if (e.request.url.includes('supabase.co')) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE).then(cache => cache.put(e.request, clone))
        return response
      })
      .catch(() => caches.match(e.request))
  )
})
