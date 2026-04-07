import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { SAMPLE_VENUES } from './data/sampleVenues'
import { filterVenues, getNeighborhoods, fmtTime, isVenueActiveNow, isScheduleActiveNow, getVenueActiveDays, verifiedAgo } from './utils/filters'
import { sortVenuesByMode } from './utils/scoring'
import { getScheduleStatus, getVenuesStartingNext, STATUS_VISUALS, type ScheduleStatus, type HappyHourStatus } from './utils/happeningNow'
import { useFilterState } from './hooks/useFilterState'
import { useViewMode } from './hooks/useViewMode'
import { FilterPanel } from './components/FilterPanel'
import { SortBar } from './components/SortBar'
import { MapView } from './components/MapView'
import { ViewToggle } from './components/ViewToggle'
import {
  DAYS_OF_WEEK, EMPTY_FORM, DEAL_TYPE_LABELS, DEAL_TYPE_COLORS,
  type Venue, type HappyHourSchedule, type VenueFormState,
  type DayOfWeek, type DealItem, type UserLocation,
} from './types'
import './App.css'

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────

export function StatusBadge({ status, label }: { status: HappyHourStatus; label: string }) {
  const v = STATUS_VISUALS[status]
  return (
    <span className="status-badge" style={{ background: v.bg, color: v.text, borderColor: v.border }}>
      <span className={`status-dot${v.pulse ? ' pulse' : ''}`} style={{ background: v.dot }} />
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────

function FilterEmptyState({ allVenues, onClear }: { allVenues: Venue[]; onClear: () => void }) {
  const upcoming = getVenuesStartingNext(allVenues, 3)
  return (
    <div className="hn-empty">
      <div className="hn-empty-icon">🍺</div>
      <div className="hn-empty-title">No matches</div>
      <div className="hn-empty-sub">Try adjusting your filters or check back later.</div>
      {upcoming.length > 0 && (
        <div className="hn-upcoming">
          <div className="hn-upcoming-label">Starting soon</div>
          {upcoming.map(({ venue, status }) => (
            <div key={venue.id} className="hn-upcoming-row">
              <span className="hn-upcoming-name">{venue.name}</span>
              <StatusBadge status={status.status} label={status.badge} />
            </div>
          ))}
        </div>
      )}
      <button className="hn-empty-btn" onClick={onClear}>Clear filters</button>
    </div>
  )
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

export default function App() {
  const [venues, setVenues]   = useState<Venue[]>(SAMPLE_VENUES)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locPrompt, setLocPrompt]       = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState<VenueFormState>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError]     = useState<string | null>(null)
  const [expandedVenues, setExpandedVenues] = useState<Record<string, boolean>>({})
  const [activeDealTab, setActiveDealTab]   = useState<Record<string, number>>({})
  const [filterOpen, setFilterOpen]         = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const venueCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const fs = useFilterState()
  const vm = useViewMode()

  useEffect(() => { fetchVenues() }, [])
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── DATA ──────────────────────────────────
  async function fetchVenues() {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('venues_with_schedules').select('*')
        .order('is_featured', { ascending: false }).order('name')
      if (err) throw new Error(err.message)
      if (data && data.length > 0) setVenues(data as Venue[])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  async function saveVenueAndSchedule() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const venuePayload = {
        name: form.name.trim(), neighborhood: form.neighborhood.trim() || 'Unknown',
        city: form.city.trim() || 'Cincinnati', address: form.address.trim() || null,
        website: form.website.trim() || null, phone: form.phone.trim() || null,
        categories: form.categories, price_tier: form.price_tier || null,
        image_url: form.image_url.trim() || null,
      }
      let venueId = form.id
      if (venueId) {
        await supabase.from('venues').update(venuePayload).eq('id', venueId)
      } else {
        const { data } = await supabase.from('venues').insert([venuePayload]).select().single()
        venueId = data?.id
      }
      if (!venueId) throw new Error('Could not save venue')
      const schedPayload = {
        venue_id: venueId, days: form.days.length ? form.days : DAYS_OF_WEEK,
        start_time: form.start_time, end_time: form.end_time, is_all_day: form.is_all_day,
        deal_text: form.deal_text.trim() || 'See bar for details', deals: form.deals,
      }
      if (form.schedule_id) {
        await supabase.from('happy_hour_schedules').update(schedPayload).eq('id', form.schedule_id)
      } else {
        await supabase.from('happy_hour_schedules').insert([schedPayload])
      }
      closeModal(); fetchVenues()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function deleteSchedule(scheduleId: string, venueId: string) {
    if (!window.confirm('Delete this deal?')) return
    await supabase.from('happy_hour_schedules').delete().eq('id', scheduleId)
    setVenues(prev => prev.map(v =>
      v.id !== venueId ? v : { ...v, schedules: (v.schedules || []).filter(s => s.id !== scheduleId) }
    ).filter(v => (v.schedules || []).length > 0))
    fetchVenues()
  }

  async function deleteVenue(venueId: string) {
    if (!window.confirm('Delete this venue and all its deals?')) return
    await supabase.from('venues').delete().eq('id', venueId)
    setVenues(prev => prev.filter(v => v.id !== venueId))
  }

  // ── LOCATION ──────────────────────────────
  function requestLocation() {
    setLocPrompt(false)
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps', label: 'Your location' }),
      () => setLocPrompt(true)
    )
  }

  // ── MAP ↔ LIST SYNC ───────────────────────
  // Called from map popup "View details" button
  function handleViewDetails(venueId: string) {
    setSelectedVenueId(venueId)
    // If in map-only view, switch to list or split
    if (vm.view === 'map') vm.setView('list')
    // Expand the card and scroll to it
    setExpandedVenues(p => ({ ...p, [venueId]: true }))
    requestAnimationFrame(() => {
      const el = venueCardRefs.current[venueId]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  // ── MODAL ─────────────────────────────────
  function openAddModal(prefill: Partial<VenueFormState> = {}) {
    setForm({ ...EMPTY_FORM, ...prefill }); setPhotoPreview(null); setPhotoError(null); setShowModal(true)
  }
  function openEditScheduleModal(venue: Venue, schedule: HappyHourSchedule) {
    setForm({
      id: venue.id, name: venue.name, neighborhood: venue.neighborhood, city: venue.city,
      address: venue.address || '', website: venue.website || '', phone: venue.phone || '',
      categories: venue.categories, price_tier: venue.price_tier || '', image_url: venue.image_url || '',
      schedule_id: schedule.id, days: schedule.days as DayOfWeek[], start_time: schedule.start_time,
      end_time: schedule.end_time, is_all_day: schedule.is_all_day, deal_text: schedule.deal_text, deals: schedule.deals,
    })
    setPhotoPreview(null); setPhotoError(null); setShowModal(true)
  }
  function closeModal() {
    setShowModal(false); setForm(EMPTY_FORM); setPhotoPreview(null); setPhotoError(null)
  }

  // ── PHOTO UPLOAD ──────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoError(null); setPhotoLoading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string; setPhotoPreview(base64)
      try {
        const response = await fetch('/api/scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 1000,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64.split(',')[1] } },
              { type: 'text', text: `Extract happy hour deal info. Respond ONLY with JSON:
{"name":"","neighborhood":"","deal_text":"","deals":[{"type":"beer|wine|cocktail|food|general","description":"","price":0}],"start_time":"16:00","end_time":"19:00","days":["Mon","Tue","Wed","Thu","Fri"]}` }
            ]}]
          })
        })
        const data = await response.json()
        if (data.error) throw new Error(data.error.message)
        const parsed = JSON.parse((data.content || []).map((c: any) => c.text || '').join('').replace(/```json|```/g, '').trim())
        setForm(f => ({
          ...f, name: parsed.name || f.name, neighborhood: parsed.neighborhood || f.neighborhood,
          deal_text: parsed.deal_text || f.deal_text, deals: parsed.deals?.length ? parsed.deals : f.deals,
          start_time: parsed.start_time || f.start_time, end_time: parsed.end_time || f.end_time,
          days: parsed.days?.length ? parsed.days : f.days,
        }))
      } catch { setPhotoError('Could not read the image. Try a clearer photo or fill in manually.') }
      setPhotoLoading(false)
    }
    reader.readAsDataURL(file)
  }

  // ── DERIVED STATE ─────────────────────────
  const neighborhoods = getNeighborhoods(venues)
  const filtered = sortVenuesByMode(
    filterVenues(venues, fs.filters, userLocation),
    fs.sort,
    userLocation
  )

  // ── RENDER ────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Happy Hour</h1>
        <span className="app-city">Cincinnati</span>
        <ViewToggle view={vm.view} onSet={vm.setView} />
        <button className="header-add-btn" onClick={() => openAddModal()}>+ Add</button>
      </header>

      {/* ── MOBILE FILTER TOGGLE ── */}
      <div className="mobile-filter-toggle-row">
        <button
          className={`mobile-filter-btn${filterOpen ? ' active' : ''}${fs.activeCount > 0 ? ' has-filters' : ''}`}
          onClick={() => setFilterOpen(v => !v)}
        >
          <span className="filter-icon">⊟</span>
          Filters
          {fs.activeCount > 0 && <span className="filter-badge">{fs.activeCount}</span>}
        </button>
        {locPrompt && (
          <button className="loc-prompt-btn" onClick={requestLocation}>
            📍 Enable location
          </button>
        )}
      </div>

      {/* ── FILTER PANEL (collapsible on mobile) ── */}
      <div className={`filter-panel-wrap${filterOpen ? ' open' : ''}`}>
        <FilterPanel
          {...fs}
          venues={venues}
          neighborhoods={neighborhoods}
        />
      </div>

      {/* ── SORT BAR ── */}
      <SortBar
        sort={fs.sort}
        onSort={fs.setSort}
        userLocation={userLocation}
        onRequestLocation={() => {
          if ('geolocation' in navigator) requestLocation()
          else setLocPrompt(true)
        }}
        resultCount={filtered.length}
      />

      {loading && <p className="loading-msg">Loading deals...</p>}
      {error && !loading && <p className="error-msg">Database error — showing sample data.</p>}

      {/* ── MAP / LIST / SPLIT ── */}
      {!loading && (
        <div className={`content-area${vm.isSplit ? ' split' : ''}`}>
          {/* MAP PANEL */}
          {vm.isMap && (
            <div className="map-panel">
              <MapView
                venues={filtered}
                selectedVenueId={selectedVenueId}
                onSelectVenue={setSelectedVenueId}
                onViewDetails={handleViewDetails}
                userLocation={userLocation}
              />
            </div>
          )}

          {/* LIST PANEL */}
          {vm.isList && (
        <div className="venue-list">
          {filtered.length === 0 ? (
            <FilterEmptyState allVenues={venues} onClear={fs.clearAll} />
          ) : filtered.map(venue => {
            const key        = venue.id
            const isExpanded = expandedVenues[key] !== false
            const activeTab  = activeDealTab[key] || 0
            const schedules  = venue.schedules || []
            const curSchedule = schedules[Math.min(activeTab, schedules.length - 1)]
            const isOpen     = isVenueActiveNow(venue)
            const activeDays = getVenueActiveDays(venue)

            const venueStatus: ScheduleStatus | null = (() => {
              const statuses = schedules.map(s => getScheduleStatus(s)).filter((s): s is ScheduleStatus => s !== null)
              if (!statuses.length) return null
              return statuses.sort((a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status))[0]
            })()

            return (
              <div
                key={key}
                ref={el => { venueCardRefs.current[key] = el }}
                className={`venue-card${isOpen ? ' is-open' : ''}${selectedVenueId === key ? ' is-selected' : ''}`}
                onClick={() => setSelectedVenueId(key)}
              >
                <div className="venue-header" onClick={e => { e.stopPropagation(); setExpandedVenues(p => ({ ...p, [key]: !isExpanded })) }}>
                  <div className="venue-header-left">
                    <div className="venue-name-row">
                      <span className="venue-name">{venue.name}</span>
                      {venue.is_featured && <span className="badge badge-featured">Featured</span>}
                    </div>
                    <div className="venue-meta">
                      <span className="venue-neighborhood">{venue.neighborhood}</span>
                      {venue.price_tier && <span className="venue-price">{venue.price_tier}</span>}
                      {(venue.verification_status === 'verified' || venue.verification_status === 'claimed')
                        ? <span className="badge badge-verified">✓ Verified</span>
                        : <span className="badge-unverified">{verifiedAgo(venue) ?? 'Unverified'}</span>
                      }
                    </div>
                  </div>
                  <div className="venue-header-right">
                    {venueStatus && <StatusBadge status={venueStatus.status} label={venueStatus.badge} />}
                    <div className="venue-day-dots">
                      {DAYS_OF_WEEK.map(d => (
                        <div key={d} className={`day-dot${activeDays.includes(d) ? ' active' : ''}`}>{d[0]}</div>
                      ))}
                    </div>
                    <span className={`chevron${isExpanded ? ' open' : ''}`}>›</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="venue-body">
                    {schedules.length > 1 && (
                      <div className="deal-tabs">
                        {schedules.map((s, i) => {
                          const st = getScheduleStatus(s)
                          return (
                            <button
                              key={s.id}
                              className={`deal-tab${activeTab === i ? ' active' : ''}${isScheduleActiveNow(s) ? ' is-active-now' : ''}`}
                              onClick={() => setActiveDealTab(p => ({ ...p, [key]: i }))}
                            >
                              {s.days.length === 7 ? 'All week' : s.days.slice(0,3).join(', ')}
                              {st && (st.status === 'live_now' || st.status === 'ends_soon') && <span className="tab-open-dot" />}
                            </button>
                          )
                        })}
                        <button className="deal-tab-add" onClick={() => openAddModal({ id: venue.id, name: venue.name, neighborhood: venue.neighborhood, city: venue.city })}>+ Add deal</button>
                      </div>
                    )}

                    {curSchedule && (() => {
                      const st = getScheduleStatus(curSchedule)
                      return (
                        <div className="deal-detail">
                          <div className="deal-detail-top">
                            <span className="deal-time-badge">
                              {curSchedule.is_all_day ? 'All day' : `${fmtTime(curSchedule.start_time)} – ${fmtTime(curSchedule.end_time)}`}
                            </span>
                            {st && <StatusBadge status={st.status} label={st.label} />}
                          </div>
                          {curSchedule.deals.length > 0 ? (
                            <div className="deal-items">
                              {curSchedule.deals.map((item: DealItem, i: number) => (
                                <div key={i} className="deal-item" style={{ background: DEAL_TYPE_COLORS[item.type].bg, color: DEAL_TYPE_COLORS[item.type].text }}>
                                  <span className="deal-item-type">{DEAL_TYPE_LABELS[item.type]}</span>
                                  <span className="deal-item-desc">{item.description}</span>
                                  {item.price && <span className="deal-item-price">${item.price}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="deal-specials">{curSchedule.deal_text}</div>
                          )}
                          <div className="deal-detail-days">
                            {DAYS_OF_WEEK.map(d => (
                              <div key={d} className={`day-pill${curSchedule.days?.includes(d) ? ' active' : ''}`}>{d}</div>
                            ))}
                          </div>
                          <div className="deal-actions">
                            <button className="edit-btn" onClick={() => openEditScheduleModal(venue, curSchedule)}>Edit</button>
                            <button className="delete-deal-btn" onClick={() => deleteSchedule(curSchedule.id, venue.id)}>Delete deal</button>
                            {schedules.length === 1 && (
                              <button className="add-deal-btn" onClick={() => openAddModal({ id: venue.id, name: venue.name, neighborhood: venue.neighborhood, city: venue.city })}>+ Add another deal</button>
                            )}
                            <button className="delete-venue-btn" onClick={() => deleteVenue(venue.id)}>Delete venue</button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
          )}
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{form.schedule_id ? 'Edit deal' : form.id ? 'Add deal to venue' : 'Add a venue & deal'}</div>
            {!form.schedule_id && (
              <>
                <div className="photo-upload-zone" onClick={() => fileInputRef.current?.click()}>
                  {photoLoading ? (
                    <div className="photo-loading"><div className="spinner" /><span>Reading image...</span></div>
                  ) : photoPreview ? (
                    <div className="photo-preview-row">
                      <img src={photoPreview} alt="uploaded" className="photo-thumb" />
                      <div className="photo-preview-text">
                        <span className="photo-success">Form filled from photo</span>
                        <span className="photo-retake">Tap to use a different photo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="photo-placeholder">
                      <div className="photo-icon">📷</div>
                      <div className="photo-upload-title">Upload a photo to auto-fill</div>
                      <div className="photo-upload-sub">Chalkboard sign, menu, or flyer</div>
                    </div>
                  )}
                </div>
                {photoError && <div className="photo-error">{photoError}</div>}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <div className="form-divider"><span>or fill in manually</span></div>
              </>
            )}
            {!form.id && (
              <>
                <div className="form-group">
                  <label className="form-label">Bar / Restaurant name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. The Precinct" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Neighborhood</label>
                    <input className="form-input" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} placeholder="e.g. OTR" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Cincinnati" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. 1342 Vine St, Cincinnati, OH" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price tier</label>
                    <select className="form-select" value={form.price_tier} onChange={e => setForm(f => ({ ...f, price_tier: e.target.value as any }))}>
                      <option value="">Select...</option>
                      <option value="$">$ Budget</option>
                      <option value="$$">$$ Moderate</option>
                      <option value="$$$">$$$ Upscale</option>
                      <option value="$$$$">$$$$ Fine Dining</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Website</label>
                    <input className="form-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Deal description</label>
              <textarea className="form-textarea" value={form.deal_text} onChange={e => setForm(f => ({ ...f, deal_text: e.target.value }))} placeholder="e.g. $3 drafts, half-off apps, $5 wells..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start time</label>
                <input className="form-input" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">End time</label>
                <input className="form-input" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Days</label>
              <div className="day-checkboxes">
                {DAYS_OF_WEEK.map(day => (
                  <button key={day} className={`pill${form.days.includes(day) ? ' active-day' : ''}`}
                    onClick={() => setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }))}
                  >{day}</button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="btn-save" onClick={saveVenueAndSchedule} disabled={saving}>
                {saving ? 'Saving...' : form.schedule_id ? 'Save changes' : 'Save deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
