import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const tagClass = { drink: 'tag-drink', food: 'tag-food', both: 'tag-both' }
const tagLabel = { drink: 'Drinks', food: 'Food', both: 'Drinks + Food' }

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`
}

const emptyForm = {
  id: null, bar: '', neighborhood: '', type: 'drink',
  specials: '', start: '16:00', end: '18:00', days: []
}

// Group deals by bar name
function groupByVenue(deals) {
  const map = {}
  deals.forEach(d => {
    const key = d.bar.toLowerCase().trim()
    if (!map[key]) map[key] = { bar: d.bar, neighborhood: d.neighborhood, deals: [] }
    map[key].deals.push(d)
  })
  return Object.values(map)
}

export default function App() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTypes, setActiveTypes] = useState(new Set())
  const [activeDays, setActiveDays] = useState(new Set())
  const [activeLocs, setActiveLocs] = useState(new Set())
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const [expandedVenues, setExpandedVenues] = useState({})
  const [activeDealTab, setActiveDealTab] = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => { fetchDeals() }, [])

  async function fetchDeals() {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals').select('*').order('bar').then(r => r)
    if (error) setError(error.message)
    else setDeals(data || [])
    setLoading(false)
  }

  async function saveDeal() {
    if (!form.bar.trim()) return
    setSaving(true)
    const payload = {
      bar: form.bar.trim(),
      neighborhood: form.neighborhood.trim() || 'Unknown',
      type: form.type,
      specials: form.specials.trim() || 'See bar for details',
      start_time: form.start,
      end_time: form.end,
      days: form.days.length ? form.days : DAYS
    }
    if (form.id) {
      await supabase.from('deals').update(payload).eq('id', form.id)
    } else {
      await supabase.from('deals').insert([payload])
    }
    setSaving(false)
    closeModal()
    fetchDeals()
  }

  async function deleteDeal(id) {
    await supabase.from('deals').delete().eq('id', id)
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  function openAddModal() {
    setForm(emptyForm)
    setPhotoPreview(null)
    setPhotoError(null)
    setShowModal(true)
  }

  function openEditModal(deal) {
    setForm({
      id: deal.id,
      bar: deal.bar,
      neighborhood: deal.neighborhood || '',
      type: deal.type,
      specials: deal.specials || '',
      start: deal.start_time || '16:00',
      end: deal.end_time || '18:00',
      days: deal.days || []
    })
    setPhotoPreview(null)
    setPhotoError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setForm(emptyForm)
    setPhotoPreview(null)
    setPhotoError(null)
  }

  function toggleSet(setter, val) {
    setter(prev => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  function clearAll() {
    setSearch('')
    setActiveTypes(new Set())
    setActiveDays(new Set())
    setActiveLocs(new Set())
  }

  function toggleFormDay(day) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day]
    }))
  }

  function toggleVenue(key) {
    setExpandedVenues(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoError(null)
    setPhotoLoading(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target.result
      setPhotoPreview(base64)
      try {
        const base64Data = base64.split(',')[1]
        const mediaType = file.type || 'image/jpeg'
        const response = await fetch('/api/scan', {
  method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
                { type: 'text', text: `Look at this image of a happy hour deal, bar sign, menu, or flyer. Extract the deal information and respond ONLY with a JSON object, no other text, no markdown backticks. Use this exact format:
{
  "bar": "bar or restaurant name or empty string if not found",
  "neighborhood": "neighborhood or area name or empty string if not found",
  "type": "drink or food or both",
  "specials": "description of the specials, deals, prices",
  "start": "HH:MM in 24hr format or 16:00 if not found",
  "end": "HH:MM in 24hr format or 19:00 if not found",
  "days": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] only include days mentioned, or all days if not specified
}` }
              ]
            }]
          })
        })
        const data = await response.json()
        if (data.error) { setPhotoError('Could not read image. Check your Anthropic API key.'); setPhotoLoading(false); return }
        const text = data.content?.map(c => c.text || '').join('') || ''
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        setForm(f => ({
          ...f,
          bar: parsed.bar || f.bar,
          neighborhood: parsed.neighborhood || f.neighborhood,
          type: parsed.type || f.type,
          specials: parsed.specials || f.specials,
          start: parsed.start || f.start,
          end: parsed.end || f.end,
          days: parsed.days || f.days
        }))
        setPhotoLoading(false)
      } catch (err) {
        setPhotoError('Could not read the image. Try a clearer photo or fill in manually.')
        setPhotoLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const neighborhoods = [...new Set(deals.map(d => d.neighborhood))].sort()

  // Filter deals first
  const filteredDeals = deals.filter(d => {
    if (activeTypes.size > 0) {
      const match = activeTypes.has(d.type) || (activeTypes.has('drink') && d.type === 'both') || (activeTypes.has('food') && d.type === 'both')
      if (!match) return false
    }
    if (activeDays.size > 0 && ![...activeDays].some(day => d.days?.includes(day))) return false
    if (activeLocs.size > 0 && !activeLocs.has(d.neighborhood)) return false
    const q = search.toLowerCase()
    if (q && !d.bar.toLowerCase().includes(q) && !d.neighborhood?.toLowerCase().includes(q) && !d.specials?.toLowerCase().includes(q)) return false
    return true
  })

  const venues = groupByVenue(filteredDeals)

  return (
    <div className="app">
      <header className="hh-header">
        <h1 className="hh-title">Happy Hour</h1>
        <span className="hh-subtitle">Cincinnati deals</span>
        <span className="count-badge">{venues.length} venue{venues.length !== 1 ? 's' : ''}</span>
      </header>

      <div className="filter-bar">
        <div className="filter-row">
          <span className="filter-label">Search</span>
          <input className="hh-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Bar name or keywords..." />
          <button className="clear-btn" onClick={clearAll}>Clear all</button>
        </div>
        <div className="filter-row">
          <span className="filter-label">Type</span>
          <div className="pill-group">
            {['drink','food','both'].map(t => (
              <button key={t} className={`pill${activeTypes.has(t) ? ` active-${t}` : ''}`} onClick={() => toggleSet(setActiveTypes, t)}>
                <span className={`pill-dot dot-${t}`}></span>{tagLabel[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">Day</span>
          <div className="pill-group">
            {DAYS.map(d => (
              <button key={d} className={`pill${activeDays.has(d) ? ' active-day' : ''}`} onClick={() => toggleSet(setActiveDays, d)}>{d}</button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">Area</span>
          <div className="pill-group">
            {neighborhoods.map(n => (
              <button key={n} className={`pill${activeLocs.has(n) ? ' active-loc' : ''}`} onClick={() => toggleSet(setActiveLocs, n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="top-row">
        <div style={{flex:1}}></div>
        <button className="add-btn" onClick={openAddModal}>+ Add Deal</button>
      </div>

      {loading && <p className="loading-msg">Loading deals...</p>}
      {error && <p className="error-msg">Could not connect to database. Check your Supabase keys.</p>}

      {!loading && (
        <div className="venue-list">
          {venues.length === 0 ? (
            <div className="empty-state">
              No deals found — <button className="link-btn" onClick={clearAll}>clear filters</button> or <button className="link-btn" onClick={openAddModal}>add one</button>
            </div>
          ) : venues.map(venue => {
            const key = venue.bar.toLowerCase().trim()
            const isExpanded = expandedVenues[key] !== false // default open
            const activeTab = activeDealTab[key] || 0
            const currentDeal = venue.deals[Math.min(activeTab, venue.deals.length - 1)]
            const hasMultiple = venue.deals.length > 1

            return (
              <div key={key} className="venue-card">
                <div className="venue-header" onClick={() => toggleVenue(key)}>
                  <div className="venue-header-left">
                    <div className="venue-name">{venue.bar}</div>
                    <div className="venue-meta">
                      <span className="venue-neighborhood">{venue.neighborhood}</span>
                      <span className="venue-deal-count">{venue.deals.length} deal{venue.deals.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="venue-header-right">
                    <div className="venue-day-dots">
                      {DAYS.map(day => {
                        const hasDeal = venue.deals.some(d => d.days?.includes(day))
                        return <div key={day} className={`day-dot${hasDeal ? ' active' : ''}`}>{day[0]}</div>
                      })}
                    </div>
                    <span className={`chevron${isExpanded ? ' open' : ''}`}>›</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="venue-body">
                    {hasMultiple && (
                      <div className="deal-tabs">
                        {venue.deals.map((d, i) => (
                          <button
                            key={d.id}
                            className={`deal-tab${activeTab === i ? ' active' : ''}`}
                            onClick={() => setActiveDealTab(prev => ({ ...prev, [key]: i }))}
                          >
                            {d.days?.length === 7 ? 'All week' : d.days?.slice(0,3).join(', ') || `Deal ${i+1}`}
                          </button>
                        ))}
                        <button className="deal-tab-add" onClick={() => { setForm({...emptyForm, bar: venue.bar, neighborhood: venue.neighborhood}); setPhotoPreview(null); setPhotoError(null); setShowModal(true) }}>
                          + Add deal
                        </button>
                      </div>
                    )}

                    {currentDeal && (
                      <div className="deal-detail">
                        <div className="deal-detail-top">
                          <span className={`tag ${tagClass[currentDeal.type]}`}>{tagLabel[currentDeal.type]}</span>
                          <span className="deal-time-badge">{fmtTime(currentDeal.start_time)} – {fmtTime(currentDeal.end_time)}</span>
                        </div>
                        <div className="deal-specials">{currentDeal.specials}</div>
                        <div className="deal-detail-days">
                          {DAYS.map(day => (
                            <div key={day} className={`day-pill${currentDeal.days?.includes(day) ? ' active' : ''}`}>{day}</div>
                          ))}
                        </div>
                        <div className="deal-actions">
                          <button className="edit-btn" onClick={() => openEditModal(currentDeal)}>Edit</button>
                          <button className="delete-deal-btn" onClick={() => deleteDeal(currentDeal.id)}>Delete</button>
                          {!hasMultiple && (
                            <button className="add-deal-btn" onClick={() => { setForm({...emptyForm, bar: venue.bar, neighborhood: venue.neighborhood}); setPhotoPreview(null); setPhotoError(null); setShowModal(true) }}>
                              + Add another deal
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{form.id ? 'Edit deal' : 'Add a deal'}</div>

            {!form.id && (
              <>
                <div className="photo-upload-zone" onClick={() => fileInputRef.current.click()}>
                  {photoLoading ? (
                    <div className="photo-loading"><div className="spinner"></div><span>Reading image...</span></div>
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
                <input ref={fileInputRef} type="file" accept="image/*" cpture="environment" style={{display:'none'}} onChange={handlePhotoUpload} />
                <div className="form-divider"><span>or fill in manually</span></div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Bar / Restaurant name</label>
              <input className="form-input" value={form.bar} onChange={e => setForm(f => ({...f, bar: e.target.value}))} placeholder="e.g. The Precinct" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Neighborhood</label>
                <input className="form-input" value={form.neighborhood} onChange={e => setForm(f => ({...f, neighborhood: e.target.value}))} placeholder="e.g. OTR" />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                  <option value="drink">Drinks</option>
                  <option value="food">Food</option>
                  <option value="both">Drinks + Food</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Specials</label>
              <textarea className="form-textarea" value={form.specials} onChange={e => setForm(f => ({...f, specials: e.target.value}))} placeholder="e.g. $3 drafts, half-off apps..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start time</label>
                <input className="form-input" type="time" value={form.start} onChange={e => setForm(f => ({...f, start: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">End time</label>
                <input className="form-input" type="time" value={form.end} onChange={e => setForm(f => ({...f, end: e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Days</label>
              <div className="day-checkboxes">
                {DAYS.map(day => (
                  <button key={day} className={`pill${form.days.includes(day) ? ' active-day' : ''}`} onClick={() => toggleFormDay(day)}>{day}</button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="btn-save" onClick={saveDeal} disabled={saving}>{saving ? 'Saving...' : form.id ? 'Save changes' : 'Save deal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
