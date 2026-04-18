export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { input } = req.query
  if (!input) return res.status(400).json({ error: 'Missing input' })

  const key = process.env.REACT_APP_GOOGLE_PLACES_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input + ' Cincinnati')}&types=establishment&key=${key}`
    const response = await fetch(url)
    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: 'Places API error' })
  }
}
