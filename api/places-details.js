export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { place_id } = req.query
  if (!place_id) return res.status(400).json({ error: 'Missing place_id' })

  const key = process.env.REACT_APP_GOOGLE_PLACES_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const fields = 'name,formatted_address,formatted_phone_number,website,geometry,address_components'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=${fields}&key=${key}`
    const response = await fetch(url)
    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: 'Places API error' })
  }
}
