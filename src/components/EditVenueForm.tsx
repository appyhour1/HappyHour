/**
 * EditVenueForm.tsx
 *
 * Full inline edit form for a venue and its schedules.
 * Saves directly to Supabase — no moderation queue.
 * Appears on the venue detail page when the owner clicks "Edit this venue".
 */

import React, { useState } from 'react'
import { PlacesSearch, type PlaceResult } from './PlacesSearch'
import { supabase } from '../lib/supabase'
import type { Venue, HappyHourSchedule, DayOfWeek } from '../types'
import { DAYS_OF_WEEK } from '../types'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="ef-field">
      <label className="ef-label">{label}{required && <span className="ef-required"> *</span>}</label>
      {children}
      {error && <span className="ef-error">{error}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────
// SCHEDULE EDITOR — edit one schedule at a time
// ─────────────────────────────────────────────

function ScheduleEditor({
  schedule,
  onSave,
  onDelete,
  onCancel,
}: {
  schedule: HappyHourSchedule
  onSave: (updated: Partial<HappyHourSchedule>) => Promise<void>
  onDelete: () => Promise<void>
  onCancel: () => void
}) {
  const [days, setDays]         = useState<DayOfWeek[]>(schedule.days as DayOfWeek[])
  const [startTime, setStart]   = useState(schedule.start_time)
  const [endTime, setEnd]       = useState(schedule.end_time)
  const [dealText, setDealText] = useState(schedule.deal_text)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)

  function toggleDay(day: DayOfWeek) {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  async function handleSave() {
    if (!dealText.trim()) return
    setSaving(true)
    await onSave({ days, start_time: startTime, end_time: endTime, deal_text: dealText })
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this schedule? This cannot be undone.')) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="ef-schedule-editor">
      <Field label="Days">
        <div className="ef-days">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d}
              className={`ef-day-btn${days.includes(d) ? ' active' : ''}`}
              onClick={() => toggleDay(d)}
              type="button"
            >{d}</button>
          ))}
        </div>
      </Field>

      <div className="ef-row">
        <Field label="Start time">
          <input className="ef-input" type="time" value={startTime} onChange={e => setStart(e.target.value)} />
        </Field>
        <Field label="End time">
          <input className="ef-input" type="time" value={endTime} onChange={e => setEnd(e.target.value)} />
        </Field>
      </div>

      <Field label="Deal description" required>
        <textarea
          className="ef-textarea"
          value={dealText}
          onChange={e => setDealText(e.target.value)}
          placeholder="e.g. $3 drafts, half-off apps, $5 wells..."
          rows={3}
        />
      </Field>

      <div className="ef-schedule-actions">
        <button className="ef-btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save schedule'}
        </button>
        <button className="ef-btn-cancel" onClick={onCancel} type="button">Cancel</button>
        <button className="ef-btn-delete" onClick={handleDelete} disabled={deleting} type="button">
          {deleting ? 'Deleting...' : 'Delete'}
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
  // Venue fields
  const [name, setName]               = useState(venue.name)
  const [neighborhood, setNeighborhood] = useState(venue.neighborhood)
  const [city, setCity]               = useState(venue.city)
  const [address, setAddress]         = useState(venue.address ?? '')
  const [website, setWebsite]         = useState(venue.website ?? '')
  const [phone, setPhone]             = useState(venue.phone ?? '')
  const [priceTier, setPriceTier]     = useState(venue.price_tier ?? '')

  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)

  // Which schedule is being edited
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)

  // Add new schedule state
  const [addingSchedule, setAddingSchedule] = useState(false)
  const [newDays, setNewDays]               = useState<DayOfWeek[]>([])
  const [newStart, setNewStart]             = useState('16:00')
  const [newEnd, setNewEnd]                 = useState('19:00')
  const [newDealText, setNewDealText]       = useState('')
  const [savingNew, setSavingNew]           = useState(false)

  const schedules = venue.schedules ?? []

  // ── SAVE VENUE ────────────────────────────
  function handlePlaceSelect(place: PlaceResult) {
    if (place.name) setName(place.name)
    if (place.address) setAddress(place.address)
    if (place.phone) setPhone(place.phone)
    if (place.website) setWebsite(place.website)
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
          name: name.trim(),
          neighborhood: neighborhood.trim() || 'Unknown',
          city: city.trim() || 'Cincinnati',
          address: address.trim() || null,
          website: website.trim() || null,
          phone: phone.trim() || null,
          price_tier: priceTier || null,
          updated_at: new Date().toISOString(),
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

  // ── SAVE EXISTING SCHEDULE ────────────────
  async function saveSchedule(scheduleId: string, updates: Partial<HappyHourSchedule>) {
    const { error: err } = await supabase
      .from('happy_hour_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
    if (err) throw err
    setEditingScheduleId(null)
    onSaved()
  }

  // ── DELETE SCHEDULE ───────────────────────
  async function deleteSchedule(scheduleId: string) {
    const { error: err } = await supabase
      .from('happy_hour_schedules')
      .delete()
      .eq('id', scheduleId)
    if (err) throw err
    setEditingScheduleId(null)
    onSaved()
  }

  // ── ADD NEW SCHEDULE ──────────────────────
  async function addSchedule() {
    if (!newDealText.trim()) return
    setSavingNew(true)
    try {
      const { error: err } = await supabase
        .from('happy_hour_schedules')
        .insert([{
          venue_id:   venue.id,
          days:       newDays.length ? newDays : DAYS_OF_WEEK,
          start_time: newStart,
          end_time:   newEnd,
          is_all_day: false,
          deal_text:  newDealText.trim(),
          deals:      [],
        }])
      if (err) throw err
      setAddingSchedule(false)
      setNewDays([]); setNewStart('16:00'); setNewEnd('19:00'); setNewDealText('')
      onSaved()
    } catch (e: any) {
      setError(e.message)
    }
    setSavingNew(false)
  }

  return (
    <div className="ef-form">
      {/* ── HEADER ── */}
      <div className="ef-header">
        <h2 className="ef-title">Edit venue</h2>
        <button className="ef-close-btn" onClick={onClose} type="button">✕</button>
      </div>

      {success && <div className="ef-success-banner">✓ Saved successfully!</div>}
      {error   && <div className="ef-error-banner">{error}</div>}

      {/* ── VENUE DETAILS ── */}
      <div className="ef-section-title">Venue details</div>

      <div className="ef-field">
        <label className="ef-label">Look up on Google</label>
        <PlacesSearch onSelect={handlePlaceSelect} placeholder="Search to auto-fill details..." />
        <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Selecting a result overwrites the fields below</p>
      </div>

      <Field label="Venue name" required>
        <input className="ef-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Eagle OTR" />
      </Field>

      <div className="ef-row">
        <Field label="Neighborhood">
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

      <button className="ef-btn-save" onClick={saveVenue} disabled={saving}>
        {saving ? 'Saving...' : 'Save venue details'}
      </button>

      {/* ── SCHEDULES ── */}
      <div className="ef-divider" />
      <div className="ef-section-title">Happy hour schedules</div>

      {schedules.length === 0 && (
        <p className="ef-empty-note">No schedules yet — add one below.</p>
      )}

      {schedules.map((s, i) => (
        <div key={s.id} className="ef-schedule-row">
          {editingScheduleId === s.id ? (
            <ScheduleEditor
              schedule={s}
              onSave={updates => saveSchedule(s.id, updates)}
              onDelete={() => deleteSchedule(s.id)}
              onCancel={() => setEditingScheduleId(null)}
            />
          ) : (
            <div className="ef-schedule-summary">
              <div className="ef-schedule-info">
                <span className="ef-schedule-days">
                  {s.days.length === 7 ? 'Every day' : s.days.join(', ')}
                </span>
                <span className="ef-schedule-time">
                  {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}
                </span>
                <span className="ef-schedule-text">{s.deal_text}</span>
              </div>
              <button className="ef-btn-edit-sched" onClick={() => setEditingScheduleId(s.id)} type="button">
                Edit
              </button>
            </div>
          )}
        </div>
      ))}

      {/* ── ADD NEW SCHEDULE ── */}
      {addingSchedule ? (
        <div className="ef-schedule-editor ef-new-schedule">
          <div className="ef-section-title" style={{ marginBottom: 12 }}>New schedule</div>
          <Field label="Days">
            <div className="ef-days">
              {DAYS_OF_WEEK.map(d => (
                <button
                  key={d}
                  className={`ef-day-btn${newDays.includes(d) ? ' active' : ''}`}
                  onClick={() => setNewDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                  type="button"
                >{d}</button>
              ))}
            </div>
          </Field>
          <div className="ef-row">
            <Field label="Start time">
              <input className="ef-input" type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
            </Field>
            <Field label="End time">
              <input className="ef-input" type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Deal description" required>
            <textarea
              className="ef-textarea"
              value={newDealText}
              onChange={e => setNewDealText(e.target.value)}
              placeholder="e.g. $3 drafts, half-off apps, $5 wells..."
              rows={3}
            />
          </Field>
          <div className="ef-schedule-actions">
            <button className="ef-btn-save" onClick={addSchedule} disabled={savingNew}>
              {savingNew ? 'Saving...' : 'Add schedule'}
            </button>
            <button className="ef-btn-cancel" onClick={() => setAddingSchedule(false)} type="button">Cancel</button>
          </div>
        </div>
      ) : (
        <button className="ef-btn-add-schedule" onClick={() => setAddingSchedule(true)} type="button">
          + Add schedule
        </button>
      )}
    </div>
  )
}
