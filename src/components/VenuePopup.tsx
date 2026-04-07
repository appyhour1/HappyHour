/**
 * VenuePopup.tsx
 *
 * Compact deal preview rendered inside a Leaflet popup.
 * Intentionally minimal — fits in ~280px width popup box.
 * "View details" scrolls the list to the card and closes map if mobile.
 */

import React from 'react'
import type { Venue } from '../types'
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS } from '../types'
import { fmtTime } from '../utils/filters'
import { getScheduleStatus } from '../utils/happeningNow'
import { STATUS_VISUALS } from '../utils/happeningNow'
import type { HappyHourStatus, ScheduleStatus } from '../utils/happeningNow'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

interface VenuePopupProps {
  venue: Venue
  onViewDetails: (venueId: string) => void
}

export function VenuePopup({ venue, onViewDetails }: VenuePopupProps) {
  const schedules = venue.schedules || []

  // Pick the most relevant schedule to show
  const bestStatus: ScheduleStatus | null = (() => {
    const statuses = schedules
      .map(s => getScheduleStatus(s))
      .filter((s): s is ScheduleStatus => s !== null)
    if (!statuses.length) return null
    return statuses.sort((a, b) =>
      STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status)
    )[0]
  })()

  const schedule = bestStatus?.schedule ?? schedules[0]
  const vis = bestStatus ? STATUS_VISUALS[bestStatus.status] : null

  // Top 2 deal items to display
  const topDeals = (schedule?.deals ?? []).slice(0, 2)

  return (
    <div className="venue-popup">
      {/* Header */}
      <div className="vp-header">
        <div className="vp-name">{venue.name}</div>
        {bestStatus && vis && (
          <span
            className="vp-status"
            style={{ background: vis.bg, color: vis.text, borderColor: vis.border }}
          >
            <span
              className={`vp-dot${vis.pulse ? ' pulse' : ''}`}
              style={{ background: vis.dot }}
            />
            {bestStatus.badge}
          </span>
        )}
      </div>

      {/* Neighborhood + price */}
      <div className="vp-meta">
        <span>{venue.neighborhood}</span>
        {venue.price_tier && <span className="vp-price">{venue.price_tier}</span>}
      </div>

      {/* Time window */}
      {schedule && !schedule.is_all_day && (
        <div className="vp-time">
          {fmtTime(schedule.start_time)} – {fmtTime(schedule.end_time)}
          {bestStatus?.minutesRemaining != null && (
            <span className="vp-time-note"> · {bestStatus.label}</span>
          )}
          {bestStatus?.minutesUntil != null && (
            <span className="vp-time-note"> · {bestStatus.label}</span>
          )}
        </div>
      )}
      {schedule?.is_all_day && <div className="vp-time">All day</div>}

      {/* Deal summary */}
      {topDeals.length > 0 ? (
        <div className="vp-deals">
          {topDeals.map((deal, i) => (
            <div
              key={i}
              className="vp-deal-item"
              style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}
            >
              <span className="vp-deal-type">{DEAL_TYPE_LABELS[deal.type]}</span>
              <span className="vp-deal-desc">{deal.description}</span>
              {deal.price != null && <span className="vp-deal-price">${deal.price}</span>}
            </div>
          ))}
          {(schedule?.deals ?? []).length > 2 && (
            <div className="vp-more-deals">+{schedule!.deals.length - 2} more deals</div>
          )}
        </div>
      ) : schedule?.deal_text ? (
        <div className="vp-deal-text">{schedule.deal_text}</div>
      ) : null}

      {/* CTA */}
      <button className="vp-details-btn" onClick={() => onViewDetails(venue.id)}>
        View full details →
      </button>
    </div>
  )
}
