// COST SAVINGS: Address → coordinates is deterministic and never changes.
// Cache-Control: s-maxage=86400 tells Vercel's edge CDN to cache this response
// for 24 hours. Identical address lookups hit the CDN, not this function,
// not Google's API. Eliminates repeat charges for the same address.

const ALLOWED_ORIGINS = [
  'https://www.happyhourunlocked.com',
  'https://happyhourunlocked.com',
]

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!ALLOWED_ORIGINS.includes(origin) && origin !== '') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { address } = req.query
  if (!address) return res.status(400).json({ error: 'Missing address' })

  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      // Cache at Vercel's edge for 24h — address→coords never changes
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
      res.status(200).json({ lat: location.lat, lng: location.lng })
    } else {
      res.status(404).json({ error: 'Address not found' })
    }
  } catch (e) {
    console.error('Geocode error:', e.message)
    res.status(500).json({ error: 'Geocoding failed' })
  }
}
