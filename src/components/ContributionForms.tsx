/**
 * ContributionForms.tsx
 *
 * NewVenueForm — saves directly to Supabase venues + schedules tables
 * SuggestEditForm — sends correction suggestions to contributions table
 */

import React, { useState } from 'react'
import { PlacesSearch, type PlaceResult } from './PlacesSearch'
import { supabase } from '../lib/supabase'
import type { Venue, DayOfWeek } from '../types'
import { DAYS_OF_WEEK } from '../types'
import {
  submitContribution,
  validateEditSuggestion,
  type EditSuggestion,
  type ValidationError,
} from '../services/contributionService'

// ─────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="cf-field">
      <label className="cf-label">{label}{required && <span className="cf-required"> *</span>}</label>
      {hint && <p className="cf-hint">{hint}</p>}
      {children}
      {error && <span className="cf-error">{error}</span>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="cf-input" {...props} />
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="cf-textarea" {...props} />
}


// ─────────────────────────────────────────────
// PHOTO SCAN — uses Claude AI to read deal photos
// ─────────────────────────────────────────────

interface ScannedDeal {
  type: DealType
  description: string
  price: string
}

interface ScanResult {
  deals: ScannedDeal[]
  schedule?: string
  dealText?: string
}

async function scanMenuPhoto(base64: string): Promise<ScanResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
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
  const text = data.content?.[0]?.text ?? ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

