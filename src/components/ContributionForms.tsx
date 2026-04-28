/**
 * ContributionForms.tsx
 * NewVenueForm — saves directly to Supabase with multiple schedules support
 * SuggestEditForm — sends correction suggestions
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

// ─── PHOTO SCAN ───────────────────────────────

type DealType = 'beer' | 'cocktail' | 'liquor' | 'food' | 'wine' | 'general'

interface ScannedDeal { type: DealType; description: string; price: string }
interface ScanResult { deals: ScannedDeal[]; schedule?: string; dealText?: string }

async function scanMenuPhoto(base64: string, mediaType: string): Promise<ScanResult> {
  const response = await fetch('/api/scan-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType }),
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
      const { base64, mediaType } = await new Promise<{ base64: string; mediaType: string }>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          setPreview(result)
          const mimeType = result.split(';')[0].split(':')[1] || 'image/jpeg'
          res({ base64: result.split(',')[1], mediaType: mimeType })
        }
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const result = await scanMenuPhoto(base64, mediaType)
      onScanned(result)
    } catch {
      setError('Could not read the photo. Try a clearer image or fill in manually.')
    }
    setScanning(false)
  }

  return (
    <div className="cf-photo-scan">
      <label className="cf-photo-label">
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        <div className="cf-photo-btn">
          {scanning ? <><span className="cf-spinner" />Reading your photo...</> : <>📷 Scan happy hour menu or sign</>}
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

// ─── DEAL TYPE COLORS ───────────────────────────────

const DEAL_COLORS: Record<DealType, { bg: string; color: string; border: string }> = {
  beer:     { bg: '#FFF8E8', color: '#7A5000', border: '#F5D88A' },
  cocktail: { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  liquor:   { bg: '#FFF0F0', color: '#8B1A1A', border: '#FECACA' },
  food:     { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  wine:     { bg: '#FFF0F6', color: '#7A0038', border: '#FBCFE8' },
  general:  { bg: '#F5F3EF', color: '#4A4540', border: '#D8D4CC' },
}

interface DealItem { type: DealType; description: string; price: string }

// ─── SCHEDULE BLOCK ───────────────────────────────

interface ScheduleBlock {
  id: number
  days: DayOfWeek[]
  startTime: string
  endTime: string
  isAllDay: boolean
  dealText: string
  deals: DealItem[]
}

function ScheduleEditor({
  block, index, total,
  onUpdate, onRemove,
}: {
  block: ScheduleBlock
  index: number
  total: number
  onUpdate: (updated: ScheduleBlock) => void
  onRemove: () => void
}) {
  function toggleDay(day: DayOfWeek) {
    onUpdate({ ...block, days: block.days.includes(day) ? block.days.filter(d => d !== day) : [...block.days, day] })
  }

  function addDeal() {
    onUpdate({ ...block, deals: [...block.deals, { type: 'beer', description: '', price: '' }] })
  }

  function removeDeal(i: number) {
    onUpdate({ ...block, deals: block.deals.filter((_, idx) => idx !== i) })
  }

  function updateDeal(i: number, field: keyof DealItem, value: string) {
    onUpdate({ ...block, deals: block.deals.map((d, idx) => idx === i ? { ...d, [field]: value } : d) })
  }

  return (
    <div className="cf-schedule-block">
      <div className="cf-schedule-block-header">
        <span className="cf-schedule-block-title">Schedule {index + 1}</span>
        {total > 1 && (
          <button type="button" className="cf-schedule-remove" onClick={onRemove}>✕ Remove</button>
        )}
      </div>

      <Field label="Days" required>
        <div className="cf-days">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d} type="button"
              className={`cf-day-btn${block.days.includes(d) ? ' active' : ''}`}
              onClick={() => toggleDay(d)}
            >{d}</button>
          ))}
        </div>
      </Field>

      <div className="cf-checkbox-row" style={{ marginBottom: 10 }}>
        <input type="checkbox" id={`allday-${block.id}`} checked={block.isAllDay}
          onChange={e => onUpdate({ ...block, isAllDay: e.target.checked })} />
        <label htmlFor={`allday-${block.id}`}>All day special</label>
      </div>

      {!block.isAllDay && (
        <div className="cf-row">
          <Field label="Start time">
            <input className="cf-input" type="time" value={block.startTime}
              onChange={e => onUpdate({ ...block, startTime: e.target.value })} />
          </Field>
          <Field label="End time">
            <input className="cf-input" type="time" value={block.endTime}
              onChange={e => onUpdate({ ...block, endTime: e.target.value })} />
          </Field>
        </div>
      )}

      <Field label="Deal items" hint="Add each deal separately">
        {block.deals.map((deal, i) => (
          <div key={i} className="cf-deal-row"
            style={{ borderColor: DEAL_COLORS[deal.type].border, background: DEAL_COLORS[deal.type].bg }}>
            <select className="cf-deal-type" value={deal.type}
              onChange={e => updateDeal(i, 'type', e.target.value)}
              style={{ color: DEAL_COLORS[deal.type].color }}>
              <option value="beer">🍺 Beer</option>
              <option value="cocktail">🍸 Cocktail</option>
              <option value="liquor">🥃 Liquor</option>
              <option value="wine">🍷 Wine</option>
              <option value="food">🍔 Food</option>
              <option value="general">⭐ General</option>
            </select>
            <input className="cf-deal-desc" value={deal.description}
              onChange={e => updateDeal(i, 'description', e.target.value)}
              placeholder="e.g. $3 draft beer" style={{ background: 'transparent' }} />
            <input className="cf-deal-price" value={deal.price}
              onChange={e => updateDeal(i, 'price', e.target.value)}
              placeholder="$" type="number" min="0" step="0.5"
              style={{ background: 'transparent' }} />
            {block.deals.length > 1 && (
              <button type="button" className="cf-deal-remove" onClick={() => removeDeal(i)}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="cf-add-deal-btn" onClick={addDeal}>+ Add another deal</button>
      </Field>

      <Field label="Deal summary (optional)" hint="Short description shown on the card">
        <Textarea value={block.dealText}
          onChange={e => onUpdate({ ...block, dealText: e.target.value })}
          placeholder="e.g. $3 drafts, half-off apps" rows={2} />
      </Field>
    </div>
  )
}

// ─── NEW VENUE FORM ───────────────────────────────

let scheduleIdCounter = 1

function makeSchedule(): ScheduleBlock {
  return {
    id: scheduleIdCounter++,
    days: [],
    startTime: '16:00',
    endTime: '19:00',
    isAllDay: false,
    dealText: '',
    deals: [{ type: 'beer', description: '', price: '' }],
  }
}

export function NewVenueForm({ onClose }: { onClose?: () => void }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [name, setName] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city] = useState('Cincinnati')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [dogFriendly, setDogFriendly] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([makeSchedule()])

  function handlePlaceSelect(place: PlaceResult) {
    if (place.name) setName(place.name)
    if (place.address) setAddress(place.address)
    if (place.phone) setPhone(place.phone)
    if (place.website) setWebsite(place.website)
    if (place.neighborhood) setNeighborhood(place.neighborhood)
    if (place.lat) setLat(place.lat)
    if (place.lng) setLng(place.lng)
  }

  function handlePhotoScan(result: ScanResult) {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== 0) return s
      return {
        ...s,
        deals: result.deals?.length ? result.deals.map(d => ({
          type: d.type as DealType,
          description: d.description,
          price: d.price,
        })) : s.deals,
        dealText: result.dealText || s.dealText,
      }
    }))
  }

  function addSchedule() {
    setSchedules(prev => [...prev, makeSchedule()])
  }

  function updateSchedule(index: number, updated: ScheduleBlock) {
    setSchedules(prev => prev.map((s, i) => i === index ? updated : s))
  }

  function removeSchedule(index: number) {
    setSchedules(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!name.trim()) { setErrorMsg('Venue name is required'); return }
    if (!neighborhood.trim()) { setErrorMsg('Neighborhood is required'); return }
    if (schedules.every(s => s.days.length === 0)) { setErrorMsg('Select at least one day on each schedule'); return }

    setStatus('submitting')
    setErrorMsg('')

    try {
      let resolvedLat = lat
      let resolvedLng = lng
      if (!resolvedLat && address.trim()) {
        try {
          const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address.trim())}`)
          const geoData = await geoRes.json()
          if (geoData.lat) { resolvedLat = geoData.lat; resolvedLng = geoData.lng }
        } catch { /* silently continue without coords */ }
      }

      const { error } = await supabase.from('contributions').insert([{
        flow: 'new_venue',
        status: 'pending',
        data: {
          name: name.trim(),
          neighborhood: neighborhood.trim(),
          city,
          address: address.trim() || '',
          website: website.trim() || '',
          phone: phone.trim() || '',
          latitude: resolvedLat || null,
          longitude: resolvedLng || null,
          dog_friendly: dogFriendly,
          schedules: schedules.filter(s => s.days.length > 0).map(s => ({
            days: s.days,
            start_time: s.isAllDay ? '00:00' : s.startTime,
            end_time: s.isAllDay ? '23:59' : s.endTime,
            is_all_day: s.isAllDay,
            deal_text: s.dealText.trim() || s.deals.filter(d => d.description).map(d =>
              `${d.description}${d.price ? ' $' + d.price : ''}`).join(', '),
            deals: s.deals.filter(d => d.description.trim()).map(d => ({
              type: d.type, description: d.description.trim(),
              price: d.price ? parseFloat(d.price) : null,
            })),
          })),
        },
        created_at: new Date().toISOString(),
      }])

      if (error) throw new Error(error.message)

      // Notify admin via email — best effort, never blocks submission
      try {
        await fetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venue_name: name.trim(),
            neighborhood: neighborhood.trim(),
            submitter_email: '',
            schedules: schedules.filter(s => s.days.length > 0).map(s => ({
              days: s.days,
              start_time: s.isAllDay ? '00:00' : s.startTime,
              end_time: s.isAllDay ? '23:59' : s.endTime,
              deal_text: s.dealText.trim() || s.deals.filter(d => d.description).map(d =>
                `${d.description}${d.price ? ' $' + d.price : ''}`).join(', '),
            })),
          }),
        })
      } catch { /* never block submission if email fails */ }

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
        <p className="cf-success-msg">Thanks! Your submission is under review and will be published soon.</p>
        <button className="cf-btn-primary" onClick={onClose ?? (() => setStatus('idle'))}>Done</button>
      </div>
    )
  }

  return (
    <div className="cf-form">
      <div className="cf-header">
        <h2 className="cf-title">Add a new spot</h2>
        <p className="cf-subtitle">Submitted for review — published within 24 hours.</p>
      </div>

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

      <div className="cf-divider"><span>Scan deals from a photo</span></div>
      <PhotoScan onScanned={handlePhotoScan} />

      <div className="cf-divider"><span>Happy hour schedules</span></div>
      <p className="cf-hint" style={{ marginBottom: 12 }}>Add a separate schedule for each day or group of days with different deals.</p>

      {schedules.map((block, index) => (
        <ScheduleEditor
          key={block.id}
          block={block}
          index={index}
          total={schedules.length}
          onUpdate={updated => updateSchedule(index, updated)}
          onRemove={() => removeSchedule(index)}
        />
      ))}

      <button type="button" className="cf-add-schedule-btn" onClick={addSchedule}>
        + Add another day's schedule
      </button>

      {(status === 'error' || errorMsg) && (
        <div className="cf-error-banner">{errorMsg}</div>
      )}

      <div className="cf-actions">
        {onClose && <button className="cf-btn-secondary" onClick={onClose}>Cancel</button>}
        <button className="cf-btn-primary" onClick={handleSubmit} disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Publishing...' : '🍺 Publish spot'}
        </button>
      </div>
    </div>
  )
}

// ─── SUGGEST EDIT FORM ───────────────────────────────

export function SuggestEditForm({ venue, onClose }: { venue: Venue; onClose?: () => void }) {
  const [form, setForm] = useState<Partial<EditSuggestion>>({
    flow: 'suggest_edit', venue_id: venue.id, venue_name: venue.name,
    field_suggestions: '', new_schedule: '', new_deal_details: '', notes: '', submitter_email: '',
  })
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [resultMessage, setResultMessage] = useState('')

  function fieldError(field: string) { return errors.find(e => e.field === field)?.message }
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
        <textarea className="cf-textarea" value={form.field_suggestions}
          onChange={e => set('field_suggestions', e.target.value)}
          placeholder="e.g. Happy hour ends at 7pm not 6pm, beer specials changed to $4" rows={3} />
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
