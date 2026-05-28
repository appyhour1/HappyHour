/**
 * VenueDetailPage.tsx
 * Route: /venue/:id
 */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAppContext } from '../contexts/AppContext'
import { getVenueById } from '../services/venueService'
import { supabase } from '../lib/supabase'
import { fmtTime, isVenueActiveNow, getVenueActiveDays, verifiedAgo } from '../utils/filters'
import { getScheduleStatus, STATUS_VISUALS } from '../utils/happeningNow'
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS, CATEGORY_LABELS } from '../types'
import { Analytics } from '../services/analytics'
import { SuggestEditForm } from '../components/ContributionForms'
import { ClaimVenueForm } from '../components/ClaimVenueForm'
import { useConfirmDeal } from '../hooks/useConfirmDeal'
import { PhotoGallery } from '../components/PhotoGallery'
import { track } from '../services/analytics'
import { openExternal } from '../AppShell'
import type { Venue, HappyHourSchedule, HappyHourStatus, ScheduleStatus } from '../types'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

const JS_DAY_TO_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const DEAL_TYPE_ORDER = ['beer', 'cocktail', 'liquor', 'wine', 'food', 'general']

// Maps schedule day abbreviations to Google Calendar RRULE BYDAY codes
const DAY_TO_RRULE: Record<string, string> = {
  Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH',
  Fri: 'FR', Sat: 'SA', Sun: 'SU',
}

function getBestDay(schedules: HappyHourSchedule[]): string {
  if (!schedules.length) return JS_DAY_TO_ABBR[new Date().getDay()]
  const todayAbbr = JS_DAY_TO_ABBR[new Date().getDay()]
  const allDays = Array.from(new Set(schedules.flatMap(s => s.days)))
  if (allDays.includes(todayAbbr as any)) return todayAbbr
  const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const todayIdx = dayOrder.indexOf(todayAbbr)
  for (let i = 1; i <= 7; i++) {
    const next = dayOrder[(todayIdx + i) % 7]
    if (allDays.includes(next as any)) return next
  }
  return allDays[0] || todayAbbr
}

