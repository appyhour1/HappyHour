// NOTE ON RATE LIMITING:
// In-memory rate limiting won't work reliably in serverless functions because
// each invocation may be a new process. For real rate limiting, add Upstash Redis:
// https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
// Until then, the CORS origin restriction below is the primary defense.

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Reject requests not from our allowed origins
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // ANTHROPIC_API_KEY (no REACT_APP_ prefix) must be set in Vercel
  // under Settings → Environment Variables → Server scope
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const { base64, mediaType } = req.body
    if (!base64) return res.status(400).json({ error: 'Missing image data' })

    // Reject suspiciously large payloads (approx 1.5MB image)
    if (base64.length > 2_000_000) {
      return res.status(400).json({ error: 'Image too large' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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

    if (!response.ok) {
      console.error('Anthropic API error:', JSON.stringify(data))
      return res.status(200).json({ error: 'Anthropic API error', details: data })
    }

    const text = data.content?.[0]?.text ?? ''
    if (!text) {
      console.error('Empty response from Anthropic:', JSON.stringify(data))
      return res.status(200).json({ error: 'Empty response', raw: data })
    }

    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      return res.status(200).json(parsed)
    } catch (parseErr) {
      console.error('JSON parse error:', text)
      return res.status(200).json({ error: 'Could not parse response', raw: text })
    }
  } catch (e) {
    console.error('Scan error:', e.message)
    res.status(500).json({ error: 'Scan failed', details: e.message })
  }
}
