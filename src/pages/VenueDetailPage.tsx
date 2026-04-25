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
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS, CATEGORY_LABELS, DAYS_OF_WEEK } from '../types'
import { Analytics } from '../services/analytics'
import { SuggestEditForm } from '../components/ContributionForms'
import { ClaimVenueForm } from '../components/ClaimVenueForm'
import { useConfirmDeal } from '../hooks/useConfirmDeal'
import { PhotoGallery } from '../components/PhotoGallery'
import { track } from '../services/analytics'
import type { Venue, HappyHourSchedule, HappyHourStatus, ScheduleStatus } from '../types'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

// Map JS getDay() to our day abbreviations
const JS_DAY_TO_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Canonical deal type display order — consistent with VenueCard
const DEAL_TYPE_ORDER = ['beer', 'cocktail', 'wine', 'food', 'general']

function getBestDay(schedules: HappyHourSchedule[]): string {
  if (!schedules.length) return JS_DAY_TO_ABBR[new Date().getDay()]
  const todayAbbr = JS_DAY_TO_ABBR[new Date().getDay()]

  // Get all days this venue has deals
  const allDays = Array.from(new Set(schedules.flatMap(s => s.days)))

  // Prefer today if venue is open today
  if (allDays.includes(todayAbbr as any)) return todayAbbr

  // Otherwise find next upcoming day
  const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const todayIdx = dayOrder.indexOf(todayAbbr)
  for (let i = 1; i <= 7; i++) {
    const next = dayOrder[(todayIdx + i) % 7]
    if (allDays.includes(next as any)) return next
  }

  return allDays[0] || todayAbbr
}

function getDealsForDay(schedules: HappyHourSchedule[], day: string) {
  // Get all schedules that apply to this day
  const matching = schedules.filter(s => s.days.includes(day as any))
  if (!matching.length) return { deals: [], dealText: '', time: '', schedule: null }

  // Use the schedule with the most deals as the "primary" for time display
  const primary = matching.reduce((a, b) => b.deals.length > a.deals.length ? b : a)

  // Merge all deals from all matching schedules, deduplicating by description
  const allDeals: typeof primary.deals = []
  matching.forEach(s => {
    s.deals.forEach(deal => {
      const alreadyShown = allDeals.some(d =>
        d.description.toLowerCase().trim() === deal.description.toLowerCase().trim()
      )
      if (!alreadyShown) allDeals.push(deal)
    })
  })

  // Sort deals:
  // 1. By type in canonical order (beer → cocktail → wine → food → general)
  // 2. Within each type: price ascending (priced deals first, cheapest first)
  // 3. Final tiebreaker: description alphabetically
  const sortedDeals = [...allDeals].sort((a, b) => {
    const aTypeIdx = DEAL_TYPE_ORDER.indexOf(a.type) ?? 99
    const bTypeIdx = DEAL_TYPE_ORDER.indexOf(b.type) ?? 99
    if (aTypeIdx !== bTypeIdx) return aTypeIdx - bTypeIdx

    // Same type — priced deals before unpriced
    const aHasPrice = a.price != null
    const bHasPrice = b.price != null
    if (aHasPrice && !bHasPrice) return -1
    if (!aHasPrice && bHasPrice) return 1

    // Both priced — cheapest first
    if (aHasPrice && bHasPrice) {
      if (a.price !== b.price) return (a.price ?? 0) - (b.price ?? 0)
    }

    // Alphabetical by description
    return a.description.toLowerCase().localeCompare(b.description.toLowerCase())
  })

  const dealText = matching.map(s => s.deal_text).filter(Boolean).join(' · ')
  const time = primary.is_all_day ? 'All day' : `${fmtTime(primary.start_time)} – ${fmtTime(primary.end_time)}`

  return { deals: sortedDeals, dealText, time, schedule: primary }
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
  const { favorites, venues: allVenues, userLocation } = useAppContext()
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
      alert('Link copied!')
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
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}&recur=RRULE:FREQ=WEEKLY`
    window.open(url, '_blank')
    track('add_to_calendar', { venue_id: venue?.id, venue_name: venue?.name })
  }

  function openDirections() {
    if (!venue) return
    const q = venue.address
      ? encodeURIComponent(venue.address)
      : `${encodeURIComponent(venue.name + ' ' + venue.city)}`
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank')
    Analytics.getDirectionsClicked(venue.id, venue.name)
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

        // Track page view via PostHog
        Analytics.venueDetailViewed(v.id, v.name)

        // Log to venue_impressions (works with anon key, no RPC needed)
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
          <button className="detail-back-btn" onClick={() => navigate(-1)}>← Back</button>
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
        {venue.latitude && venue.longitude && (
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

        {(venue.address || venue.website || venue.phone) && (
          <div className="detail-section">
            <h2 className="detail-section-title">Info</h2>
            <div className="detail-info-grid">
              {venue.address && (
                <div className="detail-info-row">
                  <span className="detail-info-label">Address</span>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}
                    target="_blank" rel="noopener noreferrer" className="detail-info-link"
                    onClick={() => Analytics.getDirectionsClicked(venue.id, venue.name)}>
                    {venue.address} ↗
                  </a>
                </div>
              )}
              {venue.website && (
                <div className="detail-info-row">
                  <span className="detail-info-label">Website</span>
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" className="detail-info-link"
                    onClick={() => Analytics.outboundWebsiteClicked(venue.id, venue.website!)}>
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
            const { deals, dealText, time, schedule } = getDealsForDay(schedules, selectedDay)
            const isToday = selectedDay === todayAbbr
            const st = schedule ? getScheduleStatus(schedule) : null

            return (
              <>
                {venueDays.length > 1 && (
                  <div className="detail-schedule-tabs">
                    {venueDays.map(d => (
                      <button
                        key={d}
                        className={`detail-tab${selectedDay === d ? ' active' : ''}`}
                        onClick={() => setActiveDay(d)}
                      >
                        {d}
                        {d === todayAbbr && isToday && st && (st.status === 'live_now' || st.status === 'ends_soon') && (
                          <span className="tab-live-dot" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="detail-schedule">
                  <div className="detail-schedule-header" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="detail-time">{time}</span>
                    {isToday && st && (
                      <span className="detail-schedule-status" style={vis ? { background: vis.bg, color: vis.text } : {}}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  {schedule && !schedule.is_all_day && (
                    <button className="detail-cal-btn" onClick={() => addToCalendar(schedule!)}>
                      📅 Add to Google Calendar
                    </button>
                  )}
                  {deals.length > 0 ? (
                    <div className="detail-deals">
                      {deals.map((deal, i) => (
                        <div key={i} className="detail-deal-row" style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}>
                          <span className="detail-deal-type">{DEAL_TYPE_LABELS[deal.type]}</span>
                          <span className="detail-deal-desc">{deal.description}</span>
                          {deal.price != null && <span className="detail-deal-price">${deal.price}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-deal-text">{dealText}</p>
                  )}
                </div>
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
