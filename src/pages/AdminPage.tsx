/**
 * AdminPage.tsx
 * Route: /admin
 *
 * Password-protected admin dashboard.
 * Tab 1: Pending approvals — review and approve/reject community submissions
 * Tab 2: Venue analytics — weekly stats per venue
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

interface Contribution {
  id: string
  flow: 'new_venue' | 'suggest_edit'
  data: any
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const S: Record<string, React.CSSProperties> = {
  btn: { border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  card: { background: '#fff', border: '1px solid #EAE6DF', borderRadius: 14, padding: '16px 18px', marginBottom: 10 },
  label: { fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.03em' },
  val: { fontSize: 20, fontWeight: 800 },
  tag: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #EAE6DF', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
      <div style={S.label}>{label}</div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 700,
      background: active ? '#3A3630' : '#fff',
      color: active ? '#fff' : '#888',
      boxShadow: active ? 'none' : 'none',
      borderBottom: active ? '2px solid #E85D1A' : '2px solid transparent',
    }}>
      {children}
    </button>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState<'pending' | 'analytics'>('pending')

  // Pending approvals state
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribLoading, setContribLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  // Analytics state
  const [venues, setVenues] = useState<Venue[]>([])
  const [stats, setStats] = useState<Record<string, VenueStats>>({})
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'views' | 'clicks'>('views')

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      setLoginError('')
      loadContributions()
      loadAnalytics()
    } else {
      setLoginError('Incorrect password')
    }
  }

  // ── CONTRIBUTIONS ──────────────────────────────

  async function loadContributions() {
    setContribLoading(true)
    const { data } = await supabase
      .from('contributions')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setContributions(data)
    setContribLoading(false)
  }

  async function approveVenue(contrib: Contribution) {
    setActionLoading(contrib.id)
    try {
      const d = contrib.data

      // 1. Create venue
      const { data: venue, error: vErr } = await supabase
        .from('venues')
        .insert([{
          name: d.name?.trim(),
          neighborhood: d.neighborhood?.trim() || 'Cincinnati',
          city: d.city || 'Cincinnati',
          state: 'OH',
          address: d.address?.trim() || null,
          website: d.website?.trim() || null,
          phone: d.phone?.trim() || null,
          dog_friendly: false,
          categories: [],
          price_tier: null,
          image_url: null,
          verification_status: 'community',
          data_source: 'user_submitted',
          is_featured: false,
          upvote_count: 0,
          last_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select().single()

      if (vErr) throw new Error(vErr.message)

      // 2. Create schedules from submission data
      const submittedSchedules = d.schedules || []
      if (submittedSchedules.length > 0) {
        const scheduleRows = submittedSchedules.map((s: any) => ({
          venue_id: venue.id,
          days: s.days,
          start_time: s.start_time || '16:00',
          end_time: s.end_time || '19:00',
          is_all_day: s.is_all_day || false,
          deal_text: s.deal_text || '',
          deals: s.deals || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
        await supabase.from('happy_hour_schedules').insert(scheduleRows)
      } else if (d.deal_details || d.schedule_description) {
        // Fallback for old format submissions
        await supabase.from('happy_hour_schedules').insert([{
          venue_id: venue.id,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          start_time: '16:00', end_time: '19:00', is_all_day: false,
          deal_text: d.deal_details || d.schedule_description || '',
          deals: [],
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }])
      }

      // 3. Mark contribution approved
      await supabase.from('contributions').update({ status: 'approved' }).eq('id', contrib.id)
      setContributions(prev => prev.map(c => c.id === contrib.id ? { ...c, status: 'approved' } : c))
      alert(`✅ ${d.name} is now live on the app!`)
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setActionLoading(null)
  }

  async function rejectContribution(contrib: Contribution) {
    if (!window.confirm('Reject this submission?')) return
    setActionLoading(contrib.id)
    await supabase.from('contributions').update({ status: 'rejected' }).eq('id', contrib.id)
    setContributions(prev => prev.map(c => c.id === contrib.id ? { ...c, status: 'rejected' } : c))
    setActionLoading(null)
  }

  async function deleteContribution(id: string) {
    if (!window.confirm('Permanently delete this submission?')) return
    await supabase.from('contributions').delete().eq('id', id)
    setContributions(prev => prev.filter(c => c.id !== id))
  }

  const filteredContribs = contributions.filter(c =>
    filter === 'all' ? true : c.status === filter
  )

  const pendingCount = contributions.filter(c => c.status === 'pending').length

  // ── ANALYTICS ──────────────────────────────────

  async function loadAnalytics() {
    setAnalyticsLoading(true)
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
      if (statsData) statsData.forEach((s: VenueStats) => { statsMap[s.venue_id] = s })
      setStats(statsMap)
    } catch (e) { console.error(e) }
    setAnalyticsLoading(false)
  }

  useEffect(() => {
    if (authed) loadAnalytics()
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
      venue_id: venueId, card_views: 0, detail_views: 0,
      directions_clicks: 0, website_clicks: 0, favorites: 0,
      confirmations: 0, week_start: getWeekStart(weekOffset),
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
    const body = `Hi ${venue.name},\n\nHere's how your listing performed on Appy Hour ${getWeekLabel().toLowerCase()}:\n\n📱 Card views: ${s.card_views}\n👀 Detail page views: ${s.detail_views}\n🗺️  Directions clicks: ${s.directions_clicks}\n🌐 Website clicks: ${s.website_clicks}\n♥ New saves: ${s.favorites}\n✓ Deal confirmations: ${s.confirmations}\n\nView your listing: ${window.location.origin}/venue/${venue.id}\n\nThanks for being part of Appy Hour Cincinnati.\n— The Appy Hour Team`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    setSending(null)
  }

  const filteredVenues = venues
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.neighborhood.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'views') return getVenueStats(b.id).detail_views - getVenueStats(a.id).detail_views
      return getVenueStats(b.id).directions_clicks - getVenueStats(a.id).directions_clicks
    })

  const totalViews = venues.reduce((acc, v) => acc + getVenueStats(v.id).detail_views, 0)
  const totalDirections = venues.reduce((acc, v) => acc + getVenueStats(v.id).directions_clicks, 0)
  const totalFavorites = venues.reduce((acc, v) => acc + getVenueStats(v.id).favorites, 0)
  const totalConfirmations = venues.reduce((acc, v) => acc + getVenueStats(v.id).confirmations, 0)

  // ── LOGIN ───────────────────────────────────────

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
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password" autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD8', fontSize: 15, marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            {loginError && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 10 }}>{loginError}</div>}
            <button type="submit" style={{ width: '100%', padding: 13, background: '#E85D1A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── DASHBOARD ──────────────────────────────────

  return (
    <>
      <Helmet><title>Admin — Appy Hour</title></Helmet>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1A1612', letterSpacing: -.4 }}>
            <span style={{ color: '#E85D1A', fontStyle: 'italic' }}>Appy</span>
            <span style={{ fontStyle: 'italic' }}>Hour</span>
            <span style={{ fontSize: 13, fontWeight: 400, color: '#888', marginLeft: 10 }}>Admin</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>{venues.length} venues live · Cincinnati</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #EAE6DF', paddingBottom: 0 }}>
          <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}>
            🔔 Pending approvals
            {pendingCount > 0 && (
              <span style={{ background: '#E85D1A', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, marginLeft: 7, fontWeight: 800 }}>
                {pendingCount}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'analytics'} onClick={() => setTab('analytics')}>
            📊 Analytics
          </TabBtn>
        </div>

        {/* ══ PENDING APPROVALS TAB ══ */}
        {tab === 'pending' && (
          <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  ...S.btn,
                  background: filter === f ? '#3A3630' : '#fff',
                  color: filter === f ? '#fff' : '#888',
                  border: '1px solid #EAE6DF',
                }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && (
                    <span style={{ marginLeft: 5, opacity: .7 }}>
                      ({contributions.filter(c => c.status === f).length})
                    </span>
                  )}
                </button>
              ))}
              <button onClick={loadContributions} style={{ ...S.btn, background: '#fff', color: '#888', border: '1px solid #EAE6DF', marginLeft: 'auto' }}>
                ↻ Refresh
              </button>
            </div>

            {contribLoading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading submissions...</div>}

            {!contribLoading && filteredContribs.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  {filter === 'pending' ? 'No pending submissions' : 'Nothing here'}
                </div>
                <div style={{ fontSize: 13 }}>
                  {filter === 'pending' ? 'New venue submissions will appear here for your review.' : 'Try a different filter.'}
                </div>
              </div>
            )}

            {!contribLoading && filteredContribs.map(contrib => {
              const d = contrib.data || {}
              const isNew = contrib.flow === 'new_venue'
              const isExpanded = expandedId === contrib.id
              const isPending = contrib.status === 'pending'

              return (
                <div key={contrib.id} style={{
                  ...S.card,
                  borderLeft: `4px solid ${isPending ? '#E85D1A' : contrib.status === 'approved' ? '#22C55E' : '#ccc'}`,
                }}>
                  {/* Row top */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1612' }}>
                          {isNew ? (d.name || 'Unnamed venue') : `Edit: ${d.venue_name || 'Unknown'}`}
                        </span>
                        <span style={{
                          ...S.tag,
                          background: isNew ? '#EFF6FF' : '#FFF8E8',
                          color: isNew ? '#1E40AF' : '#7A5000',
                        }}>
                          {isNew ? '+ New venue' : '✏️ Edit suggestion'}
                        </span>
                        <span style={{
                          ...S.tag,
                          background: isPending ? '#FFF3CD' : contrib.status === 'approved' ? '#DCFCE7' : '#F3F4F6',
                          color: isPending ? '#856404' : contrib.status === 'approved' ? '#15803D' : '#6B7280',
                        }}>
                          {contrib.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {isNew ? `${d.neighborhood || '—'} · ${d.city || 'Cincinnati'}` : d.field_suggestions?.slice(0, 80) + '...'}
                        <span style={{ marginLeft: 8, color: '#bbb' }}>
                          {new Date(contrib.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : contrib.id)}
                        style={{ ...S.btn, background: '#F8F6F1', color: '#555', border: '1px solid #EAE6DF' }}
                      >
                        {isExpanded ? 'Hide' : 'View details'}
                      </button>
                      {isPending && isNew && (
                        <button
                          onClick={() => approveVenue(contrib)}
                          disabled={actionLoading === contrib.id}
                          style={{ ...S.btn, background: '#22C55E', color: '#fff' }}
                        >
                          {actionLoading === contrib.id ? 'Publishing...' : '✓ Approve & publish'}
                        </button>
                      )}
                      {isPending && (
                        <button
                          onClick={() => rejectContribution(contrib)}
                          disabled={actionLoading === contrib.id}
                          style={{ ...S.btn, background: '#fee2e2', color: '#c0392b' }}
                        >
                          ✕ Reject
                        </button>
                      )}
                      {!isPending && (
                        <button
                          onClick={() => deleteContribution(contrib.id)}
                          style={{ ...S.btn, background: '#F3F4F6', color: '#9CA3AF' }}
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #EAE6DF' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                        {Object.entries(d).filter(([k]) => k !== 'flow').map(([key, val]) => (
                          <div key={key} style={{ background: '#F8F6F1', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{key.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: 12, color: '#333', wordBreak: 'break-word' as const }}>{String(val) || '—'}</div>
                          </div>
                        ))}
                      </div>
                      {isNew && isPending && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
                          ⚠️ Approving will publish this venue immediately. The schedule will default to Mon-Fri 4-7 PM — edit in Supabase or on the venue page after publishing if needed.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {tab === 'analytics' && (
          <div>
            {/* Week nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612' }}>Weekly performance</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setWeekOffset(w => w - 1)} style={{ ...S.btn, background: '#fff', color: '#555', border: '1px solid #E0DDD8' }}>← Prev</button>
                <div style={{ padding: '7px 14px', borderRadius: 8, background: '#3A3630', color: '#fff', fontSize: 13, fontWeight: 700 }}>{getWeekLabel()}</div>
                <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0} style={{ ...S.btn, background: '#fff', color: '#555', border: '1px solid #E0DDD8', opacity: weekOffset === 0 ? .4 : 1 }}>Next →</button>
              </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <StatCard label="Page views" value={totalViews} color="#E85D1A" />
              <StatCard label="Directions" value={totalDirections} color="#3B82F6" />
              <StatCard label="Saves" value={totalFavorites} color="#E24B4A" />
              <StatCard label="Confirmations" value={totalConfirmations} color="#22C55E" />
            </div>

            {/* Search + sort */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search venues..."
                style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 9, border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit' }} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="views">Sort by views</option>
                <option value="clicks">Sort by directions</option>
                <option value="name">Sort by name</option>
              </select>
            </div>

            {analyticsLoading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredVenues.map(venue => {
                  const s = getVenueStats(venue.id)
                  return (
                    <div key={venue.id} style={S.card}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1612', marginBottom: 2 }}>{venue.name}</div>
                          <div style={{ fontSize: 12, color: '#888' }}>{venue.neighborhood} · {venue.verification_status}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                          <button onClick={() => sendStatsEmail(venue)} disabled={sending === venue.id}
                            style={{ ...S.btn, background: '#3A3630', color: '#fff' }}>
                            {sending === venue.id ? 'Opening...' : '📧 Email stats'}
                          </button>
                          <button onClick={() => deleteVenue(venue)}
                            style={{ ...S.btn, background: '#fee2e2', color: '#c0392b' }}>
                            🗑 Delete
                          </button>
                        </div>
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
                            <div style={{ ...S.val, color: stat.color }}>{stat.value}</div>
                            <div style={S.label}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}