function PhotoScan({ onScanned }: { onScanned: (result: ScanResult) => void }) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setScanning(true)

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          setPreview(result)
          res(result.split(',')[1])
        }
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const result = await scanMenuPhoto(base64)
      onScanned(result)
    } catch {
      setError('Could not read the photo. Try a clearer image or fill in manually.')
    }
    setScanning(false)
  }

  return (
    <div className="cf-photo-scan">
      <label className="cf-photo-label">
        <input
          type="file"
          accept="image/*"

          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <div className="cf-photo-btn">
          {scanning ? (
            <>
              <span className="cf-spinner" />
              Reading your photo...
            </>
          ) : (
            <>
              📷 Scan happy hour menu or sign
            </>
          )}
        </div>
      </label>
      {preview && !scanning && (
        <div className="cf-photo-preview">
          <img src={preview} alt="Menu preview" style={{ width: '100%', borderRadius: 8, maxHeight: 160, objectFit: 'cover' }} />
          <div className="cf-photo-success">✓ Deals extracted — review below</div>
        </div>
      )}
      {error && <div className="cf-error">{error}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
// DEAL TYPE COLORS
// ─────────────────────────────────────────────

type DealType = 'beer' | 'cocktail' | 'food' | 'wine' | 'general'

const DEAL_COLORS: Record<DealType, { bg: string; color: string; border: string }> = {
  beer:     { bg: '#FFF8E8', color: '#7A5000', border: '#F5D88A' },
  cocktail: { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  food:     { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  wine:     { bg: '#FFF0F6', color: '#7A0038', border: '#FBCFE8' },
  general:  { bg: '#F5F3EF', color: '#4A4540', border: '#D8D4CC' },
}

interface DealItem { type: DealType; description: string; price: string }

// ─────────────────────────────────────────────
// NEW VENUE FORM — saves directly to Supabase
// ─────────────────────────────────────────────

export function NewVenueForm({ onClose }: { onClose?: () => void }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Venue fields
  const [name, setName]               = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city]                        = useState('Cincinnati')
  const [address, setAddress]         = useState('')
  const [website, setWebsite]         = useState('')
  const [phone, setPhone]             = useState('')
  const [dogFriendly, setDogFriendly] = useState(false)

  // Schedule fields
  const [days, setDays]               = useState<DayOfWeek[]>([])
  const [startTime, setStartTime]     = useState('16:00')
  const [endTime, setEndTime]         = useState('19:00')
  const [isAllDay, setIsAllDay]       = useState(false)
  const [dealText, setDealText]       = useState('')

  // Deals
  const [deals, setDeals] = useState<DealItem[]>([
    { type: 'beer', description: '', price: '' }
  ])

  function handlePhotoScan(result: ScanResult) {
    if (result.deals && result.deals.length > 0) {
      setDeals(result.deals.map(d => ({
        type: d.type as DealType,
        description: d.description,
        price: d.price,
      })))
    }
    if (result.dealText) setDealText(result.dealText)
    if (result.schedule && !startTime) setStartTime('16:00')
  }

  function handlePlaceSelect(place: PlaceResult) {
    if (place.name) setName(place.name)
    if (place.address) setAddress(place.address)
    if (place.phone) setPhone(place.phone)
    if (place.website) setWebsite(place.website)
    if (place.neighborhood) setNeighborhood(place.neighborhood)
  }

  function toggleDay(day: DayOfWeek) {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function addDeal() {
    setDeals(prev => [...prev, { type: 'beer', description: '', price: '' }])
  }

  function removeDeal(i: number) {
    setDeals(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateDeal(i: number, field: keyof DealItem, value: string) {
    setDeals(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  async function handleSubmit() {
    if (!name.trim()) { setErrorMsg('Venue name is required'); return }
    if (!neighborhood.trim()) { setErrorMsg('Neighborhood is required'); return }
    if (days.length === 0) { setErrorMsg('Select at least one day'); return }
    if (!dealText.trim() && deals.every(d => !d.description.trim())) {
      setErrorMsg('Add at least one deal or a deal description'); return
    }

    setStatus('submitting')
    setErrorMsg('')

    try {
      // 1. Create venue
      const { data: venue, error: venueErr } = await supabase
        .from('venues')
        .insert([{
          name: name.trim(),
          neighborhood: neighborhood.trim(),
          city,
          state: 'OH',
          address: address.trim() || null,
          website: website.trim() || null,
          phone: phone.trim() || null,
          dog_friendly: dogFriendly,
          categories: [],
          price_tier: null,
          image_url: null,
          verification_status: 'community',
          data_source: 'user_submitted',
          claimed_by_user_id: null,
          is_featured: false,
          upvote_count: 0,
          last_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (venueErr) throw new Error(venueErr.message)

      // 2. Build structured deals
      const structuredDeals = deals
        .filter(d => d.description.trim())
        .map(d => ({
          type: d.type,
          description: d.description.trim(),
          price: d.price ? parseFloat(d.price) : null,
        }))

      // 3. Create schedule
      const { error: schedErr } = await supabase
        .from('happy_hour_schedules')
        .insert([{
          venue_id: venue.id,
          days,
          start_time: isAllDay ? '00:00' : startTime,
          end_time: isAllDay ? '23:59' : endTime,
          is_all_day: isAllDay,
          deal_text: dealText.trim() || deals.filter(d => d.description).map(d => `${d.description}${d.price ? ' $' + d.price : ''}`).join(', '),
          deals: structuredDeals,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])

      if (schedErr) throw new Error(schedErr.message)

      setStatus('success')
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="cf-success">
        <div className="cf-success-icon">🎉</div>
        <div className="cf-success-title">Spot added!</div>
        <p className="cf-success-msg">It's live on the app right now. Thanks for contributing!</p>
        <button className="cf-btn-primary" onClick={onClose ?? (() => setStatus('idle'))}>Done</button>
      </div>
    )
  }

  return (
    <div className="cf-form">
      <div className="cf-header">
        <h2 className="cf-title">Add a new spot</h2>
        <p className="cf-subtitle">Publishes immediately to the app.</p>
      </div>

      {/* Google Places auto-fill */}
      <Field label="Find on Google" hint="Type the bar name to auto-fill details">
        <PlacesSearch onSelect={handlePlaceSelect} placeholder="Search for a bar or restaurant..." />
      </Field>

      <div className="cf-divider"><span>Venue details</span></div>

      <Field label="Bar / Restaurant name" required>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Eagle OTR" />
      </Field>

      <div className="cf-row">
        <Field label="Neighborhood" required>
          <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="e.g. OTR" />
        </Field>
        <Field label="City">
          <Input value={city} readOnly style={{ opacity: .6 }} />
        </Field>
      </div>

      <Field label="Address">
        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="1342 Vine St, Cincinnati, OH 45202" />
      </Field>

      <div className="cf-row">
        <Field label="Website">
          <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." type="url" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(513) 555-0100" type="tel" />
        </Field>
      </div>

      <div className="cf-checkbox-row">
        <input type="checkbox" id="dog-friendly" checked={dogFriendly} onChange={e => setDogFriendly(e.target.checked)} />
        <label htmlFor="dog-friendly">🐾 Dog friendly</label>
      </div>

      <div className="cf-divider"><span>Happy hour schedule</span></div>

      {/* Days */}
      <Field label="Days" required>
        <div className="cf-days">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d}
              type="button"
              className={`cf-day-btn${days.includes(d) ? ' active' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </Field>

      {/* Times */}
      <div className="cf-checkbox-row" style={{ marginBottom: 10 }}>
        <input type="checkbox" id="all-day" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
        <label htmlFor="all-day">All day special</label>
      </div>

      {!isAllDay && (
        <div className="cf-row">
          <Field label="Start time">
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </Field>
          <Field label="End time">
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="cf-divider"><span>Deals</span></div>

      {/* Structured deals */}
      <PhotoScan onScanned={handlePhotoScan} />

      <Field label="Deal items" hint="Add each deal separately for best display">
        {deals.map((deal, i) => (
          <div key={i} className="cf-deal-row" style={{ borderColor: DEAL_COLORS[deal.type].border, background: DEAL_COLORS[deal.type].bg }}>
            <select
              className="cf-deal-type"
              value={deal.type}
              onChange={e => updateDeal(i, 'type', e.target.value)}
              style={{ color: DEAL_COLORS[deal.type].color }}
            >
              <option value="beer">🍺 Beer</option>
              <option value="cocktail">🍸 Cocktail</option>
              <option value="food">🍔 Food</option>
              <option value="wine">🍷 Wine</option>
              <option value="general">⭐ General</option>
            </select>
            <input
              className="cf-deal-desc"
              value={deal.description}
              onChange={e => updateDeal(i, 'description', e.target.value)}
              placeholder="e.g. $3 draft beer"
              style={{ background: 'transparent' }}
            />
            <input
              className="cf-deal-price"
              value={deal.price}
              onChange={e => updateDeal(i, 'price', e.target.value)}
              placeholder="$"
              type="number"
              min="0"
              step="0.5"
              style={{ background: 'transparent' }}
            />
            {deals.length > 1 && (
              <button type="button" className="cf-deal-remove" onClick={() => removeDeal(i)}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="cf-add-deal-btn" onClick={addDeal}>+ Add another deal</button>
      </Field>

      {/* Deal text summary */}
      <Field label="Deal summary (optional)" hint="A short description shown on the card">
        <Textarea
          value={dealText}
          onChange={e => setDealText(e.target.value)}
          placeholder="e.g. $3 drafts, half-off appetizers, $5 well drinks"
          rows={2}
        />
      </Field>

      {(status === 'error' || errorMsg) && (
        <div className="cf-error-banner">{errorMsg}</div>
      )}

      <div className="cf-actions">
        {onClose && <button className="cf-btn-secondary" onClick={onClose}>Cancel</button>}
        <button
          className="cf-btn-primary"
          onClick={handleSubmit}
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Publishing...' : '🍺 Publish spot'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SUGGEST EDIT FORM
// ─────────────────────────────────────────────

export function SuggestEditForm({ venue, onClose }: { venue: Venue; onClose?: () => void }) {
  const [form, setForm] = useState<Partial<EditSuggestion>>({
    flow: 'suggest_edit',
    venue_id: venue.id,
    venue_name: venue.name,
    field_suggestions: '',
    new_schedule: '',
    new_deal_details: '',
    notes: '',
    submitter_email: '',
  })
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [resultMessage, setResultMessage] = useState('')

  function fieldError(field: string) {
    return errors.find(e => e.field === field)?.message
  }

  function set(field: keyof EditSuggestion, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(prev => prev.filter(e => e.field !== field))
  }

  async function handleSubmit() {
    const errs = validateEditSuggestion(form)
    if (errs.length > 0) { setErrors(errs); return }
    setStatus('submitting')
    const result = await submitContribution(form as EditSuggestion)
    setResultMessage(result.message)
    setStatus(result.success ? 'success' : 'error')
  }

  if (status === 'success') {
    return (
      <div className="cf-success">
        <div className="cf-success-icon">✓</div>
        <div className="cf-success-title">Thanks!</div>
        <p className="cf-success-msg">{resultMessage}</p>
        <button className="cf-btn-primary" onClick={onClose ?? (() => setStatus('idle'))}>Done</button>
      </div>
    )
  }

  return (
    <div className="cf-form">
      <div className="cf-header">
        <h2 className="cf-title">Suggest a correction</h2>
        <p className="cf-subtitle">For {venue.name}</p>
      </div>

      <div className="cf-field">
        <label className="cf-label">What needs to change? <span className="cf-required">*</span></label>
        <textarea
          className="cf-textarea"
          value={form.field_suggestions}
          onChange={e => set('field_suggestions', e.target.value)}
          placeholder="e.g. Happy hour ends at 7pm not 6pm, beer specials changed to $4"
          rows={3}
        />
        {fieldError('field_suggestions') && <span className="cf-error">{fieldError('field_suggestions')}</span>}
      </div>

      <div className="cf-field">
        <label className="cf-label">Updated schedule (optional)</label>
        <input className="cf-input" value={form.new_schedule} onChange={e => set('new_schedule', e.target.value)} placeholder="e.g. Mon–Fri 3–7pm" />
      </div>

      <div className="cf-field">
        <label className="cf-label">Updated deal details (optional)</label>
        <textarea className="cf-textarea" value={form.new_deal_details} onChange={e => set('new_deal_details', e.target.value)} placeholder="e.g. $4 drafts, $6 cocktails" rows={2} />
      </div>

      <div className="cf-field">
        <label className="cf-label">Your email (optional)</label>
        <input className="cf-input" value={form.submitter_email} onChange={e => set('submitter_email', e.target.value)} placeholder="only used to follow up if needed" type="email" />
      </div>

      {status === 'error' && <div className="cf-error-banner">{resultMessage}</div>}

      <div className="cf-actions">
        {onClose && <button className="cf-btn-secondary" onClick={onClose}>Cancel</button>}
        <button className="cf-btn-primary" onClick={handleSubmit} disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Submitting...' : 'Submit correction'}
        </button>
      </div>
    </div>
  )
}
