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
import { EditVenueForm } from '../components/EditVenueForm'
import { PhotoGallery } from '../components/PhotoGallery'
import { track } from '../services/analytics'
import type { Venue, HappyHourSchedule, HappyHourStatus, ScheduleStatus } from '../types'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

// Map JS getDay() to our day abbreviations
const JS_DAY_TO_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getBestScheduleIndex(schedules: HappyHourSchedule[]): number {
  if (!schedules.length) return 0
  const todayAbbr = JS_DAY_TO_ABBR[new Date().getDay()]

  // 1. Prefer a schedule that is live right now
  for (let i = 0; i < schedules.length; i++) {
    const st = getScheduleStatus(schedules[i])
    if (st?.status === 'live_now' || st?.status === 'ends_soon') return i
  }

  // 2. Prefer a schedule that starts soon today
  for (let i = 0; i < schedules.length; i++) {
    const st = getScheduleStatus(schedules[i])
    if (st?.status === 'starts_soon' || st?.status === 'later_today') return i
  }

  // 3. Prefer a schedule that includes today
  for (let i = 0; i < schedules.length; i++) {
    if (schedules[i].days.includes(todayAbbr as any)) return i
  }

  // 4. Fall back to first schedule
  return 0
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
  const [showEditVenue, setShowEditVenue] = useState(false)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const confirmDeal = useConfirmDeal()
  const [activeScheduleIdx, setActiveScheduleIdx] = useState(0)

  function refetchVenue() {
    if (!id) return
    getVenueById(id).then(v => { if (v) setVenue(v) })
  }

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
    if (!id) return
    const cached = allVenues.find(v => v.id === id)
    if (cached) {
      setVenue(cached)
      setLoading(false)
      // Set best schedule index based on today
      setActiveScheduleIdx(getBestScheduleIndex(cached.schedules ?? []))
    }
    getVenueById(id).then(async v => {
      if (v) {
        setVenue(v)
        // Set best schedule for today
        setActiveScheduleIdx(getBestScheduleIndex(v.schedules ?? []))

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
  const curSchedule = schedules[activeScheduleIdx]

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
            <button className="detail-edit-btn" onClick={() => setShowEditVenue(v => !v)}>
              {showEditVenue ? '✕ Close editor' : '✏️ Edit venue'}
            </button>
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

        {showEditVenue && (
          <div className="detail-edit-panel">
            <EditVenueForm
              venue={venue}
              onClose={() => setShowEditVenue(false)}
              onSaved={() => { refetchVenue(); setShowEditVenue(false) }}
            />
          </div>
        )}

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
          {schedules.length > 1 && (
            <div className="detail-schedule-tabs">
              {schedules.map((s, i) => {
                const st = getScheduleStatus(s)
                return (
                  <button
                    key={s.id}
                    className={`detail-tab${activeScheduleIdx === i ? ' active' : ''}`}
                    onClick={() => setActiveScheduleIdx(i)}
                  >
                    {s.days.length === 7 ? 'All week' : s.days.slice(0,3).join(', ')}
                    {st && (st.status === 'live_now' || st.status === 'ends_soon') && (
                      <span className="tab-live-dot" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {curSchedule && (() => {
            const st = getScheduleStatus(curSchedule)
            const todayAbbr = JS_DAY_TO_ABBR[new Date().getDay()]

            // Find any OTHER schedules that also apply today (e.g. day-specific specials)
            // so we can show merged deals when a venue has both weekly + daily specials
            const todaysOtherSchedules = schedules.filter((s, i) =>
              i !== activeScheduleIdx && s.days.includes(todayAbbr as any)
            )

            // Collect all deals from today-applicable schedules
            const bonusDeals = todaysOtherSchedules.flatMap(s => s.deals)
            const bonusDealText = todaysOtherSchedules.map(s => s.deal_text).filter(Boolean).join(' · ')

            return (
              <div className="detail-schedule">
                <div className="detail-schedule-header">
                  <span className="detail-time">
                    {curSchedule.is_all_day ? 'All day' : `${fmtTime(curSchedule.start_time)} – ${fmtTime(curSchedule.end_time)}`}
                  </span>
                  {st && (
                    <span className="detail-schedule-status" style={vis ? { background: vis.bg, color: vis.text } : {}}>
                      {st.label}
                    </span>
                  )}
                </div>
                <div className="detail-days">
                  {DAYS_OF_WEEK.map(d => (
                    <span key={d} className={`detail-day${curSchedule.days.includes(d) ? ' active' : ''}`}>{d}</span>
                  ))}
                </div>
                {!curSchedule.is_all_day && (
                  <button className="detail-cal-btn" onClick={() => addToCalendar(curSchedule)}>
                    📅 Add to Google Calendar
                  </button>
                )}
                {curSchedule.deals.length > 0 ? (
                  <div className="detail-deals">
                    {curSchedule.deals.map((deal, i) => (
                      <div key={i} className="detail-deal-row" style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}>
                        <span className="detail-deal-type">{DEAL_TYPE_LABELS[deal.type]}</span>
                        <span className="detail-deal-desc">{deal.description}</span>
                        {deal.price != null && <span className="detail-deal-price">${deal.price}</span>}
                      </div>
                    ))}
                    {/* Show deals from day-specific schedules that also apply today */}
                    {bonusDeals.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#E85D1A', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 0 4px' }}>
                          Today's specials
                        </div>
                        {bonusDeals.map((deal, i) => (
                          <div key={`bonus-${i}`} className="detail-deal-row" style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}>
                            <span className="detail-deal-type">{DEAL_TYPE_LABELS[deal.type]}</span>
                            <span className="detail-deal-desc">{deal.description}</span>
                            {deal.price != null && <span className="detail-deal-price">${deal.price}</span>}
                          </div>
                        ))}
                      </>
                    )}
                    {bonusDealText && bonusDeals.length === 0 && (
                      <p className="detail-deal-text" style={{ color: '#E85D1A', fontWeight: 600 }}>Today: {bonusDealText}</p>
                    )}
                  </div>
                ) : (
                  <p className="detail-deal-text">{curSchedule.deal_text}</p>
                )}
              </div>
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
