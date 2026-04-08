/**
 * EmailCapture.tsx
 *
 * Polite email capture. Appears after:
 *   - 45 seconds on the browse page
 *   - OR immediately after a user saves their first favorite
 *
 * Stores email in Supabase email_signups table.
 * Never shown again once dismissed or submitted (localStorage flag).
 *
 * COPY STRATEGY: Lead with value ("Best happy hours, every Thursday")
 * not with what they're giving up. One field. One click.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Analytics } from '../services/analytics'

const DISMISSED_KEY = 'hh_email_dismissed'

function hasDismissed(): boolean {
  try { return !!localStorage.getItem(DISMISSED_KEY) } catch { return false }
}
function setDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
}

interface EmailCaptureProps {
  trigger: 'timer' | 'favorite' | 'manual'
  city?: string
  onDismiss?: () => void
}

export function EmailCapture({ trigger, city = 'Cincinnati', onDismiss }: EmailCaptureProps) {
  const [email, setEmail]     = useState('')
  const [status, setStatus]   = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (hasDismissed()) return
    // Slight delay so it doesn't feel jarring
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [])

  if (!visible || hasDismissed()) return null

  function dismiss() {
    setDismissed()
    setVisible(false)
    onDismiss?.()
  }

  async function handleSubmit() {
    if (!email.trim() || !email.includes('@')) return
    setStatus('submitting')
    try {
      await supabase.from('email_signups').insert([{
        email: email.trim().toLowerCase(),
        city,
        source: trigger,
      }])
      Analytics.track('email_signup', { trigger, city })
      setStatus('success')
      setDismissed()
      setTimeout(() => { setVisible(false); onDismiss?.() }, 2000)
    } catch {
      // Likely duplicate — treat as success
      setStatus('success')
      setDismissed()
      setTimeout(() => { setVisible(false); onDismiss?.() }, 2000)
    }
  }

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && dismiss()}>
      <div className="ec-modal">
        <button className="ec-close" onClick={dismiss} aria-label="Close">✕</button>

        <div className="ec-icon">🍺</div>
        <h2 className="ec-title">Best happy hours, every Thursday</h2>
        <p className="ec-sub">
          One email a week with the best deals in {city}.
          No spam. Unsubscribe any time.
        </p>

        {status === 'success' ? (
          <div className="ec-success">
            <span className="ec-success-icon">✓</span>
            You're in! See you Thursday.
          </div>
        ) : (
          <div className="ec-form">
            <input
              className="ec-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            <button
              className="ec-btn"
              onClick={handleSubmit}
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Saving...' : 'Get weekly deals'}
            </button>
          </div>
        )}

        <button className="ec-skip" onClick={dismiss}>No thanks</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HOOK — manages when to show the capture
// ─────────────────────────────────────────────

export function useEmailCapture(favoritesCount: number) {
  const [showCapture, setShowCapture] = useState(false)
  const [trigger, setTrigger] = useState<'timer' | 'favorite'>('timer')

  // Timer trigger — 45 seconds
  useEffect(() => {
    if (hasDismissed()) return
    const t = setTimeout(() => {
      setTrigger('timer')
      setShowCapture(true)
    }, 45_000)
    return () => clearTimeout(t)
  }, [])

  // Favorite trigger — first save
  useEffect(() => {
    if (hasDismissed() || favoritesCount !== 1) return
    // Small delay so the heart animation finishes
    const t = setTimeout(() => {
      setTrigger('favorite')
      setShowCapture(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [favoritesCount])

  return { showCapture, trigger, dismiss: () => setShowCapture(false) }
}
