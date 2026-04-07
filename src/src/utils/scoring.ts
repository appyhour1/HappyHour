/**
 * scoring.ts
 *
 * "Best match" scoring and all sort comparators.
 * Every sort function is pure — no React, no side effects.
 *
 * SORT MODES:
 *   best_match    — composite score: open now, cheapest deal, featured, popularity
 *   closest       — haversine distance asc; falls back to name when no GPS
 *   cheapest      — lowest deal price asc; venues with no prices sort last
 *   starting_soon — minutes until next happy hour asc; already-live sort first
 *   most_popular  — upvote_count desc
 *   featured      — featured flag first, then upvotes
 */

import type { Venue, SortMode, UserLocation } from '../types'
import { getMinDealPrice, distanceMiles } from './filters'
import { getVenueStatus, isVenueLiveNow, REAL_CLOCK, type Clock } from './happeningNow'

// ─────────────────────────────────────────────
// BEST MATCH SCORING
// ─────────────────────────────────────────────

/**
 * Compute a single numeric score for a venue. Higher = better match.
 *
 * SCORE COMPONENTS:
 *   +100  currently live (open now)
 *   +50   starts within 60 min
 *   +30   is_featured
 *   +0–20 upvote score (log-scaled, capped at 20)
 *   +0–20 price score (cheapest deal gets 20, expensive gets 0)
 *   -10   unverified
 */
export function scorevenue(
  venue: Venue,
  clock: Clock = REAL_CLOCK,
  userLocation?: UserLocation | null
): number {
  let score = 0

  // Live now — most important signal
  const status = getVenueStatus(venue, clock)
  if (status.status === 'live_now' || status.status === 'ends_soon') {
    score += 100
  } else if (status.status === 'starts_soon') {
    score += 50
  } else if (status.status === 'later_today') {
    score += 20
  }

  // Featured venues get a boost
  if (venue.is_featured) score += 30

  // Upvotes — log scale so one viral venue doesn't drown everything
  score += Math.min(20, Math.log1p(venue.upvote_count) * 4)

  // Price score — cheaper deals rank higher
  const minPrice = getMinDealPrice(venue)
  if (minPrice !== null) {
    // $2 deal → 20 pts, $10 deal → ~12 pts, $20 deal → ~4 pts
    score += Math.max(0, 20 - minPrice * 0.8)
  }

  // Verification trust signal
  if (venue.verification_status === 'unverified') score -= 10
  if (venue.verification_status === 'claimed' || venue.verification_status === 'verified') score += 5

  // Distance bonus (closer = more points) — only when location available
  if (userLocation && venue.latitude && venue.longitude) {
    const miles = distanceMiles(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude)
    // Within 0.5mi = full 15pts, 5mi = ~7pts, 25mi+ = 0
    score += Math.max(0, 15 - miles * 0.6)
  }

  return score
}

// ─────────────────────────────────────────────
// SORT COMPARATORS
// ─────────────────────────────────────────────

type Comparator = (a: Venue, b: Venue) => number

function byName(a: Venue, b: Venue): number {
  return a.name.localeCompare(b.name)
}

function byUpvotes(a: Venue, b: Venue): number {
  return b.upvote_count - a.upvote_count
}

/** Chain comparators: if first returns 0, try next */
function chain(...fns: Comparator[]): Comparator {
  return (a, b) => {
    for (const fn of fns) {
      const r = fn(a, b)
      if (r !== 0) return r
    }
    return 0
  }
}

// ─────────────────────────────────────────────
// MAIN SORT FUNCTION
// ─────────────────────────────────────────────

export function sortVenuesByMode(
  venues: Venue[],
  mode: SortMode,
  userLocation?: UserLocation | null,
  clock: Clock = REAL_CLOCK
): Venue[] {
  const copy = [...venues]

  switch (mode) {

    case 'best_match':
      // Pre-compute scores once for efficiency
      const scores = new Map<string, number>()
      copy.forEach(v => scores.set(v.id, scorevenue(v, clock, userLocation)))
      return copy.sort(chain(
        (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0),
        byName
      ))

    case 'closest':
      if (!userLocation) return copy.sort(byName)
      return copy.sort(chain(
        (a, b) => {
          const aDist = a.latitude && a.longitude
            ? distanceMiles(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
            : Infinity
          const bDist = b.latitude && b.longitude
            ? distanceMiles(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
            : Infinity
          return aDist - bDist
        },
        byName
      ))

    case 'cheapest':
      return copy.sort(chain(
        (a, b) => {
          const ap = getMinDealPrice(a)
          const bp = getMinDealPrice(b)
          if (ap === null && bp === null) return 0
          if (ap === null) return 1   // no price → sort last
          if (bp === null) return -1
          return ap - bp
        },
        byName
      ))

    case 'starting_soon':
      return copy.sort(chain(
        (a, b) => {
          const as_ = getVenueStatus(a, clock)
          const bs_ = getVenueStatus(b, clock)
          // Live venues first (sort by time remaining desc so almost-ending goes last)
          const aLive = as_.status === 'live_now' || as_.status === 'ends_soon'
          const bLive = bs_.status === 'live_now' || bs_.status === 'ends_soon'
          if (aLive && !bLive) return -1
          if (!aLive && bLive) return 1
          if (aLive && bLive) {
            return (bs_.minutesRemaining ?? 0) - (as_.minutesRemaining ?? 0)
          }
          // Both not live — sort by minutes until start asc
          const aMin = as_.minutesUntil ?? 9999
          const bMin = bs_.minutesUntil ?? 9999
          return aMin - bMin
        },
        byName
      ))

    case 'most_popular':
      return copy.sort(chain(byUpvotes, byName))

    case 'featured':
      return copy.sort(chain(
        (a, b) => {
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
          return 0
        },
        byUpvotes,
        byName
      ))

    default:
      return copy.sort(byName)
  }
}
