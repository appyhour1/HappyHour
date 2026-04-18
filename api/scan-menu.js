export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.REACT_APP_ANTHROPIC_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const { base64, mediaType } = req.body
    if (!base64) return res.status(400).json({ error: 'Missing image data' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: base64,
              }
            },
            {
              type: 'text',
              text: `Look at this happy hour menu or chalkboard sign. Extract all the deals you can see.

Return ONLY valid JSON in this exact format, nothing else:
{
  "deals": [
    {"type": "beer|cocktail|food|wine|general", "description": "deal description", "price": "number or empty string"},
    ...
  ],
  "schedule": "days and times if visible, e.g. Mon-Fri 4-7pm",
  "dealText": "one line summary of all deals"
}

Rules:
- type must be exactly: beer, cocktail, food, wine, or general
- price should be a number like "3" or "5.50" or empty string "" if not specified or percentage off
- description should be concise, e.g. "$3 draft beer" or "Half-off appetizers"
- include ALL deals you can see`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: 'Scan failed' })
  }
}
