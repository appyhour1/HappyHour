/**
 * ClaimVenueForm.tsx
 *
 * Bar owner claiming flow.
 * Sends to contributions table with flow = 'claim_venue'.
 * Shows on venue detail pages as "Is this your bar? Claim it free."
 *
 * What claiming gets you (shown in the form):
 *   - Verified badge on your listing
 *   - Priority placement in results
 *   - Direct edit access to your deals
 *   - Weekly stats email (how many people viewed your listing)
 */

import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../services/analytics'
import type { Venue } from '../types'

interface ClaimVenueFormProps {
  venue: Venue
  onClose: () => void
}

export function ClaimVenueForm({ venue, onClose }: ClaimVenueFormProps) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole]   = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError]   = useState('')

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !role.trim()) {
      setError('Please fill in your name, email, and role.')
      return
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setStatus('submitting')
    setError('')
    try {
      await supabase.from('contributions').insert([{
        flow: 'claim_venue',
        status: 'pending',
        data: {
          venue_id:   venue.id,
          venue_name: venue.name,
          owner_name: name.trim(),
          owner_email: email.trim(),
          owner_role:  role.trim(),
          owner_phone: phone.trim() || null,
          notes: notes.trim() || null,
        },
        created_at: new Date().toISOString(),
      }])
      track('venue_claim_submitted', { venue_id: venue.id, venue_name: venue.name })
      setStatus('success')
    } catch {
      setStatus('error')
      setError('Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="claim-success">
        <div className="claim-success-icon">🎉</div>
        <h3 className="claim-success-title">Claim request sent!</h3>
        <p className="claim-success-msg">
          We'll review your request and reach out to {email} within 24 hours
          to verify and activate your listing.
        </p>
        <button className="claim-done-btn" onClick={onClose}>Done</button>
      </div>
    )
  }

  return (
    <div className="claim-form">
      <div className="claim-header">
        <h3 className="claim-title">Claim {venue.name}</h3>
        <button className="claim-close" onClick={onClose}>✕</button>
      </div>

      {/* Benefits */}
      <div className="claim-benefits">
        <div className="claim-benefit">✓ Verified badge on your listing</div>
        <div className="claim-benefit">✓ Priority placement in search results</div>
        <div className="claim-benefit">✓ Direct edit access to your deals</div>
        <div className="claim-benefit">✓ Weekly views report — free forever</div>
      </div>

      {error && <div className="claim-error">{error}</div>}

      <div className="claim-field">
        <label className="claim-label">Your name *</label>
        <input className="claim-input" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
      </div>

      <div className="claim-field">
        <label className="claim-label">Your email *</label>
        <input className="claim-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@theeagleotr.com" />
      </div>

      <div className="claim-field">
        <label className="claim-label">Your role at this venue *</label>
        <select className="claim-select" value={role} onChange={e => setRole(e.target.value)}>
          <option value="">Select...</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="marketing">Marketing / PR</option>
          <option value="other">Other staff</option>
        </select>
      </div>

      <div className="claim-field">
        <label className="claim-label">Phone (optional)</label>
        <input className="claim-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(513) 555-0100" />
      </div>

      <div className="claim-field">
        <label className="claim-label">Anything to add? (optional)</label>
        <textarea className="claim-textarea" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Our happy hour changed, here's the update..." rows={2} />
      </div>

      <button className="claim-submit-btn" onClick={handleSubmit} disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending...' : 'Claim this listing — free'}
      </button>

      <p className="claim-note">
        We verify all claims before activating. Usually within 24 hours.
      </p>
    </div>
  )
}
