/**
 * Onboarding.tsx
 * Shows once on first visit, never again.
 */

import React, { useState, useEffect } from 'react'

const ENABLED = true
const STORAGE_KEY = 'hhu_onboarded_v1'

const steps = [
  {
    emoji: '🍺',
    title: 'Welcome to Happy Hour Unlocked',
    sub: 'The best happy hour deals in Cincinnati — live, verified, and always up to date.',
    hint: null,
  },
  {
    emoji: '🔍',
    title: 'Browse & filter deals',
    sub: 'Search by neighborhood, deal type, or price. Tap any card to see full details, hours, and directions.',
    hint: 'Tip: The Live tab shows only bars open for happy hour right now.',
  },
  {
    emoji: '⭐',
    title: 'Save your favorites',
    sub: 'Tap the heart on any venue to save it. Your saved spots live in the Browse tab for quick access.',
    hint: 'Tip: Featured venues are paid partners with verified deals.',
  },
  {
    emoji: '🗺️',
    title: 'Build a bar crawl',
    sub: "Use the Bar Crawl tab to pick multiple stops and plan your night. We'll map the route for you.",
    hint: 'Tip: Add a new spot anytime using "+ Add a spot" in the top menu.',
  },
  {
    emoji: '✓',
    title: 'Verified by locals',
    sub: 'Every deal is confirmed by real people. If a deal looks wrong, tap "Suggest an edit" on the venue page.',
    hint: null,
  },
]

export function Onboarding() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!ENABLED) return
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setShow(true)
  }, [])

  function handleNext() {
    if (animating) return
    if (step < steps.length - 1) {
      setAnimating(true)
      setTimeout(() => { setStep(s => s + 1); setAnimating(false) }, 150)
    } else {
      handleDone()
    }
  }

  function handleDone() {
    setLeaving(true)
    setTimeout(() => { localStorage.setItem(STORAGE_KEY, '1'); setShow(false) }, 300)
  }

  if (!show) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(10,8,6,.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      opacity: leaving ? 0 : 1,
      transition: 'opacity .3s',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24,
        padding: '32px 24px 24px',
        maxWidth: 360, width: '100%',
        textAlign: 'center',
        transform: leaving ? 'scale(.96)' : 'scale(1)',
        transition: 'transform .3s',
      }}>

        {/* Logo */}
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 20, letterSpacing: -.3 }}>
          <span style={{ color: '#1A1612' }}>Happy Hour</span>
          <span style={{ color: '#E85D1A' }}> Unlocked</span>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} onClick={() => !animating && setStep(i)} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 20,
              background: i === step ? '#E85D1A' : i < step ? '#F5B99A' : '#E0DDD8',
              transition: 'all .25s', cursor: 'pointer',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity .15s, transform .15s',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14, lineHeight: 1 }}>{current.emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1A1612', letterSpacing: -.4, marginBottom: 10, lineHeight: 1.25 }}>
            {current.title}
          </div>
          <div style={{ fontSize: 14, color: '#555', lineHeight: 1.65, marginBottom: current.hint ? 12 : 28 }}>
            {current.sub}
          </div>
          {current.hint && (
            <div style={{
              background: '#FFF8F5', border: '1px solid #FDDBC9',
              borderRadius: 10, padding: '8px 12px',
              fontSize: 12, color: '#B84D12', fontWeight: 600,
              marginBottom: 24, textAlign: 'left', lineHeight: 1.5,
            }}>
              {current.hint}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#F0EDE8', borderRadius: 20, marginBottom: 18, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / steps.length) * 100}%`,
            background: '#E85D1A', borderRadius: 20, transition: 'width .3s',
          }} />
        </div>

        <button onClick={handleNext} style={{
          width: '100%', padding: 14,
          background: '#E85D1A', color: '#fff',
          border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700,
          cursor: 'pointer', marginBottom: 8,
          fontFamily: 'inherit',
        }}>
          {isLast ? "Let's find happy hour 🍺" : 'Next →'}
        </button>

        {!isLast && (
          <button onClick={handleDone} style={{
            width: '100%', padding: 8,
            background: 'none', color: '#aaa',
            border: 'none', fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Skip intro
          </button>
        )}

        <div style={{ fontSize: 11, color: '#ccc', marginTop: 6 }}>
          {step + 1} of {steps.length}
        </div>
      </div>
    </div>
  )
}
