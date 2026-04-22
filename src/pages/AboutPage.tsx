/**
 * AboutPage.tsx
 * Route: /about
 */

import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL!, process.env.REACT_APP_SUPABASE_ANON_KEY!)

function InquiryForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [bar, setBar] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !bar || !email) return
    setSubmitting(true)
    await supabase.from('contributions').insert([{
      flow: 'bar_inquiry',
      status: 'pending',
      data: { name, bar_name: bar, email, message },
      created_at: new Date().toISOString(),
    }])
    setDone(true)
    setSubmitting(false)
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1612', marginBottom: 8 }}>We'll be in touch!</div>
      <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 20 }}>
        Thanks for reaching out. We'll review your inquiry and contact you at <strong>{email}</strong> within 1–2 business days.
      </div>
      <button onClick={onClose} style={{ height: 38, padding: '0 20px', background: '#E85D1A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Done
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#1A1612', marginBottom: 4 }}>Get your bar listed</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
        Fill out the form below and we'll reach out to discuss getting your bar featured on Happy Hour Unlocked.
      </div>
      {[
        { label: 'Your name', value: name, set: setName, placeholder: 'Jane Smith', type: 'text' },
        { label: 'Bar / restaurant name', value: bar, set: setBar, placeholder: 'The Rusty Anchor', type: 'text' },
        { label: 'Email address', value: email, set: setEmail, placeholder: 'jane@yourbar.com', type: 'email' },
      ].map(({ label, value, set, placeholder, type }) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
          <input
            type={type} value={value} onChange={e => set(e.target.value)}
            placeholder={placeholder} required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E0DDD8', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
          />
        </div>
      ))}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Anything else? (optional)</div>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Tell us about your happy hour deals, hours, etc."
          rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E0DDD8', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' as const }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, height: 42, border: '1px solid #E0DDD8', borderRadius: 8, background: 'none', fontSize: 14, color: '#888', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} style={{ flex: 2, height: 42, background: '#E85D1A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? .6 : 1 }}>
          {submitting ? 'Sending...' : 'Send inquiry →'}
        </button>
      </div>
    </form>
  )
}

export default function AboutPage() {
  const [showInquiry, setShowInquiry] = useState(false)

  return (
    <>
      <Helmet>
        <title>About — Happy Hour Unlocked Cincinnati</title>
        <meta name="description" content="Happy Hour Unlocked connects Cincinnati bar-goers with the best happy hour deals while helping local bars fill seats during slower hours." />
      </Helmet>

      <div className="about-page">

        {/* ── HERO ── */}
        <div className="about-hero">
          <div className="about-hero-logo">
            <span className="about-logo-appy">Happy Hour</span>
            <span className="about-logo-hour"> Unlocked</span>
          </div>
          <p className="about-hero-tagline">Connecting Cincinnati to its best happy hours.</p>
        </div>

        {/* ── MISSION ── */}
        <div className="about-section">
          <div className="about-section-icon">🍺</div>
          <h2 className="about-section-title">Why we built this</h2>
          <p className="about-section-body">
            Happy hours are one of the best things about going out — great drinks, great prices, great company. But finding them was always a hassle. Googling bar websites, checking outdated Yelp pages, texting friends who might know. There was no single place that just told you what was happening right now, near you, with real prices.
          </p>
          <p className="about-section-body">
            So we built Happy Hour Unlocked. One place for Cincinnati's best happy hour deals, with live status, verified times, and real deal information.
          </p>
        </div>

        {/* ── WIN-WIN ── */}
        <div className="about-section">
          <div className="about-section-icon">🤝</div>
          <h2 className="about-section-title">Good for everyone</h2>
          <p className="about-section-body">
            Happy hours exist because bars want to bring in customers during slower hours. Happy Hour Unlocked helps make that happen — by putting the right deal in front of the right person at exactly the right moment.
          </p>
          <div className="about-cards">
            <div className="about-card">
              <div className="about-card-icon">🏠</div>
              <div className="about-card-title">For bars & restaurants</div>
              <div className="about-card-body">Get discovered by people actively looking for somewhere to go right now. More seats filled during happy hour means a better evening for everyone.</div>
            </div>
            <div className="about-card">
              <div className="about-card-icon">🙋</div>
              <div className="about-card-title">For customers</div>
              <div className="about-card-body">Find great deals without the guesswork. See exactly what's on special, when it ends, and how to get there — before you leave the house.</div>
            </div>
          </div>
        </div>

        {/* ── COMMUNITY ── */}
        <div className="about-section">
          <div className="about-section-icon">🌆</div>
          <h2 className="about-section-title">Built by Cincinnati, for Cincinnati</h2>
          <p className="about-section-body">
            Every deal on Happy Hour Unlocked is submitted or confirmed by real people who go out in Cincinnati. When you tap "Still accurate" on a venue, you're helping your neighbors make better plans. The more people use it, the better it gets for everyone.
          </p>
          <p className="about-section-body">
            Know a bar with a great happy hour that's not listed? Add it. See a deal that's changed? Suggest a correction. This app gets better every time someone contributes.
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="about-cta">
          <Link to="/" className="about-cta-btn">Find a happy hour →</Link>
          <button onClick={() => setShowInquiry(true)} className="about-add-btn" style={{ border: 'none', cursor: 'pointer' }}>
            Inquire about listing your bar
          </button>
        </div>

        {/* ── INQUIRE ── */}
        <div className="about-section">
          <div className="about-section-icon">📬</div>
          <h2 className="about-section-title">Get in touch</h2>
          <p className="about-section-body">
            Whether you're a bar owner wanting to get listed, a brand interested in advertising, or just have a question — we'd love to hear from you.
          </p>
          <div className="about-cards">
            <div className="about-card">
              <div className="about-card-icon">🏠</div>
              <div className="about-card-title">Bar owners</div>
              <div className="about-card-body">Get your venue featured and reach Cincinnati's most engaged happy hour audience.</div>
            </div>
            <div className="about-card">
              <div className="about-card-icon">📣</div>
              <div className="about-card-title">Brand partnerships</div>
              <div className="about-card-body">Advertise to a hyper-local audience of bar-goers actively planning their night out.</div>
            </div>
          </div>
          <a
            href="mailto:info@happyhourunlocked.com"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 16, padding: '14px 20px',
              background: '#1A1612', color: '#fff', borderRadius: 12,
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
            }}
          >
            ✉️ info@happyhourunlocked.com
          </a>
        </div>

        {/* ── FOOTER LINKS ── */}
        <div className="about-legal">
          <Link to="/privacy" className="about-legal-link">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="about-legal-link">Terms of Service</Link>
        </div>

      </div>

      {/* ── INQUIRY MODAL ── */}
      {showInquiry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', z: 600, padding: 20, zIndex: 600 }}
          onClick={e => e.target === e.currentTarget && setShowInquiry(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <InquiryForm onClose={() => setShowInquiry(false)} />
          </div>
        </div>
      )}
    </>
  )
}
