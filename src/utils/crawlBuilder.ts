/**
 * crawlBuilder.ts
 *
 * Bar crawl algorithm. Given a start time, number of stops, and
 * either a neighborhood filter or a GPS radius, builds the best
 * possible crawl by finding venues where happy hour overlaps each
 * 1-hour time slot.
 *
 * ALGORITHM:
 *   1. For each stop slot (start, start+1hr, start+2hr...),
 *      find all venues where happy hour covers that hour
 *   2. Score each candidate: deal quality + upvotes + proximity to prev stop
 *   3. Pick the top unused venue for each slot
 *   4. Return ordered stop list with times, deals, and walking distance
 */

import type { Venue, DayOfWeek } from '../types'
import { JS_DAY_TO_DOW } from '../types'
import { distanceMiles, fmtDistance, getMinDealPrice } from './filters'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface CrawlStop {
  venue: Venue
  arrivalTime: string        // "4:00 PM"
  arrivalHour: number        // 16
  activeDeals: string        // best deal text for this time slot
  distanceFromPrev: string | null  // "0.3 mi" or null for first stop
  distanceMilesFromPrev: number | null
}

export interface CrawlPlan {
  stops: CrawlStop[]
  totalVenues: number
  startTime: string
  neighborhood: string | null
  radiusMiles: number | null
  shareUrl: string
}

