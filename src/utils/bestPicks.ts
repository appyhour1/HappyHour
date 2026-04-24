/**
 * bestPicks.ts
 *
 * Generates curated "Best Picks" sections from venue data.
 * Logic is transparent and data-driven, not magic.
 *
 * EACH SECTION:
 *   id        — unique key for analytics + rendering
 *   title     — display heading
 *   subtitle  — brief editorial context
 *   venues    — ranked list (max 6 per section)
 *   icon      — emoji for visual identity
 *
 * DEDUPLICATION:
 *   A venue is allowed in at most 2 sections to avoid overexposure.
 *   "Happening Now" and "Starting Soon" are exempt since they're temporal.
 *
 * SORT PRIORITY (all sections):
 *   1. Price (when available) — ascending
 *   2. Confirmations (deal_confirmations count) — real user trust signal
 *   3. Upvotes — community popularity
 *   4. Name — alphabetical, always deterministic as final tiebreaker
 *
 * NOTE: Sections that depend purely on upvotes will improve automatically
 * as users engage. Until then, alphabetical order is shown — predictable
 * and consistent rather than arbitrary.
 */

import type { Venue } from '../types'
import { isVenueActiveNow, getMinDealPrice } from './filters'
import { getVenueStatus } from './happeningNow'
import { scorevenue } from './scoring'
import type { UserLocation } from '../types'

export interface BestPicksSection {
  id: string
  title: string
  subtitle: string
  icon: string
  venues: Venue[]
}

const MAX_PER_SECTION = 6
const MAX_SECTIONS_PER_VENUE = 2

// ─────────────────────────────────────────────
// SHARED SORT HELPERS
// ─────────────────────────────────────────────

/**
 * Reliable tiebreaker chain used across all sections:
 * confirmations → upvotes → name
 * Ensures consistent, predictable ordering when price data is absent.
 */
function byEngagement(a: Venue, b: Venue): number {
  const aConf = (a as any).confirmations ?? 0
  const bConf = (b as any).confirmations ?? 0
  if (bConf !== aConf) return bConf - aConf
  if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count
  return a.name.localeCompare(b.name)
}

/**
 * Sort by price for a specific deal type, falling back to engagement.
 */
function byPriceForType(type: string) {
  return (a: Venue, b: Venue): number => {
    const aPrice = getMinPriceForType(a, type)
    const bPrice = getMinPriceForType(b, type)
    if (aPrice !== null && bPrice !== null) return aPrice - bPrice
    if (aPrice !== null) return -1  // priced venues rank above unpriced
    if (bPrice !== null) return 1
    return byEngagement(a, b)
  }
}

// ─────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────

