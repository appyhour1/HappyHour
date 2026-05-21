/**
 * AgeVerification.tsx
 *
 * Single-screen age gate with T&C consent checkboxes.
 * Both policies must be agreed to before entering.
 * Stored in localStorage — never shown again after completion.
 */
import React, { useState, useEffect } from 'react'

// ─── TOGGLE THIS TO false TO DISABLE ─────────────
const ENABLED = true
// ─────────────────────────────────────────────────

const STORAGE_KEY = 'ah_age_verified'

function openLink(path: string) {
  const native = !!(window as any).Capacitor?.isNativePlatform?.()
  if (native) {
    import('@capacitor/browser').then(({ Browser }) =>
      Browser.open({ url: `https://www.happyhourunlocked.com${path}` })
    )
  } else {
    window.open(path, '_blank')
  }
}

export function AgeVerification() {
  const [show, setShow] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!ENABLED) return
    const verified = localStorage.getItem(STORAGE_KEY)
    if (!verified) setShow(true)
  }, [])

  const bothChecked = termsChecked && privacyChecked

  function handleConfirm() {
    if (!bothChecked) {
      setAttempted(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 600)
      return
    }
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  function handleDeny() {
    setShaking(true)
    setTimeout(() => setShaking(false), 600)
  }

  if (!show) return null

  return (
    <div className="age-gate-overlay">
      <div className={`age-gate-modal${shaking ? ' age-gate-shake' : ''}`}>

        {/* Logo */}
        <div className="age-gate-logo">
          <span className="age-gate-logo-appy">Happy Hour</span>
          <span className="age-gate-logo-hour"> Unlocked</span>
        </div>

        {/* Icon */}
        <div className="age-gate-icon">🔓</div>

        {/* Heading */}
        <h1 className="age-gate-title">Are you 21 or older?</h1>
        <p className="age-gate-sub">
          You must be of legal drinking age to enter.
        </p>

        {/* Checkboxes */}
        <div style={{ width: '100%', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Terms checkbox */}
          <div
            onClick={() => setTermsChecked(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: termsChecked ? '#F0FDF4' : attempted && !termsChecked ? '#FEF2F2' : '#F8F6F1',
              border: `1.5px solid ${termsChecked ? '#22C55E' : attempted && !termsChecked ? '#FCA5A5' : '#E0DDD8'}`,
              transition: 'all .15s',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, border: '2px solid',
              borderColor: termsChecked ? '#22C55E' : '#D0CDC8',
              background: termsChecked ? '#22C55E' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all .15s',
            }}>
              {termsChecked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: '#333', textAlign: 'left', lineHeight: 1.4 }}>
              I agree to the{' '}
              <span
                onClick={e => { e.stopPropagation(); openLink('/terms') }}
                style={{ color: 'var(--coral)', textDecoration: 'underline', fontWeight: 600 }}
              >Terms of Service</span>
            </span>
          </div>

          {/* Privacy checkbox */}
          <div
            onClick={() => setPrivacyChecked(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: privacyChecked ? '#F0FDF4' : attempted && !privacyChecked ? '#FEF2F2' : '#F8F6F1',
              border: `1.5px solid ${privacyChecked ? '#22C55E' : attempted && !privacyChecked ? '#FCA5A5' : '#E0DDD8'}`,
              transition: 'all .15s',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, border: '2px solid',
              borderColor: privacyChecked ? '#22C55E' : '#D0CDC8',
              background: privacyChecked ? '#22C55E' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all .15s',
            }}>
              {privacyChecked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: '#333', textAlign: 'left', lineHeight: 1.4 }}>
              I agree to the{' '}
              <span
                onClick={e => { e.stopPropagation(); openLink('/privacy') }}
                style={{ color: 'var(--coral)', textDecoration: 'underline', fontWeight: 600 }}
              >Privacy Policy</span>
            </span>
          </div>

        </div>

        {/* Error message */}
        {attempted && !bothChecked && (
          <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 10, fontWeight: 500 }}>
            Please agree to both policies to continue.
          </p>
        )}

        {/* Buttons */}
        <div className="age-gate-buttons">
          <button
            className="age-gate-yes"
            onClick={handleConfirm}
            style={{ opacity: bothChecked ? 1 : 0.5 }}
          >
            Yes, I'm 21+
          </button>
          <button className="age-gate-no" onClick={handleDeny}>
            No, I'm under 21
          </button>
        </div>

        {/* Disclaimer */}
        <p className="age-gate-disclaimer">
          Please drink responsibly.
        </p>

      </div>
    </div>
  )
}
