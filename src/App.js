import React, { useState, useEffect } from 'react'
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
  return `${hr}${m ? ':' + String(m).padStart(2,'0') : ''} ${ampm}`
}

const emptyForm = { bar: '', neighborhood: '', type: 'drink', specials: '', start: '16:00', end: '18:00', days: [] }

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

  useEffect(() => { fetchDeals() }, [])

  async function fetchDeals() {
    setLoading(true)
    const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setDeals(data || [])
    setLoading(false)
  }

  async function saveDeal() {
    if (!form.bar.trim()) return
    setSaving(true)
    const { error } = await supabase.from('deals').insert([{
      bar: form.bar.trim(),
      neighborhood: form.neighborhood.trim() || 'Unknown',
      type: form.type,
      specials: form.specials.trim() || 'See bar for details',
      start_time: form.start,
      end_time: form.end,
      days: form.days.length ? form.days : DAYS
    }])
    if (!error) { setShowModal(false); setForm(emptyForm); fetchDeals() }
    setSaving(false)
  }

  async function deleteDeal(id) {
    await supabase.from('deals').delete().eq('id', id)
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  function toggleSet(setter, val) {
    setter(prev => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  function clearAll() {
    setSearch(''); setActiveTypes(new Set()); setActiveDays(new Set()); setActiveLocs(new Set())
  }

  const neighborhoods = [...new Set(deals.map(d => d.neighborhood))].sort()

  const filtered = deals.filter(d => {
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

  function toggleFormDay(day) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day]
    }))
  }

  return (
    <div className="app">
      <header className="hh-header">
        <h1 className="hh-title">Happy Hour</h1>
        <span className="hh-subtitle">Cincinnati deals</span>
        <span className="count-badge">{filtered.length} deal{filtered.length !== 1 ? 's' : ''}</span>
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
        <button className="add-btn" onClick={() => setShowModal(true)}>+ Add Deal</button>
      </div>

      {loading && <p className="loading-msg">Loading deals...</p>}
      {error && <p className="error-msg">Could not connect to database. Check your Supabase keys.</p>}

      {!loading && (
        <div className="deal-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              No deals match — <button className="link-btn" onClick={clearAll}>clear filters</button> or <button className="link-btn" onClick={() => setShowModal(true)}>add one</button>
            </div>
          ) : filtered.map(d => (
            <div key={d.id} className="deal-card">
              <button className="delete-btn" onClick={() => deleteDeal(d.id)}>✕</button>
              <div className="deal-bar">{d.bar}</div>
              <div className="deal-neighborhood">{d.neighborhood}</div>
              <div className="deal-tags"><span className={`tag ${tagClass[d.type]}`}>{tagLabel[d.type]}</span></div>
              <div className="deal-specials">{d.specials}</div>
              <div className="deal-footer">
                <div className="deal-time">{fmtTime(d.start_time)} – {fmtTime(d.end_time)}</div>
                <div className="deal-days">
                  {DAYS.map(day => <div key={day} className={`day-dot${d.days?.includes(day) ? ' active' : ''}`}>{day[0]}</div>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Add a deal</div>
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
              <button className="btn-cancel" onClick={() => { setShowModal(false); setForm(emptyForm) }}>Cancel</button>
              <button className="btn-save" onClick={saveDeal} disabled={saving}>{saving ? 'Saving...' : 'Save deal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
