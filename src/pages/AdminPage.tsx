/**
 * AdminPage.tsx — Route: /admin
 * Tab 1: Pending approvals
 * Tab 2: Venue analytics + featured/sponsored toggles
 */

import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL!, process.env.REACT_APP_SUPABASE_ANON_KEY!)
import type { Venue } from '../types'
import { getVenues } from '../services/venueService'
import { getAllBrandAds, saveBrandAd, deleteBrandAd, toggleBrandAd } from '../services/brandAdService'
import type { BrandAd } from '../components/SponsoredBanner'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'appyhour2026'

interface VenueStats {
  venue_id: string; card_views: number; detail_views: number
  directions_clicks: number; website_clicks: number
  favorites: number; confirmations: number; week_start: string
}

interface Contribution {
  id: string; flow: 'new_venue' | 'suggest_edit'
  data: any; status: 'pending' | 'approved' | 'rejected'; created_at: string
}

const btn = (bg: string, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12,
  fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: bg,
  color, flexShrink: 0, ...extra,
})

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #EAE6DF', borderRadius: 14,
  padding: '16px 18px', marginBottom: 10,
}

function Toggle({ on, onChange, label, color }: {
  on: boolean; onChange: (v: boolean) => void; label: string; color: string
}) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 20,
        background: on ? color : '#E0DDD8',
        position: 'relative', transition: 'background .2s',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left .2s',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: on ? color : '#aaa' }}>
        {label}
      </span>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #EAE6DF', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 20px', borderRadius: '10px 10px 0 0', border: 'none',
      borderBottom: active ? '3px solid #E85D1A' : '3px solid transparent',
      cursor: 'pointer', fontSize: 13, fontWeight: 700,
      background: active ? '#fff' : 'transparent',
      color: active ? '#1A1612' : '#888',
    }}>{children}</button>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState<'pending' | 'analytics' | 'ads'>('pending')

  // Pending
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribLoading, setContribLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  // Brand Ads
  const [brandAds, setBrandAds] = useState<BrandAd[]>([])
  const [editingAd, setEditingAd] = useState<Partial<BrandAd> | null>(null)
  const [adSaving, setAdSaving] = useState(false)

  // Analytics
  const [venues, setVenues] = useState<Venue[]>([])
  const [stats, setStats] = useState<Record<string, VenueStats>>({})
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'views' | 'clicks'>('views')
  const [toggling, setToggling] = useState<string | null>(null)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true); setLoginError('')
      // Load both on login — contributions won't auto-reload after that
      setTimeout(() => { loadContributions(); loadAnalytics(); loadBrandAds() }, 50)
    } else setLoginError('Incorrect password')
  }

  // ── CONTRIBUTIONS ───────────────────────────────

  async function loadContributions() {
    setContribLoading(true)
    const { data } = await supabase
      .from('contributions')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      // Merge with any local status overrides (for rejected/approved before page reload)
      const overrides = JSON.parse(localStorage.getItem('contrib_overrides') || '{}')
      const merged = data.map((c: Contribution) => overrides[c.id] ? { ...c, status: overrides[c.id] } : c)
      setContributions(merged)
    }
    setContribLoading(false)
  }

  async function approveVenue(contrib: Contribution) {
    setActionLoading(contrib.id)
    try {
      const d = contrib.data
      const { data: venue, error: vErr } = await supabase
        .from('venues')
        .insert([{
          name: d.name?.trim(), neighborhood: d.neighborhood?.trim() || 'Cincinnati',
          city: d.city || 'Cincinnati', state: 'OH',
          address: d.address?.trim() || null, website: d.website?.trim() || null,
          phone: d.phone?.trim() || null,
          latitude: d.latitude || null, longitude: d.longitude || null,
          dog_friendly: d.dog_friendly || false,
          categories: [], price_tier: null, image_url: null,
          verification_status: 'community', data_source: 'user_submitted',
          is_featured: false, is_sponsored: false, upvote_count: 0,
          last_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }])
        .select().single()

      if (vErr) throw new Error(vErr.message)

      const submittedSchedules = d.schedules || []
      if (submittedSchedules.length > 0) {
        await supabase.from('happy_hour_schedules').insert(
          submittedSchedules.map((s: any) => ({
            venue_id: venue.id, days: s.days,
            start_time: s.start_time || '16:00', end_time: s.end_time || '19:00',
            is_all_day: s.is_all_day || false,
            deal_text: s.deal_text || '', deals: s.deals || [],
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }))
        )
      } else if (d.deal_details || d.schedule_description) {
        await supabase.from('happy_hour_schedules').insert([{
          venue_id: venue.id, days: ['Mon','Tue','Wed','Thu','Fri'],
          start_time: '16:00', end_time: '19:00', is_all_day: false,
          deal_text: d.deal_details || d.schedule_description || '',
          deals: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }])
      }

      await supabase.from('contributions').update({ status: 'approved' }).eq('id', contrib.id)
      setContributions(prev => prev.map(c => c.id === contrib.id ? { ...c, status: 'approved' } : c))
      alert(`✅ ${d.name} is now live!`)
    } catch (e: any) { alert('Error: ' + e.message) }
    setActionLoading(null)
  }

  async function rejectContribution(contrib: Contribution) {
    if (!window.confirm('Reject this submission?')) return
    setActionLoading(contrib.id)
    await supabase.from('contributions').update({ status: 'rejected' }).eq('id', contrib.id)
    const overrides = JSON.parse(localStorage.getItem('contrib_overrides') || '{}')
    localStorage.setItem('contrib_overrides', JSON.stringify({ ...overrides, [contrib.id]: 'rejected' }))
    setContributions(prev => prev.map(c => c.id === contrib.id ? { ...c, status: 'rejected' } : c))
    setActionLoading(null)
  }

  async function deleteContribution(id: string) {
    if (!window.confirm('Delete this submission permanently?')) return
    await supabase.from('contributions').delete().eq('id', id)
    setContributions(prev => prev.filter(c => c.id !== id))
  }

  const filteredContribs = contributions.filter(c => filter === 'all' ? true : c.status === filter)
  const pendingCount = contributions.filter(c => c.status === 'pending').length

  // ── BRAND ADS ──────────────────────────────────

  async function loadBrandAds() {
    const ads = await getAllBrandAds()
    setBrandAds(ads)
  }

  async function handleToggleAd(ad: BrandAd) {
    await toggleBrandAd(ad.id, !ad.is_active)
    setBrandAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a))
  }

  async function handleDeleteAd(id: string) {
    if (!window.confirm('Delete this ad?')) return
    await deleteBrandAd(id)
    setBrandAds(prev => prev.filter(a => a.id !== id))
  }

  async function handleSaveAd() {
    if (!editingAd?.brand_name || !editingAd?.headline) {
      alert('Brand name and headline are required')
      return
    }
    setAdSaving(true)
    const saved = await saveBrandAd({
      ...editingAd,
      is_active: editingAd.is_active ?? false,
      position: editingAd.position ?? brandAds.length,
    })
    if (saved) {
      if (editingAd.id) {
        setBrandAds(prev => prev.map(a => a.id === saved.id ? saved : a))
      } else {
        setBrandAds(prev => [...prev, saved])
      }
      setEditingAd(null)
    }
    setAdSaving(false)
  }

  const EMPTY_AD: Partial<BrandAd> = {
    brand_name: '', headline: '', subtext: '',
    logo_url: '', logo_bg_color: '#E85D1A',
    is_active: false, position: 0,
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fileExt = file.name.split('.').pop()
    const fileName = `brand-logos/${Date.now()}.${fileExt}`
    const { data, error } = await supabase.storage
      .from('public')
      .upload(fileName, file, { upsert: true })
    if (error) {
      // Fallback: use base64 data URL
      const reader = new FileReader()
      reader.onload = () => setEditingAd(prev => ({ ...prev, logo_url: reader.result as string }))
      reader.readAsDataURL(file)
      return
    }
    const { data: urlData } = supabase.storage.from('public').getPublicUrl(fileName)
    setEditingAd(prev => ({ ...prev, logo_url: urlData.publicUrl }))
  }

  // ── ANALYTICS ──────────────────────────────────

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    try {
      const venueList = await getVenues('Cincinnati')
      setVenues(venueList)
      const { data: statsData } = await supabase
        .from('venue_stats').select('*')
        .gte('week_start', getWeekStart(weekOffset))
        .lte('week_start', getWeekEnd(weekOffset))
      const statsMap: Record<string, VenueStats> = {}
      if (statsData) statsData.forEach((s: VenueStats) => { statsMap[s.venue_id] = s })
      setStats(statsMap)
    } catch (e) { console.error(e) }
    setAnalyticsLoading(false)
  }

  useEffect(() => { if (authed) loadAnalytics() }, [weekOffset, authed]) // eslint-disable-line

  function getWeekStart(offset = 0): string {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7)
    d.setHours(0,0,0,0)
    return d.toISOString().split('T')[0]
  }

  function getWeekEnd(offset = 0): string {
    const d = new Date(getWeekStart(offset))
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  }

  function getWeekLabel() {
    if (weekOffset === 0) return 'This week'
    if (weekOffset === -1) return 'Last week'
    return `Week of ${getWeekStart(weekOffset)}`
  }

  function getVenueStat(venueId: string): VenueStats {
    return stats[venueId] ?? {
      venue_id: venueId, card_views: 0, detail_views: 0,
      directions_clicks: 0, website_clicks: 0, favorites: 0,
      confirmations: 0, week_start: getWeekStart(weekOffset),
    }
  }

  async function toggleVenueFlag(venue: Venue, field: 'is_featured' | 'is_sponsored') {
    const newVal = !venue[field]
    setToggling(venue.id + field)
    const { error } = await supabase
      .from('venues').update({ [field]: newVal }).eq('id', venue.id)
    if (!error) {
      setVenues(prev => prev.map(v => v.id === venue.id ? { ...v, [field]: newVal } : v))
    }
    setToggling(null)
  }

  async function deleteVenue(venue: Venue) {
    if (!window.confirm(`Delete "${venue.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('venues').delete().eq('id', venue.id)
    if (error) { alert('Delete failed: ' + error.message); return }
    setVenues(prev => prev.filter(v => v.id !== venue.id))
  }

  async function sendStatsEmail(venue: Venue) {
    const s = getVenueStat(venue.id)
    setSending(venue.id)
    const subject = `Your Appy Hour listing performance — ${getWeekLabel()}`
    const body = `Hi ${venue.name},\n\nHere's how your listing performed on Appy Hour ${getWeekLabel().toLowerCase()}:\n\n📱 Card views: ${s.card_views}\n👀 Detail views: ${s.detail_views}\n🗺️ Directions: ${s.directions_clicks}\n🌐 Website: ${s.website_clicks}\n♥ Saves: ${s.favorites}\n✓ Confirmations: ${s.confirmations}\n\nView your listing: ${window.location.origin}/venue/${venue.id}\n\n— The Appy Hour Team`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    setSending(null)
  }

  const filteredVenues = venues
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.neighborhood.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'views') return getVenueStat(b.id).detail_views - getVenueStat(a.id).detail_views
      return getVenueStat(b.id).directions_clicks - getVenueStat(a.id).directions_clicks
    })

  const totalViews = venues.reduce((acc, v) => acc + getVenueStat(v.id).detail_views, 0)
  const totalDirections = venues.reduce((acc, v) => acc + getVenueStat(v.id).directions_clicks, 0)
  const totalFavorites = venues.reduce((acc, v) => acc + getVenueStat(v.id).favorites, 0)
  const totalConfirmations = venues.reduce((acc, v) => acc + getVenueStat(v.id).confirmations, 0)

  // ── LOGIN ────────────────────────────────────

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

  // ── DASHBOARD ────────────────────────────────

  return (
    <>
      <Helmet><title>Admin — Appy Hour</title></Helmet>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 16px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -.4, fontStyle: 'italic' }}>
            <span style={{ color: '#E85D1A' }}>Appy</span>Hour
            <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 10, fontStyle: 'normal' }}>Admin</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>{venues.length} venues · Cincinnati</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #EAE6DF', marginBottom: 24 }}>
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
          <TabBtn active={tab === 'ads'} onClick={() => setTab('ads')}>
            📣 Brand ads
            {brandAds.filter(a => a.is_active).length > 0 && (
              <span style={{ background: '#8B5CF6', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, marginLeft: 7, fontWeight: 800 }}>
                {brandAds.filter(a => a.is_active).length} live
              </span>
            )}
          </TabBtn>
        </div>

        {/* ══ PENDING TAB ══ */}
        {tab === 'pending' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  ...btn(filter === f ? '#3A3630' : '#fff', filter === f ? '#fff' : '#888'),
                  border: '1px solid #EAE6DF',
                }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span style={{ marginLeft: 5, opacity: .7 }}>
                    ({f === 'all' ? contributions.length : contributions.filter(c => c.status === f).length})
                  </span>
                </button>
              ))}
              <button onClick={loadContributions} style={{ ...btn('#fff', '#888'), border: '1px solid #EAE6DF', marginLeft: 'auto' }}>↻ Refresh</button>
            </div>

            {contribLoading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading...</div>}

            {!contribLoading && filteredContribs.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  {filter === 'pending' ? 'No pending submissions' : 'Nothing here'}
                </div>
                <div style={{ fontSize: 13 }}>
                  {filter === 'pending' ? 'New venue submissions will appear here.' : 'Try a different filter.'}
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
                  ...card,
                  borderLeft: `4px solid ${isPending ? '#E85D1A' : contrib.status === 'approved' ? '#22C55E' : '#ddd'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1612' }}>
                          {isNew ? (d.name || 'Unnamed venue') : `Edit: ${d.venue_name || 'Unknown'}`}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: isNew ? '#EFF6FF' : '#FFF8E8', color: isNew ? '#1E40AF' : '#7A5000' }}>
                          {isNew ? '+ New venue' : '✏️ Edit suggestion'}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: isPending ? '#FFF3CD' : contrib.status === 'approved' ? '#DCFCE7' : '#F3F4F6',
                          color: isPending ? '#856404' : contrib.status === 'approved' ? '#15803D' : '#6B7280',
                        }}>
                          {contrib.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {isNew ? `${d.neighborhood || '—'} · ${d.city || 'Cincinnati'}` : (d.field_suggestions || '').slice(0, 80)}
                        <span style={{ marginLeft: 8, color: '#bbb' }}>
                          {new Date(contrib.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      <button onClick={() => setExpandedId(isExpanded ? null : contrib.id)}
                        style={{ ...btn('#F8F6F1', '#555'), border: '1px solid #EAE6DF' }}>
                        {isExpanded ? 'Hide' : 'View details'}
                      </button>
                      {isPending && isNew && (
                        <button onClick={() => approveVenue(contrib)} disabled={actionLoading === contrib.id}
                          style={btn('#22C55E', '#fff')}>
                          {actionLoading === contrib.id ? 'Publishing...' : '✓ Approve & publish'}
                        </button>
                      )}
                      {isPending && (
                        <button onClick={() => rejectContribution(contrib)} disabled={actionLoading === contrib.id}
                          style={btn('#fee2e2', '#c0392b')}>
                          ✕ Reject
                        </button>
                      )}
                      {!isPending && (
                        <button onClick={() => deleteContribution(contrib.id)}
                          style={btn('#F3F4F6', '#9CA3AF')}>
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #EAE6DF' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {Object.entries(d).filter(([k]) => k !== 'flow' && k !== 'schedules').map(([key, val]) => (
                          <div key={key} style={{ background: '#F8F6F1', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{key.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: 12, color: '#333', wordBreak: 'break-word' as const }}>{String(val || '—')}</div>
                          </div>
                        ))}
                      </div>
                      {d.schedules && d.schedules.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>Schedules ({d.schedules.length})</div>
                          {d.schedules.map((s: any, i: number) => (
                            <div key={i} style={{ background: '#F8F6F1', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{s.days?.join(', ')} · {s.start_time}–{s.end_time}</div>
                              <div style={{ fontSize: 11, color: '#666' }}>{s.deal_text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {isPending && isNew && (
                        <div style={{ marginTop: 10, padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
                          ⚠️ Approving will publish this venue immediately with all submitted schedules.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ ADS TAB ══ */}
        {tab === 'ads' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612' }}>Brand advertisements</div>
              <button onClick={() => setEditingAd(EMPTY_AD)} style={{ ...btn('#E85D1A', '#fff'), padding: '8px 16px' }}>
                + New ad
              </button>
            </div>

            {/* Edit / Create form */}
            {editingAd && (
              <div style={{ ...card, border: '2px solid #E85D1A', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1612', marginBottom: 14 }}>
                  {editingAd.id ? 'Edit ad' : 'Create new ad'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[
                    ['brand_name', 'Brand name *', 'e.g. Modelo'],
                    ['headline', 'Headline *', 'e.g. Enjoy Modelo tonight'],
                    ['subtext', 'Subtext', 'e.g. Find it on draft at bars near you'],
                    ['logo_bg_color', 'Logo background color', '#E85D1A'],
                    ['position', 'Position (order)', '0'],
                  ].map(([field, label, placeholder]) => (
                    <div key={field}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                      <input
                        value={(editingAd as any)[field] ?? ''}
                        onChange={e => setEditingAd(prev => ({ ...prev, [field]: field === 'position' ? parseInt(e.target.value) || 0 : e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E0DDD8', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Brand logo</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {editingAd?.logo_url && (
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: editingAd.logo_bg_color || '#E85D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          <img src={editingAd.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                        </div>
                      )}
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#F8F6F1', border: '1px solid #E0DDD8', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#555' }}>
                        📁 {editingAd?.logo_url ? 'Change logo' : 'Upload logo'}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      </label>
                      {editingAd?.logo_url && (
                        <button onClick={() => setEditingAd(prev => ({ ...prev, logo_url: '' }))} style={{ ...btn('#fee2e2', '#c0392b'), fontSize: 11 }}>Remove</button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>PNG, JPG, or SVG. Square logos work best.</div>
                  </div>
                </div>

                {/* Preview */}
                {editingAd.headline && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Preview</div>
                    <div style={{ background: '#3A3630', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: editingAd.logo_bg_color || '#E85D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {editingAd.logo_url
                          ? <img src={editingAd.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                          : <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{(editingAd.brand_name || 'AD').slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{editingAd.headline}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{editingAd.subtext}</div>
                      </div>

                    </div>
                    <div style={{ textAlign: 'right', fontSize: 9, color: '#aaa', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3 }}>Sponsored</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingAd(null)} style={{ ...btn('#F3F4F6', '#555'), padding: '8px 16px' }}>Cancel</button>
                  <button onClick={handleSaveAd} disabled={adSaving} style={{ ...btn('#E85D1A', '#fff'), padding: '8px 16px' }}>
                    {adSaving ? 'Saving...' : 'Save ad'}
                  </button>
                </div>
              </div>
            )}

            {/* Ad list */}
            {brandAds.length === 0 && !editingAd && (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📣</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No brand ads yet</div>
                <div style={{ fontSize: 13 }}>Create your first ad to start showing sponsored banners between venue cards.</div>
              </div>
            )}

            {brandAds.map(ad => (
              <div key={ad.id} style={{ ...card, borderLeft: `4px solid ${ad.is_active ? '#22C55E' : '#ddd'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: ad.logo_bg_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {ad.logo_url
                        ? <img src={ad.logo_url} alt={ad.brand_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                        : <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{ad.brand_name.slice(0, 2).toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1612', marginBottom: 2 }}>{ad.brand_name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{ad.headline}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div onClick={() => handleToggleAd(ad)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ width: 36, height: 20, borderRadius: 20, background: ad.is_active ? '#22C55E' : '#E0DDD8', position: 'relative', transition: 'background .2s' }}>
                        <div style={{ position: 'absolute', top: 2, left: ad.is_active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ad.is_active ? '#22C55E' : '#aaa' }}>{ad.is_active ? 'Live' : 'Off'}</span>
                    </div>
                    <button onClick={() => setEditingAd(ad)} style={{ ...btn('#F8F6F1', '#555'), border: '1px solid #EAE6DF' }}>Edit</button>
                    <button onClick={() => handleDeleteAd(ad.id)} style={btn('#fee2e2', '#c0392b')}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {tab === 'analytics' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612' }}>Weekly performance</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setWeekOffset(w => w - 1)} style={{ ...btn('#fff', '#555'), border: '1px solid #E0DDD8' }}>← Prev</button>
                <div style={{ padding: '7px 14px', borderRadius: 8, background: '#3A3630', color: '#fff', fontSize: 13, fontWeight: 700 }}>{getWeekLabel()}</div>
                <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0}
                  style={{ ...btn('#fff', '#555'), border: '1px solid #E0DDD8', opacity: weekOffset === 0 ? .4 : 1 }}>Next →</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <StatCard label="Page views" value={totalViews} color="#E85D1A" />
              <StatCard label="Directions" value={totalDirections} color="#3B82F6" />
              <StatCard label="Saves" value={totalFavorites} color="#E24B4A" />
              <StatCard label="Confirmations" value={totalConfirmations} color="#22C55E" />
            </div>

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
            ) : filteredVenues.map(venue => {
              const s = getVenueStat(venue.id)
              return (
                <div key={venue.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1612', marginBottom: 2 }}>{venue.name}</div>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{venue.neighborhood} · {venue.verification_status}</div>
                      {/* Featured / Sponsored toggles */}
                      <div style={{ display: 'flex', gap: 20 }}>
                        <Toggle
                          on={venue.is_featured}
                          onChange={() => toggleVenueFlag(venue, 'is_featured')}
                          label="Featured"
                          color="#E85D1A"
                        />
                        <Toggle
                          on={(venue as any).is_sponsored}
                          onChange={() => toggleVenueFlag(venue, 'is_sponsored')}
                          label="Sponsored"
                          color="#8B5CF6"
                        />
                        {toggling?.startsWith(venue.id) && (
                          <span style={{ fontSize: 11, color: '#aaa' }}>Saving...</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      <button onClick={() => sendStatsEmail(venue)} disabled={sending === venue.id}
                        style={btn('#3A3630', '#fff')}>
                        {sending === venue.id ? 'Opening...' : '📧 Email stats'}
                      </button>
                      <button onClick={() => deleteVenue(venue)} style={btn('#fee2e2', '#c0392b')}>
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
