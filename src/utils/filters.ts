import type {
  Venue, HappyHourSchedule, FilterState, DayOfWeek, DealType,
  VenueCategory, PriceTier, UserLocation
} from '../types'
import { JS_DAY_TO_DOW } from '../types'
import { getScheduleStatus, REAL_CLOCK, type Clock } from './happeningNow'

export function getTodayDOW(): DayOfWeek {
  return JS_DAY_TO_DOW[new Date().getDay()]
}

export function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`
}

export function isScheduleActiveNow(
  schedule: HappyHourSchedule,
  clock: Clock = REAL_CLOCK
): boolean {
  const result = getScheduleStatus(schedule, clock)
  return result?.status === 'live_now' || result?.status === 'ends_soon'
}

export function isVenueActiveNow(venue: Venue, clock: Clock = REAL_CLOCK): boolean {
  return (venue.schedules || []).some(s => isScheduleActiveNow(s, clock))
}

export function getActiveScheduleNow(
  venue: Venue,
  clock: Clock = REAL_CLOCK
): HappyHourSchedule | null {
  return (venue.schedules || []).find(s => isScheduleActiveNow(s, clock)) ?? null
}

export function getSchedulesForDay(venue: Venue, day: DayOfWeek): HappyHourSchedule[] {
  return (venue.schedules || []).filter(s => s.days.includes(day))
}

export function getVenueActiveDays(venue: Venue): DayOfWeek[] {
  const days = new Set<DayOfWeek>()
  ;(venue.schedules || []).forEach(s => s.days.forEach(d => days.add(d as DayOfWeek)))
  return Array.from(days)
}

export function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function fmtDistance(miles: number): string {
  if (miles < 0.1) return 'Here'
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`
  return `${miles.toFixed(1)} mi`
}

export function filterVenues(
  venues: Venue[],
  filters: FilterState,
  userLocation?: UserLocation | null,
  maxDistanceMiles = 25
): Venue[] {
  return venues.filter(venue => {
    if (filters.city && venue.city !== filters.city) return false
    if (filters.openNow && !isVenueActiveNow(venue)) return false

    if (filters.days.size > 0) {
      const venueDays = getVenueActiveDays(venue)
      const hasMatch = [...filters.days].some(d => venueDays.includes(d))
      if (!hasMatch) return false
    }

    if (filters.timeWindow) {
      const { start, end } = filters.timeWindow
      const hasOverlap = (venue.schedules || []).some(s => {
        if (s.is_all_day) return true
        return !(s.end_time <= start || s.start_time >= end)
      })
      if (!hasOverlap) return false
    }

   if (filters.dealTypes.size > 0) {
      const dealTypeKeywords: Record<string, string[]> = {
        beer:     ['beer', 'draft', 'brew', 'lager', 'ale', 'pint'],
        wine:     ['wine', 'vino', 'champagne', 'prosecco', 'bubbly'],
        cocktail: ['cocktail', 'well', 'spirit', 'margarita', 'martini', 'mixed'],
        food:     ['food', 'app', 'appetizer', 'bite', 'wing', 'burger', 'taco', 'pizza', 'snack', 'half-off', 'half off', 'menu'],
        general:  [],
      }
      const hasType = (venue.schedules || []).some(s => {
        // Check structured deals array first
        if (s.deals.some(d => filters.dealTypes.has(d.type as DealType))) return true
        // Fall back to keyword search in deal_text
        const text = (s.deal_text || '').toLowerCase()
        return [...filters.dealTypes].some(type => {
          if (type === 'general') return true
          return (dealTypeKeywords[type] || []).some(kw => text.includes(kw))
        })
      })
      if (!hasType) return false
    }

    if (filters.categories.size > 0) {
      const hasCategory = venue.categories.some(c =>
        filters.categories.has(c as VenueCategory)
      )
      if (!hasCategory) return false
    }

    if (filters.neighborhoods.size > 0) {
      if (!filters.neighborhoods.has(venue.neighborhood)) return false
    }

    if (filters.priceTiers.size > 0) {
      if (!venue.price_tier || !filters.priceTiers.has(venue.price_tier as PriceTier)) return false
    }

    if (userLocation && venue.latitude && venue.longitude) {
      const miles = distanceMiles(
        userLocation.lat, userLocation.lng,
        venue.latitude, venue.longitude
      )
      if (miles > maxDistanceMiles) return false
    }

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

// Sort logic lives in utils/scoring.ts

export function getNeighborhoods(venues: Venue[]): string[] {
  return [...new Set(venues.map(v => v.neighborhood).filter(Boolean))].sort()
}

export function getMinDealPrice(venue: Venue): number | null {
  const prices = (venue.schedules || [])
    .flatMap(s => s.deals)
    .map(d => d.price)
    .filter((p): p is number => p != null)
  return prices.length ? Math.min(...prices) : null
}

export function isRecentlyVerified(venue: Venue): boolean {
  if (!venue.last_verified_at) return false
  const days = (Date.now() - new Date(venue.last_verified_at).getTime()) / 86_400_000
  return days <= 30
}

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
