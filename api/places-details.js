// COST SAVINGS: place_id → place details is completely deterministic.
// A place_id is a permanent Google identifier. The address, phone, and
// coordinates for a given place_id will not change between requests.
// Cache-Control: s-maxage=604800 (7 days) means Vercel's edge CDN serves
// this response for a week without invoking this function or billing Google.

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

  const { place_id } = req.query
  if (!place_id) return res.status(400).json({ error: 'Missing place_id' })

  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const fields = 'name,formatted_address,formatted_phone_number,website,geometry,address_components'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=${fields}&key=${key}`
    const response = await fetch(url)
    const data = await response.json()

    // Cache at Vercel's edge for 7 days — place_id details are immutable
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400')
    res.status(200).json(data)
  } catch (e) {
    console.error('Places details error:', e.message)
    res.status(500).json({ error: 'Places API error' })
  }
}