export function buildBestPicksSections(
  venues: Venue[],
  userLocation?: UserLocation | null
): BestPicksSection[] {

  // Track how many times each venue has appeared
  const appearances = new Map<string, number>()
  function canAppear(venue: Venue, exempt = false): boolean {
    if (exempt) return true
    return (appearances.get(venue.id) ?? 0) < MAX_SECTIONS_PER_VENUE
  }
  function record(venue: Venue) {
    appearances.set(venue.id, (appearances.get(venue.id) ?? 0) + 1)
  }

  const sections: BestPicksSection[] = []

  // ── 1. HAPPENING NOW (exempt from dedup) ─────────────────────────────
  const happeningNow = venues
    .filter(v => isVenueActiveNow(v))
    .sort((a, b) => scorevenue(b) - scorevenue(a))
    .slice(0, MAX_PER_SECTION)

  if (happeningNow.length > 0) {
    happeningNow.forEach(record)
    sections.push({
      id: 'happening_now',
      title: 'Happening Now',
      subtitle: 'Happy hours active right now',
      icon: '🟢',
      venues: happeningNow,
    })
  }

  // ── 2. STARTING SOON (exempt from dedup) ─────────────────────────────
  const startingSoon = venues
    .map(v => ({ venue: v, status: getVenueStatus(v) }))
    .filter(({ status }) =>
      status.status === 'starts_soon' ||
      (status.status === 'later_today' && (status.minutesUntil ?? 999) <= 90)
    )
    .sort((a, b) => (a.status.minutesUntil ?? 999) - (b.status.minutesUntil ?? 999))
    .map(({ venue }) => venue)
    .slice(0, MAX_PER_SECTION)

  if (startingSoon.length > 0) {
    startingSoon.forEach(record)
    sections.push({
      id: 'starting_soon',
      title: 'Starting Soon',
      subtitle: 'Happy hours kicking off in the next 90 minutes',
      icon: '⏰',
      venues: startingSoon,
    })
  }

  // ── 3. CHEAPEST DRINKS ───────────────────────────────────────────────
  // Only includes venues with at least one deal that has an explicit price.
  // Requires price <= $6 (raised from $5 to be more inclusive with real data).
  const cheapest = venues
    .filter(v => canAppear(v))
    .map(v => ({ venue: v, price: getMinDealPrice(v) }))
    .filter(({ price }) => price !== null && price <= 6)
    .sort((a, b) => {
      // Primary: price ascending
      if (a.price !== b.price) return (a.price ?? 99) - (b.price ?? 99)
      // Tiebreaker: engagement
      return byEngagement(a.venue, b.venue)
    })
    .map(({ venue }) => venue)
    .slice(0, MAX_PER_SECTION)

  if (cheapest.length >= 2) {
    cheapest.forEach(record)
    sections.push({
      id: 'cheapest_drinks',
      title: 'Cheapest Drinks',
      subtitle: 'Best bang for your buck — deals under $6',
      icon: '💰',
      venues: cheapest,
    })
  }

  // ── 4. BEST COCKTAIL DEALS ───────────────────────────────────────────
  // Sorted by cocktail price asc, then engagement, then name.
  const cocktailVenues = venues
    .filter(v =>
      canAppear(v) &&
      (v.schedules ?? []).some(s => s.deals.some(d => d.type === 'cocktail'))
    )
    .sort(byPriceForType('cocktail'))
    .slice(0, MAX_PER_SECTION)

  if (cocktailVenues.length >= 2) {
    cocktailVenues.forEach(record)
    sections.push({
      id: 'cocktail_deals',
      title: 'Best Cocktail Deals',
      subtitle: 'Craft and classic cocktails at happy hour prices',
      icon: '🍸',
      venues: cocktailVenues,
    })
  }

  // ── 5. BEST FOOD DEALS ───────────────────────────────────────────────
  // Now sorts by food price asc (same logic as cocktails), then engagement.
  // Previously only used upvotes which was arbitrary at launch.
  const foodVenues = venues
    .filter(v =>
      canAppear(v) &&
      (v.schedules ?? []).some(s => s.deals.some(d => d.type === 'food'))
    )
    .sort(byPriceForType('food'))
    .slice(0, MAX_PER_SECTION)

  if (foodVenues.length >= 2) {
    foodVenues.forEach(record)
    sections.push({
      id: 'food_deals',
      title: 'Best Food Deals',
      subtitle: 'Half-off apps, bites, and more',
      icon: '🍔',
      venues: foodVenues,
    })
  }

  // ── 6. ROOFTOP PICKS ─────────────────────────────────────────────────
  const rooftops = venues
    .filter(v => canAppear(v) && v.categories.includes('rooftop'))
    .sort(byEngagement)
    .slice(0, MAX_PER_SECTION)

  if (rooftops.length >= 1) {
    rooftops.forEach(record)
    sections.push({
      id: 'rooftop_picks',
      title: 'Rooftop Picks',
      subtitle: 'Drinks with a view',
      icon: '🌆',
      venues: rooftops,
    })
  }

  // ── 7. DATE NIGHT PICKS ──────────────────────────────────────────────
  const dateNight = venues
    .filter(v =>
      canAppear(v) &&
      (
        v.categories.includes('date_night') ||
        v.categories.includes('cocktail_bar') ||
        v.categories.includes('wine_bar')
      )
    )
    .sort(byEngagement)
    .slice(0, MAX_PER_SECTION)

  if (dateNight.length >= 2) {
    dateNight.forEach(record)
    sections.push({
      id: 'date_night',
      title: 'Date Night Picks',
      subtitle: 'Romantic spots with great happy hour deals',
      icon: '🥂',
      venues: dateNight,
    })
  }

  return sections
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function getMinPriceForType(venue: Venue, type: string): number | null {
  const prices = (venue.schedules ?? [])
    .flatMap(s => s.deals)
    .filter(d => d.type === type && d.price != null)
    .map(d => d.price!)
  return prices.length ? Math.min(...prices) : null
}