export interface CrawlParams {
  startHour: number           // 0-23
  numStops: number            // 2-6
  neighborhood: string | null // filter by neighborhood
  radiusMiles: number | null  // filter by distance from userLocation
  userLocation: { lat: number; lng: number } | null
  dayOfWeek?: DayOfWeek       // defaults to today
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatHour(hour: number): string {
  const h24 = hour % 24
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12  = h24 % 12 || 12
  return `${h12}:00 ${ampm}`
}

/** "16:00" → 16 */
function timeToHour(t: string): number {
  return parseInt(t.split(':')[0], 10)
}

/**
 * True if a schedule covers the given hour slot.
 * A schedule covers hour H if start <= H < end.
 * End "00:00" is treated as 24 (midnight).
 */
function scheduleCoversHour(schedule: {
  start_time: string
  end_time: string
  is_all_day: boolean
  days: string[]
}, hour: number, day: DayOfWeek): boolean {
  if (!schedule.days.includes(day)) return false
  if (schedule.is_all_day) return true

  const start = timeToHour(schedule.start_time)
  let end     = timeToHour(schedule.end_time)
  if (end === 0) end = 24  // midnight close

  return hour >= start && hour < end
}

/** Get the best deal text for a venue at a specific hour */
function getBestDealForHour(venue: Venue, hour: number, day: DayOfWeek): string {
  const activeSchedule = (venue.schedules ?? []).find(s =>
    scheduleCoversHour(s, hour, day)
  )
  if (!activeSchedule) return ''
  if (activeSchedule.deals.length > 0) {
    return activeSchedule.deals
      .slice(0, 2)
      .map(d => d.price != null ? `${d.description} ($${d.price})` : d.description)
      .join(', ')
  }
  return activeSchedule.deal_text || 'Happy hour deals'
}

/** Score a venue for a given stop slot */
function scoreVenueForSlot(
  venue: Venue,
  prevStop: CrawlStop | null,
  userLocation: { lat: number; lng: number } | null
): number {
  let score = 0

  // Upvotes — popularity signal
  score += Math.min(20, Math.log1p(venue.upvote_count) * 5)

  // Featured bonus
  if (venue.is_featured) score += 15

  // Cheap deals rank higher
  const minPrice = getMinDealPrice(venue)
  if (minPrice !== null) score += Math.max(0, 15 - minPrice)

  // Verified venues rank higher
  if (venue.verification_status === 'verified' || venue.verification_status === 'claimed') {
    score += 10
  }

  // Proximity to previous stop (keep the crawl walkable)
  if (prevStop && venue.latitude && venue.longitude &&
      prevStop.venue.latitude && prevStop.venue.longitude) {
    const miles = distanceMiles(
      prevStop.venue.latitude, prevStop.venue.longitude,
      venue.latitude, venue.longitude
    )
    // Within 0.3mi = full 25pts, 1mi = 0pts
    score += Math.max(0, 25 - miles * 25)
  } else if (!prevStop && userLocation && venue.latitude && venue.longitude) {
    // First stop — prefer closest to user
    const miles = distanceMiles(
      userLocation.lat, userLocation.lng,
      venue.latitude, venue.longitude
    )
    score += Math.max(0, 20 - miles * 10)
  }

  return score
}

// ─────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────

export function buildCrawl(venues: Venue[], params: CrawlParams): CrawlPlan {
  const day: DayOfWeek = params.dayOfWeek ?? JS_DAY_TO_DOW[new Date().getDay()]
  const usedIds = new Set<string>()
  const stops: CrawlStop[] = []

  // Filter venues by area
  let candidates = venues.filter(v => (v.schedules ?? []).length > 0)

  if (params.neighborhood) {
    candidates = candidates.filter(v =>
      v.neighborhood.toLowerCase() === params.neighborhood!.toLowerCase()
    )
  } else if (params.radiusMiles && params.userLocation) {
    candidates = candidates.filter(v => {
      if (!v.latitude || !v.longitude) return true // include if no coords
      const miles = distanceMiles(
        params.userLocation!.lat, params.userLocation!.lng,
        v.latitude, v.longitude
      )
      return miles <= params.radiusMiles!
    })
  }

  for (let i = 0; i < params.numStops; i++) {
    const slotHour = (params.startHour + i) % 24
    const prevStop = stops[stops.length - 1] ?? null

    // Find venues active during this slot
    const available = candidates.filter(v =>
      !usedIds.has(v.id) &&
      (v.schedules ?? []).some(s => scheduleCoversHour(s, slotHour, day))
    )

    if (available.length === 0) {
      // No happy hour at this hour — try to find any venue in the area
      const fallback = candidates.filter(v => !usedIds.has(v.id))[0]
      if (!fallback) break
      // Still add it as a "no happy hour" stop
      const distFromPrev = prevStop && fallback.latitude && fallback.longitude &&
        prevStop.venue.latitude && prevStop.venue.longitude
        ? distanceMiles(prevStop.venue.latitude, prevStop.venue.longitude, fallback.latitude, fallback.longitude)
        : null

      stops.push({
        venue: fallback,
        arrivalTime: formatHour(slotHour),
        arrivalHour: slotHour,
        activeDeals: 'Check with bar for current specials',
        distanceFromPrev: distFromPrev != null ? fmtDistance(distFromPrev) : null,
        distanceMilesFromPrev: distFromPrev,
      })
      usedIds.add(fallback.id)
      continue
    }

    // Score and pick the best
    const scored = available
      .map(v => ({ venue: v, score: scoreVenueForSlot(v, prevStop, params.userLocation) }))
      .sort((a, b) => b.score - a.score)

    const best = scored[0].venue
    const dealText = getBestDealForHour(best, slotHour, day)

    const distFromPrev = prevStop && best.latitude && best.longitude &&
      prevStop.venue.latitude && prevStop.venue.longitude
      ? distanceMiles(
          prevStop.venue.latitude, prevStop.venue.longitude,
          best.latitude, best.longitude
        )
      : null

    stops.push({
      venue: best,
      arrivalTime: formatHour(slotHour),
      arrivalHour: slotHour,
      activeDeals: dealText,
      distanceFromPrev: distFromPrev != null ? fmtDistance(distFromPrev) : null,
      distanceMilesFromPrev: distFromPrev,
    })
    usedIds.add(best.id)
  }

  // Build share URL
  const shareParams = new URLSearchParams()
  shareParams.set('start', String(params.startHour))
  shareParams.set('stops', String(params.numStops))
  if (params.neighborhood) shareParams.set('hood', params.neighborhood)
  if (params.radiusMiles) shareParams.set('radius', String(params.radiusMiles))
  stops.forEach(s => shareParams.append('v', s.venue.id))
  const shareUrl = `${window.location.origin}/crawl?${shareParams.toString()}`

  return {
    stops,
    totalVenues: candidates.length,
    startTime: formatHour(params.startHour),
    neighborhood: params.neighborhood,
    radiusMiles: params.radiusMiles,
    shareUrl,
  }
}

// ─────────────────────────────────────────────
// PARSE SHARED CRAWL FROM URL
// ─────────────────────────────────────────────

export function parseCrawlFromUrl(
  params: URLSearchParams,
  venues: Venue[]
): CrawlPlan | null {
  const venueIds  = params.getAll('v')
  const startHour = parseInt(params.get('start') ?? '16', 10)
  const numStops  = parseInt(params.get('stops') ?? '3', 10)
  const hood      = params.get('hood')
  const radius    = params.get('radius') ? parseFloat(params.get('radius')!) : null

  if (venueIds.length === 0) return null

  const day: DayOfWeek = JS_DAY_TO_DOW[new Date().getDay()]
  const stops: CrawlStop[] = venueIds
    .map((id, i) => {
      const venue = venues.find(v => v.id === id)
      if (!venue) return null
      const slotHour = (startHour + i) % 24
      return {
        venue,
        arrivalTime: formatHour(slotHour),
        arrivalHour: slotHour,
        activeDeals: getBestDealForHour(venue, slotHour, day),
        distanceFromPrev: null,
        distanceMilesFromPrev: null,
      }
    })
    .filter((s): s is CrawlStop => s !== null)

  return {
    stops,
    totalVenues: venueIds.length,
    startTime: formatHour(startHour),
    neighborhood: hood,
    radiusMiles: radius,
    shareUrl: `${window.location.origin}/crawl?${params.toString()}`,
  }
}
