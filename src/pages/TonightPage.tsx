/**
 * TonightPage.tsx
 * Route: /tonight
 *
 * Shows everything happening TODAY grouped by time slot.
 * The answer to "what's good tonight?" at 2pm on a Friday.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAppContext } from '../contexts/AppContext'
import { isVenueActiveNow, fmtTime } from '../utils/filters'
import { getVenueStatus, STATUS_VISUALS } from '../utils/happeningNow'
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS } from '../types'
import { Analytics } from '../services/analytics'
import type { Venue, HappyHourSchedule } from '../types'
import { JS_DAY_TO_DOW } from '../types'

const DEAL_ORDER = ['beer', 'cocktail', 'food', 'wine', 'general']

interface TimeSlot {
  label: string
  startMins: number
  venues: Array<{ venue: Venue; schedule: HappyHourSchedule }>
}

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function groupByTimeSlot(venues: Venue[]): TimeSlot[] {
  const today = JS_DAY_TO_DOW[new Date().getDay()]
  const now = new Date().getHours() * 60 + new Date().getMinutes()

  // Collect all venue+schedule pairs for today
  const pairs: Array<{ venue: Venue; schedule: HappyHourSchedule; startMins: number }> = []
  venues.forEach(venue => {
    (venue.schedules ?? []).forEach(s => {
      if (!s.days.includes(today)) return
      pairs.push({ venue, schedule: s, startMins: s.is_all_day ? 0 : toMins(s.start_time) })
    })
  })

  // Sort by start time
  pairs.sort((a, b) => a.startMins - b.startMins)

  // Group into slots
  const slotMap = new Map<string, TimeSlot>()
  pairs.forEach(({ venue, schedule, startMins }) => {
    const timeKey = schedule.is_all_day ? 'All day' : fmtTime(schedule.start_time)
    if (!slotMap.has(timeKey)) {
      slotMap.set(timeKey, { label: timeKey, startMins, venues: [] })
    }
    slotMap.get(timeKey)!.venues.push({ venue, schedule })
  })

  return Array.from(slotMap.values())
}

function VenueTonightCard({ venue, schedule }: { venue: Venue; schedule: HappyHourSchedule }) {
  const status = getVenueStatus(venue)
  const vis = STATUS_VISUALS[status.status]
  const isOpen = isVenueActiveNow(venue)
  const sortedDeals = [...(schedule.deals ?? [])].sort((a, b) =>
    DEAL_ORDER.indexOf(a.type) - DEAL_ORDER.indexOf(b.type)
  ).slice(0, 3)

  function handleCalendar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!schedule.start_time || !schedule.end_time) return

    const today = new Date()
    const [sh, sm] = schedule.start_time.split(':').map(Number)
    const [eh, em] = schedule.end_time.split(':').map(Number)
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sh, sm)
    const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), eh, em)

    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const title = encodeURIComponent(`Happy Hour at ${venue.name}`)
    const details = encodeURIComponent(schedule.deal_text || 'Happy hour deals')
    const location = encodeURIComponent(venue.address || venue.neighborhood)
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`
    window.open(url, '_blank')
  }

  return (
    <Link to={`/venue/${venue.id}`} className="tonight-card">
      <div className="tonight-card-left">
        {isOpen && <div className="tonight-live-stripe" />}
      </div>
      <div className="tonight-card-body">
        <div className="tonight-card-top">
          <div className="tonight-card-name">{venue.name}</div>
          <span
            className="tonight-card-badge"
            style={{ background: vis.bg, color: vis.text }}
          >
            <span className="tonight-badge-dot" style={{ background: vis.dot }} />
            {status.badge || 'Later today'}
          </span>
        </div>
        <div className="tonight-card-meta">
          {venue.neighborhood}
          {venue.price_tier && <span> · {venue.price_tier}</span>}
          {venue.dog_friendly && <span> · 🐾</span>}
        </div>
        <div className="tonight-card-time">
          {schedule.is_all_day ? 'All day' : `${fmtTime(schedule.start_time)} – ${fmtTime(schedule.end_time)}`}
        </div>
        <div className="tonight-pills">
          {sortedDeals.map((deal, i) => (
            <span
              key={i}
              className="tonight-pill"
              style={{ background: DEAL_TYPE_COLORS[deal.type].bg, color: DEAL_TYPE_COLORS[deal.type].text }}
            >
              <span className="tonight-pill-type">{DEAL_TYPE_LABELS[deal.type]}</span>
              {deal.price != null
                ? <span className="tonight-pill-price">${deal.price}</span>
                : <span className="tonight-pill-desc">
                    {deal.description.length > 20 ? deal.description.slice(0, 20) + '…' : deal.description}
                  </span>
              }
            </span>
          ))}
        </div>
        <button
          className="tonight-cal-btn"
          onClick={handleCalendar}
          title="Add to calendar"
        >
          📅 Add to calendar
        </button>
      </div>
    </Link>
  )
}

export default function TonightPage() {
  const { venues, loading, city } = useAppContext()
  const [, setTick] = useState(0)

  useEffect(() => {
    Analytics.seoPageViewed('tonight', city)
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [city])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const slots = groupByTimeSlot(venues)
  const totalVenues = new Set(slots.flatMap(s => s.venues.map(v => v.venue.id))).size
  const liveCount = venues.filter(v => isVenueActiveNow(v)).length

  return (
    <>
      <Helmet>
        <title>Happy Hour Tonight in {city} — What's On Today</title>
        <meta name="description" content={`Everything happening tonight for happy hour in ${city}. Sorted by start time so you can plan your evening.`} />
      </Helmet>

      <div className="tonight-page">

        {/* ── HERO ── */}
        <div className="tonight-hero">
          <div className="tonight-hero-date">{today}</div>
          <h1 className="tonight-hero-title">Tonight in {city}</h1>
          <p className="tonight-hero-sub">
            {totalVenues > 0
              ? `${totalVenues} venues · ${liveCount > 0 ? `${liveCount} open right now` : 'sorted by start time'}`
              : 'No happy hours scheduled today'
            }
          </p>
          <div className="tonight-hero-actions">
            <Link to="/now" className="tonight-hero-live-btn">
              <span className="tonight-hero-dot" />
              {liveCount} live right now
            </Link>
            <Link to="/crawl" className="tonight-hero-crawl-btn">🍺 Build a crawl</Link>
          </div>
        </div>

        {loading && <p className="loading-msg">Loading...</p>}

        {!loading && slots.length === 0 && (
          <div className="hn-empty">
            <div className="hn-empty-icon">🌙</div>
            <div className="hn-empty-title">Nothing scheduled today</div>
            <div className="hn-empty-sub">Check back on a weekday — happy hours typically run Mon–Fri.</div>
            <Link to="/" className="hn-empty-btn">Browse all venues</Link>
          </div>
        )}

        {/* ── TIME SLOTS ── */}
        {!loading && slots.map(slot => (
          <div key={slot.label} className="tonight-slot">
            <div className="tonight-slot-header">
              <span className="tonight-slot-time">{slot.label}</span>
              <span className="tonight-slot-count">{slot.venues.length} {slot.venues.length === 1 ? 'venue' : 'venues'}</span>
            </div>
            {slot.venues.map(({ venue, schedule }) => (
              <VenueTonightCard key={`${venue.id}-${schedule.id}`} venue={venue} schedule={schedule} />
            ))}
          </div>
        ))}

      </div>
    </>
  )
}
