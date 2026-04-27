/**
 * EditVenueForm.tsx
 *
 * Full inline edit form for a venue and its schedules.
 * Saves directly to Supabase — no moderation queue.
 * Admin only — accessed via AdminPage venue cards.
 *
 * Schedule editor matches the "Add a new spot" UI exactly:
 *   - Day toggles
 *   - All day checkbox
 *   - Start / end time
 *   - Individual deal rows (type + description + price)
 *   - Deal summary text
 */

import React, { useState } from 'react'
import { PlacesSearch, type PlaceResult } from './PlacesSearch'
import { supabase } from '../lib/supabase'
import type { Venue, HappyHourSchedule, DayOfWeek, DealType } from '../types'
import { DAYS_OF_WEEK } from '../types'

interface DealItem {
  type: DealType
  description: string
  price: number | undefined
}

const DEAL_TYPE_OPTIONS: { value: DealType; label: string; emoji: string }[] = [
  { value: 'beer',     label: 'Beer',     emoji: '🍺' },
  { value: 'cocktail', label: 'Cocktail', emoji: '🍸' },
  { value: 'liquor',   label: 'Liquor',   emoji: '🥃' },
  { value: 'wine',     label: 'Wine',     emoji: '🍷' },
  { value: 'food',     label: 'Food',     emoji: '🍔' },
  { value: 'general',  label: 'General',  emoji: '🏷️' },
]

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="ef-field">
      <label className="ef-label">
        {label}
        {required && <span className="ef-required"> *</span>}
      </label>
      {hint && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{hint}</div>}
      {children}
    </div>
  )
}

function emptyDeal(): DealItem {
  return { type: 'beer', description: '', price: undefined }
}

function dealsFromSchedule(schedule: HappyHourSchedule): DealItem[] {
  if (schedule.deals && schedule.deals.length > 0) {
    return schedule.deals.map((d: any) => ({
      type: d.type ?? 'general',
      description: d.description ?? '',
      price: d.price ?? undefined,
    }))
  }
  return [emptyDeal()]
}

// ─────────────────────────────────────────────
// DEAL ROW — one deal item with type + desc + price
// ─────────────────────────────────────────────

