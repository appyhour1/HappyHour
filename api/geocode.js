export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { address } = req.query
  if (!address) return res.status(400).json({ error: 'Missing address' })

  const key = process.env.REACT_APP_GOOGLE_PLACES_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      res.status(200).json({ lat: location.lat, lng: location.lng })
    } else {
      res.status(404).json({ error: 'Address not found' })
    }
  } catch (e) {
    res.status(500).json({ error: 'Geocoding failed' })
  }
}
