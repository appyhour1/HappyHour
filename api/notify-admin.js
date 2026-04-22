export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { venue_name, neighborhood, deal_details, submitter_email, schedules } = req.body || {}

  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  const siteUrl = process.env.REACT_APP_SITE_URL || 'https://www.happyhourunlocked.com'

  if (!adminEmail || !resendKey) {
    return res.status(200).json({ ok: true, skipped: true })
  }

  const scheduleLines = schedules?.length
    ? schedules.map(s => `  • ${s.days?.join(', ')} ${s.start_time}–${s.end_time}: ${s.deal_text}`).join('\n')
    : deal_details || '—'

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1A1612; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h1 style="color: #E85D1A; margin: 0; font-size: 22px;">Happy Hour Unlocked</h1>
        <p style="color: #888; margin: 4px 0 0; font-size: 14px;">New Venue Submission</p>
      </div>

      <div style="background: #F8F6F1; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #1A1612;">${venue_name || 'Unknown Venue'}</h2>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="color: #888; padding: 6px 0; width: 140px;">Neighborhood</td><td style="color: #1A1612; font-weight: 600;">${neighborhood || '—'}</td></tr>
          <tr><td style="color: #888; padding: 6px 0;">Submitted by</td><td style="color: #1A1612;">${submitter_email || 'Anonymous'}</td></tr>
          <tr><td style="color: #888; padding: 6px 0; vertical-align: top;">Deals / Schedule</td><td style="color: #1A1612; white-space: pre-line;">${scheduleLines}</td></tr>
        </table>
      </div>

      <a href="${siteUrl}/admin" style="display: inline-block; background: #E85D1A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Review &amp; Approve →
      </a>

      <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
        Happy Hour Unlocked · Cincinnati · <a href="${siteUrl}" style="color: #E85D1A;">happyhourunlocked.com</a>
      </p>
    </div>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Happy Hour Unlocked <notifications@happyhourunlocked.com>',
        to: [adminEmail],
        subject: `🍺 New venue submission: ${venue_name || 'Unknown'}`,
        html,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Resend error')
    res.status(200).json({ ok: true, id: data.id })
  } catch (e) {
    console.error('Email error:', e.message)
    // Don't fail the submission if email fails
    res.status(200).json({ ok: true, email_error: e.message })
  }
}
