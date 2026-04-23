import React, { memo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Venue } from '../types'
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS } from '../types'
import { fmtTime, isVenueActiveNow } from '../utils/filters'
import { getScheduleStatus, STATUS_VISUALS } from '../utils/happeningNow'
import type { HappyHourStatus, ScheduleStatus } from '../utils/happeningNow'
import { Analytics, track } from '../services/analytics'
import { supabase } from '../lib/supabase'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

// Session-level dedup — each venue fires once per page load
const seen = new Set<string>()

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 15.5S2 11.1 2 6.5C2 4.6 3.6 3 5.5 3c1.2 0 2.3.6 3 1.5C9.2 3.6 10.3 3 11.5 3 13.4 3 15 4.6 15 6.5c0 4.6-6 9-6 9z"
        fill={filled ? '#E24B4A' : 'none'} stroke={filled ? '#E24B4A' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="4.3" y1="7.2" x2="10.7" y2="3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4.3" y1="8.8" x2="10.7" y2="12.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

interface VenueCardProps {
  venue: Venue
  isFavorite: boolean
  onToggleFavorite: (venueId: string, venueName: string) => void
  isSelected?: boolean
  distanceLabel?: string
  cardRef?: (el: HTMLDivElement | null) => void
}

export const VenueCard = memo(function VenueCard({
  venue, isFavorite, onToggleFavorite,
  isSelected = false, distanceLabel, cardRef,
}: VenueCardProps) {
  const navigate = useNavigate()
  const isOpen = isVenueActiveNow(venue)
  const schedules = venue.schedules || []
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Stable ref callback — works with both impression tracking and external cardRef
  const setRef = useCallback((el: HTMLDivElement | null) => {
    // Forward to external ref if provided
    if (cardRef) cardRef(el)

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!el || seen.has(venue.id)) return

    // Set up intersection observer for scroll impression tracking
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Card is 50% visible — start 1 second timer
          timerRef.current = setTimeout(async () => {
            if (seen.has(venue.id)) return
            seen.add(venue.id)

            try {
              // PostHog event
              track('venue_card_impression', {
                venue_id: venue.id,
                venue_name: venue.name,
                is_featured: venue.is_featured ?? false,
                is_sponsored: (venue as any).is_sponsored ?? false,
              })

              // Weekly stats counter
              await supabase.rpc('increment_venue_stat', {
                p_venue_id: venue.id,
                p_stat: 'card_views',
              })

              // Timestamped event for daily/monthly/all-time queries
              await supabase.from('venue_impressions').insert({
                venue_id: venue.id,
                event_type: 'card_view',
              })
            } catch {
              // Never break the UI
            }
          }, 1000)
        } else {
          // Card left viewport — cancel timer
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        }
      },
      { threshold: 0.5 }
    )

    observerRef.current.observe(el)
  }, [venue.id, venue.name, venue.is_featured, cardRef]) // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const venueStatus: ScheduleStatus | null = (() => {
    const statuses = schedules.map(s => getScheduleStatus(s)).filter((s): s is ScheduleStatus => s !== null)
    if (!statuses.length) return null
    return statuses.sort((a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status))[0]
  })()

  const bestSchedule = venueStatus?.schedule ?? schedules[0]
  const DEAL_ORDER = ['beer', 'cocktail', 'food', 'wine', 'general']
  const topDeals = [...(bestSchedule?.deals ?? [])]
    .sort((a, b) => DEAL_ORDER.indexOf(a.type) - DEAL_ORDER.indexOf(b.type))
    .slice(0, 4)
  const vis = venueStatus ? STATUS_VISUALS[venueStatus.status] : null

  const daysSinceVerified = venue.last_verified_at
    ? Math.floor((Date.now() - new Date(venue.last_verified_at).getTime()) / 86_400_000)
    : null
  const showExpiryWarning = daysSinceVerified !== null && daysSinceVerified > 30

  function handleCardClick() {
    Analytics.venueCardClicked(venue.id, venue.name, isOpen)
    navigate(`/venue/${venue.id}`)
  }

  function handleFavorite(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleFavorite(venue.id, venue.name)
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${window.location.origin}/venue/${venue.id}`
    if (navigator.share) {
      navigator.share({ title: venue.name, text: `Check out happy hour at ${venue.name} 🍺`, url })
    } else {
      navigator.clipboard.writeText(url)
    }
    track('venue_shared', { venue_id: venue.id, venue_name: venue.name })
  }

  return (
    <div
      ref={setRef}
      className={`vc${isOpen ? ' vc--open' : ''}${isSelected ? ' vc--selected' : ''}${venue.is_featured ? ' vc--featured' : ''}`}
      style={{
        background: '#F8F6F1',
        border: isOpen
          ? '2px solid #22C55E'
          : venue.is_featured
            ? '2px solid #E85D1A'
            : '2px solid #1A1612',
        boxShadow: isOpen ? '0 0 0 1px #22C55E' : 'none',
      }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleCardClick()}
      aria-label={`${venue.name} — ${venueStatus?.badge ?? 'See details'}`}
    >
      <div className="vc__top">
        <div className="vc__badges-left">
          {venueStatus && vis && (
            <span className="vc__badge vc__badge--status" style={{ background: vis.bg, color: vis.text, borderColor: vis.border }}>
              <span className={`vc__status-dot${vis.pulse ? ' vc__status-dot--pulse' : ''}`} style={{ background: vis.dot }} />
              {venueStatus.badge}
            </span>
          )}
          {(venue as any).is_sponsored && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#6D28D9', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 20, letterSpacing: '.05em', textTransform: 'uppercase' as const }}>◆ Sponsored</span>
          )}
          {venue.is_featured && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#E85D1A', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 20, letterSpacing: '.05em', textTransform: 'uppercase' as const }}>⭐ Featured</span>
          )}
        </div>
        <button className={`vc__heart${isFavorite ? ' vc__heart--saved' : ''}`} onClick={handleFavorite} aria-label="Save">
          <HeartIcon filled={isFavorite} />
        </button>
      </div>

      <div className="vc__name">{venue.name}</div>
      <div className="vc__meta">
        <span className="vc__neighborhood">{venue.neighborhood}</span>
        {venue.price_tier && <span className="vc__price">{venue.price_tier}</span>}
        {distanceLabel && <span className="vc__distance">· {distanceLabel}</span>}
        {venue.dog_friendly && <span className="vc__dog-friendly" title="Dog friendly">🐾</span>}
        {(venue.verification_status === 'verified' || venue.verification_status === 'claimed') && (
          <span className="vc__verified">✓</span>
        )}
      </div>

      {bestSchedule && (
        <div className="vc__time">
          {bestSchedule.is_all_day ? 'All day' : `${fmtTime(bestSchedule.start_time)} – ${fmtTime(bestSchedule.end_time)}`}
          {venueStatus?.minutesRemaining != null && venueStatus.minutesRemaining <= 60 && (
            <span className="vc__time-note"> · ends in {venueStatus.minutesRemaining}m</span>
          )}
          {venueStatus?.minutesUntil != null && venueStatus.minutesUntil <= 60 && (
            <span className="vc__time-note"> · starts in {venueStatus.minutesUntil}m</span>
          )}
        </div>
      )}

      {topDeals.length > 0 ? (
        <div className="vc__deals">
          {topDeals.map((deal, i) => (
            <span key={i} className="vc__deal-pill"
              style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}>
              <span className="vc__pill-type">{DEAL_TYPE_LABELS[deal.type]}</span>
              {deal.price != null
                ? <span className="vc__pill-price">${deal.price}</span>
                : <span className="vc__pill-desc">{deal.description.length > 22 ? deal.description.slice(0, 22) + '…' : deal.description}</span>
              }
            </span>
          ))}
          {(bestSchedule?.deals ?? []).length > 4 && (
            <span className="vc__more-deals">+{bestSchedule!.deals.length - 4} more</span>
          )}
        </div>
      ) : bestSchedule?.deal_text ? (
        <div className="vc__deal-text">{bestSchedule.deal_text}</div>
      ) : null}

      {showExpiryWarning && (
        <div className="vc__expiry-warning">
          ⚠️ Last confirmed {daysSinceVerified}d ago — verify before heading out
        </div>
      )}

      <div className="vc__footer">
        <span className="vc__cta">View deals →</span>
        <button className="vc__share" onClick={handleShare} aria-label="Share" title="Share">
          <ShareIcon />
        </button>
      </div>
    </div>
  )
})
