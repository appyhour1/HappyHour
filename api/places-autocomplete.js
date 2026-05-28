// COST SAVINGS: Autocomplete results for the same query are stable within
// a short window. Cache-Control: s-maxage=300 (5 min) means repeated searches
// for "Precinct" or "Eagle" hit Vercel's CDN instead of billing Google.
// Also: city bias defaults to Cincinnati but accepts ?city= param for future expansion.

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

  const { input, city } = req.query
  if (!input) return res.status(400).json({ error: 'Missing input' })

  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  // Default to Cincinnati — pass ?city=Columbus to override when expanding
  const cityBias = (city && typeof city === 'string' && city.trim()) ? city.trim() : 'Cincinnati'
  const searchInput = `${input} ${cityBias}`

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchInput)}&types=establishment&key=${key}`
    const response = await fetch(url)
    const data = await response.json()

    // Cache at Vercel's edge for 5 minutes — short because suggestions
    // for partial queries change as the user types
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60')
    res.status(200).json(data)
  } catch (e) {
    console.error('Places autocomplete error:', e.message)
    res.status(500).json({ error: 'Places API error' })
  }
}
