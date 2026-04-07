import type {
  Venue, HappyHourSchedule, FilterState, DayOfWeek, DealType,
  VenueCategory, PriceTier, UserLocation
} from '../types'
import { JS_DAY_TO_DOW } from '../types'
import { getScheduleStatus, REAL_CLOCK, type Clock } from './happeningNow'

// ─────────────────────────────────────────────
// TIME UTILITIES
// ─────────────────────────────────────────────

/** Get current day of week as DayOfWeek */
export function getTodayDOW(): DayOfWeek {
  return JS_DAY_TO_DOW[new Date().getDay()]
}

/** Get current time as "HH:MM" 24hr string */
export function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** Format "16:00" → "4 PM" or "16:30" → "4:30 PM" */
export function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`
}

/**
 * Returns true if a schedule is active right now.
 * Delegates to happeningNow for consistent midnight/all-day handling.
 */
export function isScheduleActiveNow(
  schedule: HappyHourSchedule,
  clock: Clock = REAL_CLOCK
): boolean {
  const result = getScheduleStatus(schedule, clock)
  return result?.status === 'live_now' || result?.status === 'ends_soon'
}

/**
 * Returns true if any of a venue's schedules are active right now.
 */
export function isVenueActiveNow(venue: Venue, clock: Clock = REAL_CLOCK): boolean {
  return (venue.schedules || []).some(s => isScheduleActiveNow(s, clock))
}

/** Returns the active schedule for right now, or null */
export function getActiveScheduleNow(
  venue: Venue,
  clock: Clock = REAL_CLOCK
): HappyHourSchedule | null {
  return (venue.schedules || []).find(s => isScheduleActiveNow(s, clock)) ?? null
}

/** Returns schedules active on a given day */
export function getSchedulesForDay(
  venue: Venue,
  day: DayOfWeek
): HappyHourSchedule[] {
  return (venue.schedules || []).filter(s => s.days.includes(day))
}

/** All days a venue has any happy hour coverage */
export function getVenueActiveDays(venue: Venue): DayOfWeek[] {
  const days = new Set<DayOfWeek>()
  ;(venue.schedules || []).forEach(s => s.days.forEach(d => days.add(d as DayOfWeek)))
  return Array.from(days)
}

// ─────────────────────────────────────────────
// DISTANCE UTILITIES
// ─────────────────────────────────────────────

/** Haversine distance in miles between two lat/lng points */
export function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Format distance for display */
export function fmtDistance(miles: number): string {
  if (miles < 0.1) return 'Here'
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`
  return `${miles.toFixed(1)} mi`
}

// ─────────────────────────────────────────────
// VENUE FILTERING
// ─────────────────────────────────────────────

/**
 * Single filtering function — apply all active filters to a venue list.
 * All filters are AND conditions. Empty sets / null = no filter applied.
 */
export function filterVenues(
  venues: Venue[],
  filters: FilterState,
  userLocation?: UserLocation | null,
  maxDistanceMiles = 25
): Venue[] {
  return venues.filter(venue => {

    // City filter
    if (filters.city && venue.city !== filters.city) return false

    // Open now — delegates to happeningNow for correct edge-case handling
    if (filters.openNow && !isVenueActiveNow(venue)) return false

    // Day filter — venue must have a schedule covering at least one selected day
    if (filters.days.size > 0) {
      const venueDays = getVenueActiveDays(venue)
      const hasMatch = [...filters.days].some(d => venueDays.includes(d))
      if (!hasMatch) return false
    }

    // Time window filter — at least one schedule must overlap the requested window
    if (filters.timeWindow) {
      const { start, end } = filters.timeWindow
      const hasOverlap = (venue.schedules || []).some(s => {
        if (s.is_all_day) return true
        // Overlap = not (s ends before window starts OR s starts after window ends)
        return !(s.end_time <= start || s.start_time >= end)
      })
      if (!hasOverlap) return false
    }

    // Deal type filter — any schedule must have a deal of the selected type
    if (filters.dealTypes.size > 0) {
      const hasType = (venue.schedules || []).some(s =>
        s.deals.some(d => filters.dealTypes.has(d.type as DealType))
      )
      if (!hasType) return false
    }

    // Category filter
    if (filters.categories.size > 0) {
      const hasCategory = venue.categories.some(c =>
        filters.categories.has(c as VenueCategory)
      )
      if (!hasCategory) return false
    }

    // Neighborhood filter
    if (filters.neighborhoods.size > 0) {
      if (!filters.neighborhoods.has(venue.neighborhood)) return false
    }

    // Price tier filter
    if (filters.priceTiers.size > 0) {
      if (!venue.price_tier || !filters.priceTiers.has(venue.price_tier as PriceTier)) return false
    }

    // Distance filter (only when user location is available)
    if (userLocation && venue.latitude && venue.longitude) {
      const miles = distanceMiles(
        userLocation.lat, userLocation.lng,
        venue.latitude, venue.longitude
      )
      if (miles > maxDistanceMiles) return false
    }

    // Text search — name, neighborhood, deal text, address
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      const searchable = [
        venue.name,
        venue.neighborhood,
        venue.address ?? '',
        ...(venue.schedules || []).map(s => s.deal_text),
        ...(venue.schedules || []).flatMap(s => s.deals.map(d => d.description)),
      ].join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }

    return true
  })
}

// Sort logic moved to utils/scoring.ts

// ─────────────────────────────────────────────
// DERIVED DATA HELPERS
// ─────────────────────────────────────────────

/** Get unique neighborhoods from a venue list */
export function getNeighborhoods(venues: Venue[]): string[] {
  return [...new Set(venues.map(v => v.neighborhood).filter(Boolean))].sort()
}

/** Get minimum deal price across all schedules for a venue */
export function getMinDealPrice(venue: Venue): number | null {
  const prices = (venue.schedules || [])
    .flatMap(s => s.deals)
    .map(d => d.price)
    .filter((p): p is number => p != null)
  return prices.length ? Math.min(...prices) : null
}

/** True if the deal was verified within the last 30 days */
export function isRecentlyVerified(venue: Venue): boolean {
  if (!venue.last_verified_at) return false
  const days = (Date.now() - new Date(venue.last_verified_at).getTime()) / 86_400_000
  return days <= 30
}

/** Human-readable "verified X days ago" string */
export function verifiedAgo(venue: Venue): string | null {
  if (!venue.last_verified_at) return null
  const days = Math.floor(
    (Date.now() - new Date(venue.last_verified_at).getTime()) / 86_400_000
  )
  if (days === 0) return 'Verified today'
  if (days === 1) return 'Verified yesterday'
  if (days < 30) return `Verified ${days}d ago`
  if (days < 365) return `Verified ${Math.floor(days / 30)}mo ago`
  return 'Not recently verified'
}
