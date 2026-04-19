/**
 * AdminPage.tsx
 * Route: /admin
 *
 * Password-protected admin dashboard.
 * Shows venue stats: views, clicks, directions, favorites, confirmations.
 * Private — not linked anywhere in the public app.
 */

import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import type { Venue } from '../types'
import { getVenues } from '../services/venueService'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'appyhour2026'

interface VenueStats {
  venue_id: string
  card_views: number
  detail_views: number
  directions_clicks: number
  website_clicks: number
  favorites: number
  confirmations: number
  week_start: string
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      border: '1px solid #EAE6DF', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [venues, setVenues] = useState<Venue[]>([])
  const [stats, setStats] = useState<Record<string, VenueStats>>({})
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'views' | 'clicks'>('views')

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      setError('')
      loadData()
    } else {
      setError('Incorrect password')
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const venueList = await getVenues('Cincinnati')
      setVenues(venueList)

      const weekStart = getWeekStart(weekOffset)
      const weekEnd = getWeekEnd(weekOffset)

      const { data: statsData } = await supabase
        .from('venue_stats')
        .select('*')
        .gte('week_start', weekStart)
        .lte('week_start', weekEnd)

      const statsMap: Record<string, VenueStats> = {}
      if (statsData) {
        statsData.forEach((s: VenueStats) => {
          statsMap[s.venue_id] = s
        })
      }
      setStats(statsMap)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (authed) loadData()
  }, [weekOffset, authed]) // eslint-disable-line

  function getWeekStart(offset = 0): string {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff + offset * 7)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }

  function getWeekEnd(offset = 0): string {
    const d = new Date(getWeekStart(offset))
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  }

  function getWeekLabel(): string {
    if (weekOffset === 0) return 'This week'
    if (weekOffset === -1) return 'Last week'
    return `Week of ${getWeekStart(weekOffset)}`
  }

  function getVenueStats(venueId: string): VenueStats {
    return stats[venueId] ?? {
      venue_id: venueId,
      card_views: 0,
      detail_views: 0,
      directions_clicks: 0,
      website_clicks: 0,
      favorites: 0,
      confirmations: 0,
      week_start: getWeekStart(weekOffset),
    }
  }

  async function deleteVenue(venue: Venue) {
    if (!window.confirm(`Delete "${venue.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('venues').delete().eq('id', venue.id)
    if (error) { alert('Delete failed: ' + error.message); return }
    setVenues(prev => prev.filter(v => v.id !== venue.id))
  }

  async function sendStatsEmail(venue: Venue) {
    const s = getVenueStats(venue.id)
    setSending(venue.id)

    const subject = `Your Appy Hour listing performance — ${getWeekLabel()}`
    const body = `Hi ${venue.name},

Here's how your listing performed on Appy Hour ${getWeekLabel().toLowerCase()}:

📱 Card views: ${s.card_views}
👀 Detail page views: ${s.detail_views}
🗺️  Directions clicks: ${s.directions_clicks}
🌐 Website clicks: ${s.website_clicks}
♥ New saves: ${s.favorites}
✓ Deal confirmations: ${s.confirmations}

${s.detail_views > 0 ? `${s.detail_views} people checked out your full listing this week!` : 'Add more deal details to attract more clicks.'}

View your listing: ${window.location.origin}/venue/${venue.id}

Thanks for being part of Appy Hour Cincinnati.
— The Appy Hour Team`

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoLink, '_blank')
    setSending(null)
  }

  const filteredVenues = venues
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()) ||
                 v.neighborhood.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'views') return (getVenueStats(b.id).detail_views) - (getVenueStats(a.id).detail_views)
      if (sortBy === 'clicks') return (getVenueStats(b.id).directions_clicks) - (getVenueStats(a.id).directions_clicks)
      return 0
    })

  const totalViews = venues.reduce((acc, v) => acc + getVenueStats(v.id).detail_views, 0)
  const totalDirections = venues.reduce((acc, v) => acc + getVenueStats(v.id).directions_clicks, 0)
  const totalFavorites = venues.reduce((acc, v) => acc + getVenueStats(v.id).favorites, 0)
  const totalConfirmations = venues.reduce((acc, v) => acc + getVenueStats(v.id).confirmations, 0)

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F6F1', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 360, border: '1px solid #EAE6DF' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍺</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1612', letterSpacing: -.5, fontStyle: 'italic' }}>
              <span>Appy</span><span style={{ color: '#E85D1A' }}>Hour</span>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Admin Dashboard</div>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD8', fontSize: 15, marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
              autoFocus
            />
            {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <button type="submit" style={{ width: '100%', padding: 13, background: '#E85D1A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet><title>Admin — Appy Hour</title></Helmet>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1612', letterSpacing: -.4 }}>
              📊 Venue Analytics
            </div>
            <div style={{ fontSize: 13, color: '#888' }}>{venues.length} venues · Cincinnati</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Prev</button>
            <div style={{ padding: '7px 14px', borderRadius: 8, background: '#3A3630', color: '#fff', fontSize: 13, fontWeight: 700 }}>{getWeekLabel()}</div>
            <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', cursor: 'pointer', fontSize: 13, opacity: weekOffset === 0 ? .4 : 1 }}>Next →</button>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          <StatCard label="Detail views" value={totalViews} color="#E85D1A" />
          <StatCard label="Directions" value={totalDirections} color="#3B82F6" />
          <StatCard label="Saves" value={totalFavorites} color="#E24B4A" />
          <StatCard label="Confirmations" value={totalConfirmations} color="#22C55E" />
        </div>

        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search venues..."
            style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 9, border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit' }}
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="views">Sort by views</option>
            <option value="clicks">Sort by directions</option>
            <option value="name">Sort by name</option>
          </select>
        </div>

        {/* Venue table */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredVenues.map(venue => {
              const s = getVenueStats(venue.id)
              return (
                <div key={venue.id} style={{ background: '#fff', border: '1px solid #EAE6DF', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1612', marginBottom: 2 }}>{venue.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{venue.neighborhood} · {venue.verification_status}</div>
                    </div>
                    <button
                      onClick={() => sendStatsEmail(venue)}
                      disabled={sending === venue.id}
                      style={{ background: '#3A3630', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {sending === venue.id ? 'Opening...' : '📧 Email stats'}
                    </button>
                    <button
                      onClick={() => deleteVenue(venue)}
                      style={{ background: '#fee2e2', color: '#c0392b', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 12 }}>
                    {[
                      { label: 'Card views', value: s.card_views, color: '#888' },
                      { label: 'Page views', value: s.detail_views, color: '#E85D1A' },
                      { label: 'Directions', value: s.directions_clicks, color: '#3B82F6' },
                      { label: 'Website', value: s.website_clicks, color: '#8B5CF6' },
                      { label: 'Saves', value: s.favorites, color: '#E24B4A' },
                      { label: 'Confirmed', value: s.confirmations, color: '#22C55E' },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </>
  )
}
