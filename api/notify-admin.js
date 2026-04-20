export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { venue_name, neighborhood, deal_details, submitter_email } = req.body || {}

  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL
  if (!adminEmail) return res.status(200).json({ ok: true }) // silently skip if not configured

  const subject = `New venue submission: ${venue_name || 'Unknown'}`
  const body = `A new venue has been submitted to Appy Hour for your review.

Venue: ${venue_name || '—'}
Neighborhood: ${neighborhood || '—'}
Deals: ${deal_details || '—'}
Submitted by: ${submitter_email || 'Anonymous'}

Review and approve at: ${process.env.REACT_APP_SITE_URL || 'your-site.vercel.app'}/admin

— Appy Hour`

  try {
    // Use mailto approach — works without SMTP setup
    // For production, swap this with Resend, SendGrid, or Mailchimp API
    const mailtoLink = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    res.status(200).json({ ok: true, mailto: mailtoLink })
  } catch (e) {
    res.status(500).json({ error: 'Failed to send notification' })
  }
}
