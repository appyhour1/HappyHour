/**
 * AgeVerification.tsx
 *
 * Full-screen age gate shown on first visit.
 * CURRENTLY DISABLED — set ENABLED = true to activate at launch.
 *
 * Once a user confirms their age, it's stored in localStorage
 * and never shown again on that device.
 *
 * Usage in AppShell.tsx:
 *   import { AgeVerification } from './components/AgeVerification'
 *   // Add <AgeVerification /> anywhere inside the shell render
 */

import React, { useState, useEffect } from 'react'

// ─── TOGGLE THIS TO true AT LAUNCH ───────────────
const ENABLED = false
// ─────────────────────────────────────────────────

const STORAGE_KEY = 'ah_age_verified'

export function AgeVerification() {
  const [show, setShow] = useState(false)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (!ENABLED) return
    const verified = localStorage.getItem(STORAGE_KEY)
    if (!verified) setShow(true)
  }, [])

  function handleConfirm() {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  function handleDeny() {
    // Shake the modal and show a message
    setShaking(true)
    setTimeout(() => setShaking(false), 600)
  }

  if (!show) return null

  return (
    <div className="age-gate-overlay">
      <div className={`age-gate-modal${shaking ? ' age-gate-shake' : ''}`}>

        {/* Logo */}
        <div className="age-gate-logo">
          <span className="age-gate-logo-appy">Appy</span>
          <span className="age-gate-logo-hour">Hour</span>
        </div>

        {/* Icon */}
        <div className="age-gate-icon">🍺</div>

        {/* Heading */}
        <h1 className="age-gate-title">Are you 21 or older?</h1>
        <p className="age-gate-sub">
          You must be of legal drinking age to enter.
        </p>

        {/* Buttons */}
        <div className="age-gate-buttons">
          <button className="age-gate-yes" onClick={handleConfirm}>
            Yes, I'm 21+
          </button>
          <button className="age-gate-no" onClick={handleDeny}>
            No, I'm under 21
          </button>
        </div>

        {/* Disclaimer */}
        <p className="age-gate-disclaimer">
          By entering, you confirm you are of legal drinking age in your state.
          Please drink responsibly.
        </p>

        {/* Legal links */}
        <div className="age-gate-legal">
          <a href="/privacy" className="age-gate-legal-link">Privacy Policy</a>
          <span>·</span>
          <a href="/terms" className="age-gate-legal-link">Terms of Service</a>
        </div>

      </div>
    </div>
  )
}