function getScheduleBlocksForDay(schedules: HappyHourSchedule[], day: string) {
  const matching = schedules.filter(s => s.days.includes(day as any))
  if (!matching.length) return []

  const sorted = [...matching].sort((a, b) => {
    if (a.is_all_day) return -1
    if (b.is_all_day) return 1
    return a.start_time.localeCompare(b.start_time)
  })

  return sorted.map(schedule => {
    const sortedDeals = [...schedule.deals].sort((a, b) => {
      const aIdx = DEAL_TYPE_ORDER.indexOf(a.type) ?? 99
      const bIdx = DEAL_TYPE_ORDER.indexOf(b.type) ?? 99
      if (aIdx !== bIdx) return aIdx - bIdx
      const aHasPrice = a.price != null
      const bHasPrice = b.price != null
      if (aHasPrice && !bHasPrice) return -1
      if (!aHasPrice && bHasPrice) return 1
      if (aHasPrice && bHasPrice && a.price !== b.price) return (a.price ?? 0) - (b.price ?? 0)
      return a.description.toLowerCase().localeCompare(b.description.toLowerCase())
    })

    const time = schedule.is_all_day
      ? 'All day'
      : `${fmtTime(schedule.start_time)} – ${fmtTime(schedule.end_time)}`

    return { schedule, deals: sortedDeals, time }
  })
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 17S3 12.3 3 7.5C3 5.3 4.8 3.5 7 3.5c1.4 0 2.6.7 3.3 1.8C11 4.2 12.2 3.5 13.5 3.5c2.2 0 4 1.8 4 4C17.5 12.3 10 17 10 17z"
        fill={filled ? '#E24B4A' : 'none'} stroke={filled ? '#E24B4A' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { favorites, venues: allVenues } = useAppContext()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const confirmDeal = useConfirmDeal()
  const [activeDay, setActiveDay] = useState('')

  function handleShare() {
    const url = window.location.href
    const text = `Check out happy hour at ${venue?.name} 🍺`
    if (navigator.share) {
      navigator.share({ title: venue?.name ?? 'Happy Hour', text, url })
    } else {
      navigator.clipboard.writeText(url)
      // Use a non-blocking notification instead of alert()
      // If you have a toast system, call it here instead
      const btn = document.activeElement as HTMLElement
      const orig = btn?.textContent ?? ''
      if (btn) {
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = orig }, 1500)
      }
    }
    track('venue_shared', { venue_id: venue?.id, venue_name: venue?.name, source: 'detail' })
  }

  function addToCalendar(schedule: HappyHourSchedule) {
    const today = new Date()
    const [sh, sm] = schedule.start_time.split(':').map(Number)
    const [eh, em] = schedule.end_time.split(':').map(Number)
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sh, sm)
    const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), eh, em)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const title = encodeURIComponent(`Happy Hour at ${venue?.name}`)
    const details = encodeURIComponent(schedule.deal_text || 'Happy hour deals')
    const location = encodeURIComponent(venue?.address || venue?.neighborhood || '')

    // FIX: include BYDAY in RRULE so the event recurs on the correct days,
    // not just whatever day the user happens to click the button.
    const byday = schedule.days
      .map(d => DAY_TO_RRULE[d])
      .filter(Boolean)
      .join(',')
    const rrule = byday ? `RRULE:FREQ=WEEKLY;BYDAY=${byday}` : 'RRULE:FREQ=WEEKLY'

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}&recur=${encodeURIComponent(rrule)}`
    openExternal(url)
    track('add_to_calendar', { venue_id: venue?.id, venue_name: venue?.name })
  }

  function openDirections() {
    if (!venue) return
    const q = venue.address
      ? encodeURIComponent(venue.address)
      : `${encodeURIComponent(venue.name + ' ' + venue.city)}`
    openExternal(`https://www.google.com/maps/dir/?api=1&destination=${q}`)
    Analytics.getDirectionsClicked(venue.id, venue.name)
  }

  // FIX: navigate(-1) sends users who arrive from Google straight off the app.
  // Check if there's an app-internal history entry first; fall back to home.
  function handleBack() {
    if (window.history.state?.idx > 0) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!id) return
    const cached = allVenues.find(v => v.id === id)
    if (cached) {
      setVenue(cached)
      setLoading(false)
      setActiveDay(getBestDay(cached.schedules ?? []))
    }
    getVenueById(id).then(async v => {
      if (v) {
        setVenue(v)
        setActiveDay(getBestDay(v.schedules ?? []))
        Analytics.venueDetailViewed(v.id, v.name)
        try {
          await supabase.from('venue_impressions').insert({
            venue_id: v.id,
            event_type: 'detail_view',
          })
        } catch { /* silent */ }
        confirmDeal.loadCountsForVenues([v.id])
      }
      setLoading(false)
    })
  }, [id]) // eslint-disable-line

  if (loading) return <div className="loading-msg">Loading...</div>
  if (!venue) return (
    <div className="detail-not-found">
      <p>Venue not found.</p>
      <Link to="/">← Back to browse</Link>
    </div>
  )

  const schedules = venue.schedules ?? []
  const isOpen = isVenueActiveNow(venue)
  const activeDays = getVenueActiveDays(venue)
  const isFav = favorites.isFavorite(venue.id)

  const venueStatus: ScheduleStatus | null = (() => {
    const statuses = schedules.map(s => getScheduleStatus(s)).filter((s): s is ScheduleStatus => s !== null)
    if (!statuses.length) return null
    return statuses.sort((a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status))[0]
  })()

  const vis = venueStatus ? STATUS_VISUALS[venueStatus.status] : null
  const related = allVenues
    .filter(v => v.id !== venue.id && v.neighborhood === venue.neighborhood)
    .slice(0, 3)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BarOrCafe',
    name: venue.name,
    address: venue.address ? {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.city,
      addressRegion: venue.state,
    } : undefined,
    url: venue.website ?? undefined,
    telephone: venue.phone ?? undefined,
    geo: venue.latitude && venue.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: venue.latitude,
      longitude: venue.longitude,
    } : undefined,
  }

  return (
    <>
      <Helmet>
        <title>{venue.name} Happy Hour — {venue.neighborhood}, {venue.city}</title>
        <meta name="description" content={`${venue.name} happy hour deals in ${venue.neighborhood}, ${venue.city}. ${schedules[0]?.deal_text ?? 'See current specials and hours.'}`} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
      <div className="detail-page">

        {/* ── BACK NAV ── */}
        <nav className="detail-nav">
          {/* FIX: use handleBack() instead of navigate(-1) to prevent users
              who arrived from Google from being kicked off the app */}
          <button className="detail-back-btn" onClick={handleBack}>← Back</button>
          <div className="detail-nav-actions">
            <button className="detail-share-btn" onClick={openDirections} aria-label="Directions">
              🗺️ Directions
            </button>
            <button className="detail-share-btn" onClick={handleShare} aria-label="Share">
              🔗 Share
            </button>
            <button
              className={`detail-fav-btn${isFav ? ' saved' : ''}`}
              onClick={() => favorites.toggleFavorite(venue.id, venue.name)}
              aria-label={isFav ? 'Remove from favorites' : 'Save'}
            >
              <HeartIcon filled={isFav} />
              {isFav ? 'Saved' : 'Save'}
            </button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <div className="detail-hero">
          {venue.image_url && (
            <div className="detail-hero-img" style={{ backgroundImage: `url(${venue.image_url})` }} />
          )}
          <div className="detail-hero-content">
            <div className="detail-badges">
              {venue.is_featured && <span className="detail-badge detail-badge--featured">⭐ Featured</span>}
              {venueStatus && vis && (
                <span className="detail-badge detail-badge--status" style={{ background: vis.bg, color: vis.text, borderColor: vis.border }}>
                  <span className={`status-dot${vis.pulse ? ' pulse' : ''}`} style={{ background: vis.dot }} />
                  {venueStatus.badge}
                </span>
              )}
            </div>
            <h1 className="detail-name">{venue.name}</h1>
            <div className="detail-meta">
              <span>{venue.neighborhood}, {venue.city}</span>
              {venue.price_tier && <span className="detail-price">{venue.price_tier}</span>}
            </div>
            {venue.categories.length > 0 && (
              <div className="detail-tags">
                {venue.categories.map(cat => (
                  <span key={cat} className="detail-tag">{CATEGORY_LABELS[cat]}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── MAP ── */}
        {venue.latitude && venue.longitude && process.env.REACT_APP_GOOGLE_PLACES_KEY && (
          <div className="detail-map-wrap">
            <iframe
              title={`Map of ${venue.name}`}
              className="detail-map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/place?key=${process.env.REACT_APP_GOOGLE_PLACES_KEY}&q=${encodeURIComponent(venue.address || venue.name + ' Cincinnati')}&zoom=15`}
            />
            <button className="detail-map-directions" onClick={openDirections}>
              🗺️ Get directions →
            </button>
          </div>
        )}

        {/* ── INFO ── */}
        {(venue.address || venue.website || venue.phone) && (
          <div className="detail-section">
            <h2 className="detail-section-title">Info</h2>
            <div className="detail-info-grid">
              {venue.address && (
                <div className="detail-info-row">
                  <span className="detail-info-label">Address</span>
                  <a
                    href="#"
                    className="detail-info-link"
                    onClick={e => { e.preventDefault(); openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address!)}`); Analytics.getDirectionsClicked(venue.id, venue.name) }}>
                    {venue.address} ↗
                  </a>
                </div>
              )}
              {venue.website && (
                <div className="detail-info-row">
                  <span className="detail-info-label">Website</span>
                  <a
                    href="#"
                    className="detail-info-link"
                    onClick={e => { e.preventDefault(); openExternal(venue.website!); Analytics.outboundWebsiteClicked(venue.id, venue.website!) }}>
                    Visit website ↗
                  </a>
                </div>
              )}
              {venue.phone && (
                <div className="detail-info-row">
                  <span className="detail-info-label">Phone</span>
                  <a href={`tel:${venue.phone}`} className="detail-info-link">{venue.phone}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HAPPY HOUR SCHEDULES ── */}
        <div className="detail-section">
          <h2 className="detail-section-title">Happy Hour Deals</h2>
          {(() => {
            const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
            const venueDays = dayOrder.filter(d => schedules.some(s => s.days.includes(d as any)))
            const todayAbbr = JS_DAY_TO_ABBR[new Date().getDay()]
            const selectedDay = activeDay || getBestDay(schedules)
            const isToday = selectedDay === todayAbbr
            const blocks = getScheduleBlocksForDay(schedules, selectedDay)

            return (
              <>
                {venueDays.length > 1 && (
                  <div className="detail-schedule-tabs">
                    {venueDays.map(d => {
                      const dayBlocks = getScheduleBlocksForDay(schedules, d)
                      const hasLiveBlock = d === todayAbbr && dayBlocks.some(b => {
                        const st = getScheduleStatus(b.schedule)
                        return st && (st.status === 'live_now' || st.status === 'ends_soon')
                      })
                      return (
                        <button
                          key={d}
                          className={`detail-tab${selectedDay === d ? ' active' : ''}`}
                          onClick={() => setActiveDay(d)}
                        >
                          {d}
                          {hasLiveBlock && <span className="tab-live-dot" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {blocks.length === 0 ? (
                  <p className="detail-deal-text">No deals scheduled for this day.</p>
                ) : (
                  <div className="detail-schedule">
                    {blocks.map((block, blockIdx) => {
                      const st = getScheduleStatus(block.schedule)
                      const blockVis = st ? STATUS_VISUALS[st.status] : null
                      const isLive = st && (st.status === 'live_now' || st.status === 'ends_soon')
                      const showStatus = isToday && st

                      return (
                        <div
                          key={block.schedule.id}
                          style={{
                            marginBottom: blockIdx < blocks.length - 1 ? 20 : 0,
                            paddingBottom: blockIdx < blocks.length - 1 ? 20 : 0,
                            borderBottom: blockIdx < blocks.length - 1 ? '1px dashed #EAE6DF' : 'none',
                          }}
                        >
                          <div className="detail-schedule-header" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span className="detail-time" style={isLive ? { color: '#22C55E' } : {}}>
                              {block.time}
                            </span>
                            {showStatus && blockVis && (
                              <span className="detail-schedule-status" style={{ background: blockVis.bg, color: blockVis.text }}>
                                {st.label}
                              </span>
                            )}
                          </div>

                          {!block.schedule.is_all_day && (
                            <button className="detail-cal-btn" onClick={() => addToCalendar(block.schedule)}>
                              📅 Add to Google Calendar
                            </button>
                          )}

                          {block.deals.length > 0 ? (
                            <div className="detail-deals">
                              {block.deals.map((deal, i) => (
                                <div key={i} className="detail-deal-row" style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}>
                                  <span className="detail-deal-type">{DEAL_TYPE_LABELS[deal.type]}</span>
                                  <span className="detail-deal-desc">{deal.description}</span>
                                  {deal.price != null && <span className="detail-deal-price">${deal.price}</span>}
                                </div>
                              ))}
                            </div>
                          ) : block.schedule.deal_text ? (
                            <p className="detail-deal-text">{block.schedule.deal_text}</p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* ── PHOTO GALLERY ── */}
        <div className="detail-section">
          <PhotoGallery venueId={venue.id} venueName={venue.name} />
        </div>

        {/* ── VERIFICATION ── */}
        <div className="detail-section detail-section--trust">
          <div className="detail-trust-row">
            <span className={`detail-verification detail-verification--${venue.verification_status}`}>
              {venue.verification_status === 'verified' || venue.verification_status === 'claimed' ? '✓ Verified' : '○ Unverified'}
            </span>
            {venue.last_verified_at && (
              <span className="detail-verified-ago">{verifiedAgo(venue)}</span>
            )}
            <button
              className={`detail-confirm-btn${confirmDeal.hasConfirmed(venue.id) ? ' confirmed' : ''}`}
              onClick={() => confirmDeal.confirmDeal(venue.id)}
              disabled={confirmDeal.hasConfirmed(venue.id) || confirmDeal.confirming === venue.id}
            >
              {confirmDeal.hasConfirmed(venue.id)
                ? `✓ You confirmed this`
                : confirmDeal.confirming === venue.id
                  ? 'Saving...'
                  : `👍 Still accurate${(confirmDeal.confirmCounts[venue.id] ?? 0) > 0 ? ` (${confirmDeal.confirmCounts[venue.id]} this week)` : ''}`
              }
            </button>
            <button className="detail-suggest-btn" onClick={() => setShowEditForm(true)}>
              Suggest correction
            </button>
          </div>
        </div>

        {showEditForm && (
          <div className="detail-section">
            <SuggestEditForm venue={venue} onClose={() => setShowEditForm(false)} />
          </div>
        )}

        {!showClaimForm ? (
          <div className="detail-claim-banner">
            <span className="detail-claim-text">Is this your bar?</span>
            <button className="detail-claim-btn" onClick={() => setShowClaimForm(true)}>
              Claim it free →
            </button>
          </div>
        ) : (
          <div className="detail-section">
            <ClaimVenueForm venue={venue} onClose={() => setShowClaimForm(false)} />
          </div>
        )}

        {/* ── ADD TO CRAWL ── */}
        <div style={{
          margin: '8px 0', padding: '14px 18px',
          background: '#F8F6F1', borderRadius: 14,
          border: '1px solid #EAE6DF',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612', marginBottom: 2 }}>
              🍺 Like this spot?
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              Add it to a bar crawl and find the best happy hour route
            </div>
          </div>
          <Link
            to={`/crawl?neighborhood=${encodeURIComponent(venue.neighborhood)}`}
            style={{
              flexShrink: 0, padding: '9px 16px', background: '#1A1612', color: '#fff',
              borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Build a crawl →
          </Link>
        </div>

        {related.length > 0 && (
          <div className="detail-section">
            <h2 className="detail-section-title">More in {venue.neighborhood}</h2>
            <div className="detail-related">
              {related.map(v => (
                <Link key={v.id} to={`/venue/${v.id}`} className="detail-related-card">
                  <div className="detail-related-name">{v.name}</div>
                  <div className="detail-related-meta">{v.neighborhood} · {v.price_tier ?? '—'}</div>
                  {isVenueActiveNow(v) && <span className="detail-related-live">Open now</span>}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
