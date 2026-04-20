/**
 * Onboarding.tsx
 * Shows once on first visit, never again.
 * Set ENABLED = false to disable.
 */

import React, { useState, useEffect } from 'react'

const ENABLED = true
const STORAGE_KEY = 'ah_onboarded'

const steps = [
  {
    emoji: '🍺',
    title: 'Find happy hours near you',
    sub: 'Live deals, verified times, and real prices — all in one place.',
  },
  {
    emoji: '✓',
    title: 'Verified by locals',
    sub: 'Every deal is confirmed by real people who actually go out in Cincinnati.',
  },
  {
    emoji: '🆓',
    title: 'Free forever',
    sub: 'No ads in your way, no subscriptions. Just the best happy hours in Cincinnati.',
  },
]

export function Onboarding() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!ENABLED) return
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setShow(true)
  }, [])

  function handleNext() {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      handleDone()
    }
  }

  function handleDone() {
    setLeaving(true)
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, '1')
      setShow(false)
    }, 300)
  }

  if (!show) return null

  const current = steps[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(10,8,6,.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      opacity: leaving ? 0 : 1,
      transition: 'opacity .3s',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24,
        padding: '36px 28px 28px',
        maxWidth: 360, width: '100%',
        textAlign: 'center',
        transform: leaving ? 'scale(.95)' : 'scale(1)',
        transition: 'transform .3s',
      }}>
        {/* Logo */}
        <div style={{ fontSize: 13, fontWeight: 900, fontStyle: 'italic', marginBottom: 24, letterSpacing: -.5 }}>
          <span style={{ color: '#1A1612' }}>Appy</span>
          <span style={{ color: '#E85D1A' }}>Hour</span>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6, height: 6,
              borderRadius: 20,
              background: i === step ? '#E85D1A' : '#E0DDD8',
              transition: 'all .2s',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ fontSize: 44, marginBottom: 16, lineHeight: 1 }}>{current.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1612', letterSpacing: -.4, marginBottom: 10, lineHeight: 1.2 }}>
          {current.title}
        </div>
        <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 32 }}>
          {current.sub}
        </div>

        {/* Buttons */}
        <button
          onClick={handleNext}
          style={{
            width: '100%', padding: 14,
            background: '#E85D1A', color: '#fff',
            border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            marginBottom: 10, fontFamily: 'inherit',
          }}
        >
          {step < steps.length - 1 ? 'Next →' : "Let's go 🍺"}
        </button>
        <button
          onClick={handleDone}
          style={{
            width: '100%', padding: 10,
            background: 'none', color: '#aaa',
            border: 'none', fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
