/**
 * VenueCard.tsx
 *
 * Premium venue card. Designed to help a user decide in under 2 seconds.
 *
 * VISUAL HIERARCHY (top to bottom):
 *   1. Status badge + featured badge   (am I going right now?)
 *   2. Venue name + neighborhood       (where is it?)
 *   3. Time range                      (when is it?)
 *   4. Top 3 deal pills                (what do I get?)
 *   5. Category tags                   (what kind of place?)
 *   6. Footer: favorite + CTA          (what do I do?)
 *
 * INTERACTIONS:
 *   - Tap card body → navigate to detail page
 *   - Tap heart → toggle favorite (no navigation)
 *   - Swipe (future) → dismiss or save
 */

import React, { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Venue } from '../types'
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS, CATEGORY_LABELS } from '../types'
import { fmtTime, isVenueActiveNow } from '../utils/filters'
import { getScheduleStatus, getVenueStatus, STATUS_VISUALS } from '../utils/happeningNow'
import type { HappyHourStatus, ScheduleStatus } from '../utils/happeningNow'
import { Analytics, track } from '../services/analytics'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

// ─────────────────────────────────────────────
// HEART ICON
// ─────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 15.5S2 11.1 2 6.5C2 4.6 3.6 3 5.5 3c1.2 0 2.3.6 3 1.5C9.2 3.6 10.3 3 11.5 3 13.4 3 15 4.6 15 6.5c0 4.6-6 9-6 9z"
        fill={filled ? '#E24B4A' : 'none'}
        stroke={filled ? '#E24B4A' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────
// SHARE ICON
// ─────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="4.3" y1="7.2" x2="10.7" y2="3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4.3" y1="8.8" x2="10.7" y2="12.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─────────────────────────────────────────────
// VENUE CARD
// ─────────────────────────────────────────────

interface VenueCardProps {
  venue: Venue
  isFavorite: boolean
  onToggleFavorite: (venueId: string, venueName: string) => void
  isSelected?: boolean
  distanceLabel?: string
  cardRef?: (el: HTMLDivElement | null) => void
}

export const VenueCard = memo(function VenueCard({
  venue,
  isFavorite,
  onToggleFavorite,
  isSelected = false,
  distanceLabel,
  cardRef,
}: VenueCardProps) {
  const navigate = useNavigate()
  const isOpen = isVenueActiveNow(venue)
  const schedules = venue.schedules || []

  // Best status across all schedules
  const venueStatus: ScheduleStatus | null = (() => {
    const statuses = schedules
      .map(s => getScheduleStatus(s))
      .filter((s): s is ScheduleStatus => s !== null)
    if (!statuses.length) return null
    return statuses.sort((a, b) =>
      STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status)
    )[0]
  })()

  // Best schedule to show deals from
  const bestSchedule = venueStatus?.schedule ?? schedules[0]
  const topDeals = (bestSchedule?.deals ?? []).slice(0, 3)
  const vis = venueStatus ? STATUS_VISUALS[venueStatus.status] : null

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
    const text = `Check out happy hour at ${venue.name} 🍺`
    if (navigator.share) {
      navigator.share({ title: venue.name, text, url })
    } else {
      navigator.clipboard.writeText(url)
    }
    track('venue_shared', { venue_id: venue.id, venue_name: venue.name })
  }

  return (
    <div
      ref={cardRef}
      className={`vc${isOpen ? ' vc--open' : ''}${isSelected ? ' vc--selected' : ''}${venue.is_featured ? ' vc--featured' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleCardClick()}
      aria-label={`${venue.name} — ${venueStatus?.badge ?? 'See details'}`}
    >
      {/* ── TOP ROW: Badges ── */}
      <div className="vc__badges">
        <div className="vc__badges-left">
          {venue.is_featured && (
            <span className="vc__badge vc__badge--featured">⭐ Featured</span>
          )}
          {venueStatus && vis && (
            <span
              className="vc__badge vc__badge--status"
              style={{ background: vis.bg, color: vis.text, borderColor: vis.border }}
            >
              <span
                className={`vc__status-dot${vis.pulse ? ' vc__status-dot--pulse' : ''}`}
                style={{ background: vis.dot }}
              />
              {venueStatus.badge}
            </span>
          )}
        </div>
        <button
          className={`vc__heart${isFavorite ? ' vc__heart--saved' : ''}`}
          onClick={handleFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
        >
          <HeartIcon filled={isFavorite} />
        </button>
      </div>

      {/* ── VENUE NAME + META ── */}
      <div className="vc__name">{venue.name}</div>
      <div className="vc__meta">
        <span className="vc__neighborhood">{venue.neighborhood}</span>
        {venue.price_tier && <span className="vc__price">{venue.price_tier}</span>}
        {distanceLabel && <span className="vc__distance">📍 {distanceLabel}</span>}
        {(venue.verification_status === 'verified' || venue.verification_status === 'claimed') && (
          <span className="vc__verified">✓ Verified</span>
        )}
      </div>

      {/* ── TIME RANGE ── */}
      {bestSchedule && (
        <div className="vc__time">
          {bestSchedule.is_all_day
            ? 'All day'
            : `${fmtTime(bestSchedule.start_time)} – ${fmtTime(bestSchedule.end_time)}`
          }
          {venueStatus?.minutesRemaining != null && venueStatus.minutesRemaining <= 60 && (
            <span className="vc__time-note"> · ends in {venueStatus.minutesRemaining}m</span>
          )}
          {venueStatus?.minutesUntil != null && venueStatus.minutesUntil <= 60 && (
            <span className="vc__time-note"> · starts in {venueStatus.minutesUntil}m</span>
          )}
        </div>
      )}

      {/* ── DEAL PILLS ── */}
      {topDeals.length > 0 ? (
        <div className="vc__deals">
          {topDeals.map((deal, i) => (
            <div
              key={i}
              className="vc__deal"
              style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}
            >
              <span className="vc__deal-type">{DEAL_TYPE_LABELS[deal.type]}</span>
              <span className="vc__deal-desc">{deal.description}</span>
              {deal.price != null && <span className="vc__deal-price">${deal.price}</span>}
            </div>
          ))}
          {(bestSchedule?.deals ?? []).length > 3 && (
            <span className="vc__more-deals">+{bestSchedule!.deals.length - 3} more</span>
          )}
        </div>
      ) : bestSchedule?.deal_text ? (
        <div className="vc__deal-text">{bestSchedule.deal_text}</div>
      ) : null}

      {/* ── CATEGORY TAGS ── */}
      {venue.categories.length > 0 && (
        <div className="vc__tags">
          {venue.categories.slice(0, 3).map(cat => (
            <span key={cat} className="vc__tag">{CATEGORY_LABELS[cat]}</span>
          ))}
        </div>
      )}

      {/* ── FOOTER: CTA ── */}
      <div className="vc__footer">
        <span className="vc__cta">View deals →</span>
        <button
          className="vc__share"
          onClick={handleShare}
          aria-label="Share this venue"
          title="Share"
        >
          <ShareIcon />
        </button>
      </div>
    </div>
  )
})