function DealRow({
  deal,
  onChange,
  onRemove,
  canRemove,
}: {
  deal: DealItem
  onChange: (d: DealItem) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div style={{
      marginBottom: 8,
      background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: 10, padding: '10px 12px',
    }}>
      {/* Row 1: type selector + remove button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <select
          value={deal.type}
          onChange={e => onChange({ ...deal, type: e.target.value as DealType })}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #E0DDD8',
            fontSize: 13, fontFamily: 'inherit', background: '#fff',
          }}
        >
          {DEAL_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
          ))}
        </select>
        {canRemove && (
          <button
            onClick={onRemove}
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 20, flexShrink: 0, padding: '0 4px', lineHeight: 1 }}
          >✕</button>
        )}
      </div>

      {/* Row 2: description + price side by side */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={deal.description}
          onChange={e => onChange({ ...deal, description: e.target.value })}
          placeholder="e.g. $3 draft beer"
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8,
            border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit',
            minWidth: 0,
          }}
        />
        <div style={{ position: 'relative', flexShrink: 0, width: 72 }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 13 }}>$</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={deal.price ?? ''}
            onChange={e => onChange({ ...deal, price: e.target.value ? parseFloat(e.target.value) : undefined })}
            placeholder="—"
            style={{
              width: '100%', padding: '8px 6px 8px 20px', borderRadius: 8,
              border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit',
              boxSizing: 'border-box' as const,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SCHEDULE EDITOR — full rich editor for one schedule
// ─────────────────────────────────────────────

function ScheduleEditor({
  schedule,
  index,
  onSave,
  onDelete,
  onCancel,
}: {
  schedule: HappyHourSchedule
  index: number
  onSave: (updates: Partial<HappyHourSchedule>) => Promise<void>
  onDelete: () => Promise<void>
  onCancel: () => void
}) {
  const [days, setDays]         = useState<DayOfWeek[]>(schedule.days as DayOfWeek[])
  const [isAllDay, setIsAllDay] = useState(schedule.is_all_day ?? false)
  const [startTime, setStart]   = useState(schedule.start_time)
  const [endTime, setEnd]       = useState(schedule.end_time)
  const [deals, setDeals]       = useState<DealItem[]>(dealsFromSchedule(schedule))
  const [dealText, setDealText] = useState(schedule.deal_text)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function toggleDay(day: DayOfWeek) {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function updateDeal(i: number, d: DealItem) {
    setDeals(prev => prev.map((item, idx) => idx === i ? d : item))
  }

  function removeDeal(i: number) {
    setDeals(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (days.length === 0) { setError('Select at least one day'); return }
    const validDeals = deals.filter(d => d.description.trim())
    setSaving(true)
    setError(null)
    try {
      await onSave({
        days,
        start_time: startTime,
        end_time: endTime,
        is_all_day: isAllDay,
        deals: validDeals,
        deal_text: dealText.trim(),
      })
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this schedule? This cannot be undone.')) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div style={{ background: '#F8F6F1', borderRadius: 12, padding: '16px', border: '1px solid #E0DDD8', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A1612', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
        Schedule {index + 1}
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#c0392b', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {/* Days */}
      <Field label="Days" required>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: '2px solid',
                background: days.includes(d) ? '#1A1612' : '#fff',
                color: days.includes(d) ? '#fff' : '#888',
                borderColor: days.includes(d) ? '#1A1612' : '#E0DDD8',
                transition: 'all .15s',
              }}
            >{d}</button>
          ))}
        </div>
      </Field>

      {/* All day toggle */}
      <div
        onClick={() => setIsAllDay(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14, userSelect: 'none' }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 4, border: '2px solid',
          borderColor: isAllDay ? '#E85D1A' : '#E0DDD8',
          background: isAllDay ? '#E85D1A' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isAllDay && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>All day special</span>
      </div>

      {/* Times */}
      {!isAllDay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Field label="Start time">
            <input
              className="ef-input"
              type="time"
              value={startTime}
              onChange={e => setStart(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </Field>
          <Field label="End time">
            <input
              className="ef-input"
              type="time"
              value={endTime}
              onChange={e => setEnd(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </Field>
        </div>
      )}

      {/* Deal items */}
      <Field label="Deal items" hint="Add each deal separately">
        <div style={{ marginTop: 6 }}>
          {deals.map((deal, i) => (
            <DealRow
              key={i}
              deal={deal}
              onChange={d => updateDeal(i, d)}
              onRemove={() => removeDeal(i)}
              canRemove={deals.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setDeals(prev => [...prev, emptyDeal()])}
            style={{
              width: '100%', padding: '9px', borderRadius: 10, border: '1.5px dashed #E0DDD8',
              background: 'transparent', color: '#888', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', marginTop: 4,
            }}
          >+ Add another deal</button>
        </div>
      </Field>

      {/* Deal summary */}
      <Field label="Deal summary" hint="Short description shown on the card">
        <textarea
          className="ef-textarea"
          value={dealText}
          onChange={e => setDealText(e.target.value)}
          placeholder="e.g. $3 drafts, half-off apps, $5 wells..."
          rows={2}
          style={{ marginTop: 4 }}
        />
      </Field>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1, padding: '10px', background: '#E85D1A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Save schedule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '10px 16px', background: '#F3F4F6', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{ padding: '10px 16px', background: '#fee2e2', color: '#c0392b', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {deleting ? 'Deleting...' : '🗑 Delete'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// NEW SCHEDULE FORM — same rich editor, blank state
// ─────────────────────────────────────────────

function NewScheduleForm({
  venueId,
  scheduleCount,
  onSaved,
  onCancel,
}: {
  venueId: string
  scheduleCount: number
  onSaved: () => void
  onCancel: () => void
}) {
  const [days, setDays]         = useState<DayOfWeek[]>([])
  const [isAllDay, setIsAllDay] = useState(false)
  const [startTime, setStart]   = useState('16:00')
  const [endTime, setEnd]       = useState('19:00')
  const [deals, setDeals]       = useState<DealItem[]>([emptyDeal()])
  const [dealText, setDealText] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function toggleDay(day: DayOfWeek) {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  async function handleSave() {
    if (days.length === 0) { setError('Select at least one day'); return }
    const validDeals = deals.filter(d => d.description.trim())
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('happy_hour_schedules').insert([{
        venue_id:   venueId,
        days:       days,
        start_time: startTime,
        end_time:   endTime,
        is_all_day: isAllDay,
        deals:      validDeals,
        deal_text:  dealText.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      if (err) throw err
      onSaved()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#FFF8F0', borderRadius: 12, padding: '16px', border: '2px dashed #E85D1A', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#E85D1A', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
        New schedule {scheduleCount + 1}
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#c0392b', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {/* Days */}
      <Field label="Days" required>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: '2px solid',
                background: days.includes(d) ? '#1A1612' : '#fff',
                color: days.includes(d) ? '#fff' : '#888',
                borderColor: days.includes(d) ? '#1A1612' : '#E0DDD8',
                transition: 'all .15s',
              }}
            >{d}</button>
          ))}
        </div>
      </Field>

      {/* All day */}
      <div
        onClick={() => setIsAllDay(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14, userSelect: 'none' }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 4, border: '2px solid',
          borderColor: isAllDay ? '#E85D1A' : '#E0DDD8',
          background: isAllDay ? '#E85D1A' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isAllDay && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>All day special</span>
      </div>

      {/* Times */}
      {!isAllDay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Field label="Start time">
            <input className="ef-input" type="time" value={startTime} onChange={e => setStart(e.target.value)} style={{ marginTop: 4 }} />
          </Field>
          <Field label="End time">
            <input className="ef-input" type="time" value={endTime} onChange={e => setEnd(e.target.value)} style={{ marginTop: 4 }} />
          </Field>
        </div>
      )}

      {/* Deal items */}
      <Field label="Deal items" hint="Add each deal separately">
        <div style={{ marginTop: 6 }}>
          {deals.map((deal, i) => (
            <DealRow
              key={i}
              deal={deal}
              onChange={d => setDeals(prev => prev.map((item, idx) => idx === i ? d : item))}
              onRemove={() => setDeals(prev => prev.filter((_, idx) => idx !== i))}
              canRemove={deals.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setDeals(prev => [...prev, emptyDeal()])}
            style={{
              width: '100%', padding: '9px', borderRadius: 10, border: '1.5px dashed #E0DDD8',
              background: 'transparent', color: '#888', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', marginTop: 4,
            }}
          >+ Add another deal</button>
        </div>
      </Field>

      {/* Deal summary */}
      <Field label="Deal summary" hint="Short description shown on the card">
        <textarea
          className="ef-textarea"
          value={dealText}
          onChange={e => setDealText(e.target.value)}
          placeholder="e.g. $3 drafts, half-off apps, $5 wells..."
          rows={2}
          style={{ marginTop: 4 }}
        />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1, padding: '10px', background: '#E85D1A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Add schedule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '10px 16px', background: '#F3F4F6', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN EDIT FORM
// ─────────────────────────────────────────────

interface EditVenueFormProps {
  venue: Venue
  onClose: () => void
  onSaved: () => void
}

export function EditVenueForm({ venue, onClose, onSaved }: EditVenueFormProps) {
  const [name, setName]                   = useState(venue.name)
  const [neighborhood, setNeighborhood]   = useState(venue.neighborhood)
  const [city, setCity]                   = useState(venue.city)
  const [address, setAddress]             = useState(venue.address ?? '')
  const [website, setWebsite]             = useState(venue.website ?? '')
  const [phone, setPhone]                 = useState(venue.phone ?? '')
  const [priceTier, setPriceTier]         = useState(venue.price_tier ?? '')
  const [dogFriendly, setDogFriendly]     = useState((venue as any).dog_friendly ?? false)

  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [addingSchedule, setAddingSchedule]       = useState(false)

  const schedules = venue.schedules ?? []

  function handlePlaceSelect(place: PlaceResult) {
    if (place.name)         setName(place.name)
    if (place.address)      setAddress(place.address)
    if (place.phone)        setPhone(place.phone)
    if (place.website)      setWebsite(place.website)
    if (place.neighborhood) setNeighborhood(place.neighborhood)
  }

  async function saveVenue() {
    if (!name.trim()) { setError('Venue name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('venues')
        .update({
          name:         name.trim(),
          neighborhood: neighborhood.trim() || 'Unknown',
          city:         city.trim() || 'Cincinnati',
          address:      address.trim() || null,
          website:      website.trim() || null,
          phone:        phone.trim() || null,
          price_tier:   priceTier || null,
          dog_friendly: dogFriendly,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', venue.id)
      if (err) throw err
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onSaved() }, 1200)
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function saveSchedule(scheduleId: string, updates: Partial<HappyHourSchedule>) {
    const { error: err } = await supabase
      .from('happy_hour_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
    if (err) throw err
    setEditingScheduleId(null)
    onSaved()
  }

  async function deleteSchedule(scheduleId: string) {
    const { error: err } = await supabase
      .from('happy_hour_schedules')
      .delete()
      .eq('id', scheduleId)
    if (err) throw err
    setEditingScheduleId(null)
    onSaved()
  }

  return (
    <div className="ef-form">

      {/* Header */}
      <div className="ef-header">
        <h2 className="ef-title">Edit venue</h2>
        <button className="ef-close-btn" onClick={onClose} type="button">✕</button>
      </div>

      {success && <div className="ef-success-banner">✓ Saved successfully!</div>}
      {error   && <div className="ef-error-banner">{error}</div>}

      {/* ── VENUE DETAILS ── */}
      <div className="ef-section-title">Venue details</div>

      <div className="ef-field">
        <label className="ef-label">Find on Google</label>
        <PlacesSearch onSelect={handlePlaceSelect} placeholder="Search to auto-fill details..." />
        <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Selecting a result overwrites the fields below</p>
      </div>

      <Field label="Bar / restaurant name" required>
        <input className="ef-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Eagle OTR" />
      </Field>

      <div className="ef-row">
        <Field label="Neighborhood" required>
          <input className="ef-input" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="e.g. OTR" />
        </Field>
        <Field label="City">
          <input className="ef-input" value={city} onChange={e => setCity(e.target.value)} placeholder="Cincinnati" />
        </Field>
      </div>

      <Field label="Address">
        <input className="ef-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="1342 Vine St, Cincinnati, OH 45202" />
      </Field>

      <div className="ef-row">
        <Field label="Website">
          <input className="ef-input" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Phone">
          <input className="ef-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(513) 555-0100" />
        </Field>
      </div>

      <Field label="Price tier">
        <select className="ef-select" value={priceTier} onChange={e => setPriceTier(e.target.value)}>
          <option value="">Select...</option>
          <option value="$">$ — Budget</option>
          <option value="$$">$$ — Moderate</option>
          <option value="$$$">$$$ — Upscale</option>
          <option value="$$$$">$$$$ — Fine Dining</option>
        </select>
      </Field>

      {/* Dog friendly */}
      <div
        onClick={() => setDogFriendly((v: boolean) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16, userSelect: 'none' }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 4, border: '2px solid',
          borderColor: dogFriendly ? '#E85D1A' : '#E0DDD8',
          background: dogFriendly ? '#E85D1A' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {dogFriendly && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>🐾 Dog friendly</span>
      </div>

      <button className="ef-btn-save" onClick={saveVenue} disabled={saving}>
        {saving ? 'Saving...' : 'Save venue details'}
      </button>

      {/* ── SCHEDULES ── */}
      <div className="ef-divider" />
      <div className="ef-section-title">Happy hour schedules</div>

      {schedules.length === 0 && !addingSchedule && (
        <p className="ef-empty-note">No schedules yet — add one below.</p>
      )}

      {schedules.map((s, i) => (
        <div key={s.id}>
          {editingScheduleId === s.id ? (
            <ScheduleEditor
              schedule={s}
              index={i}
              onSave={updates => saveSchedule(s.id, updates)}
              onDelete={() => deleteSchedule(s.id)}
              onCancel={() => setEditingScheduleId(null)}
            />
          ) : (
            <div style={{
              background: '#fff', border: '1px solid #EAE6DF', borderRadius: 12,
              padding: '12px 14px', marginBottom: 8,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  Schedule {i + 1}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1612', marginBottom: 2 }}>
                  {s.days.length === 7 ? 'Every day' : s.days.join(', ')}
                  {' · '}
                  {s.is_all_day ? 'All day' : `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`}
                </div>
                {s.deals && s.deals.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {s.deals.map((d: any, di: number) => (
                      <span key={di} style={{ fontSize: 11, background: '#F8F6F1', border: '1px solid #EAE6DF', borderRadius: 6, padding: '2px 8px', color: '#555' }}>
                        {d.description}{d.price != null ? ` · $${d.price}` : ''}
                      </span>
                    ))}
                  </div>
                ) : s.deal_text ? (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.deal_text}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => { setEditingScheduleId(s.id); setAddingSchedule(false) }}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #EAE6DF', background: '#F8F6F1', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add new schedule */}
      {addingSchedule ? (
        <NewScheduleForm
          venueId={venue.id}
          scheduleCount={schedules.length}
          onSaved={() => { setAddingSchedule(false); onSaved() }}
          onCancel={() => setAddingSchedule(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setAddingSchedule(true); setEditingScheduleId(null) }}
          style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: '2px dashed #E85D1A', background: 'transparent',
            color: '#E85D1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4,
          }}
        >
          + Add another day's schedule
        </button>
      )}

    </div>
  )
}
