/**
 * filterUrl.ts
 *
 * Serializes FilterState + SortMode to/from URL search params.
 * Allows users to share filtered views as links.
 *
 * URL format example:
 *   ?now=1&days=Mon,Fri&deals=beer,cocktail&cat=dive_bar&hood=OTR&price=$,$$&tw=15:00-19:00&sort=cheapest&q=wings
 *
 * Design rules:
 * - Keep param names short (URL real estate)
 * - Sets serialize as comma-separated strings
 * - Booleans serialize as "1" / omitted (no "false" in URL)
 * - Defaults are omitted (empty URL = default state)
 * - Invalid/unknown values are silently ignored on parse
 */

import type { FilterState, SortMode, DayOfWeek, DealType, VenueCategory, PriceTier } from '../types'
import { DEFAULT_FILTERS } from '../types'

// ─────────────────────────────────────────────
// PARAM KEYS
// ─────────────────────────────────────────────

const P = {
  NOW:   'now',
  DAYS:  'days',
  DEALS: 'deals',
  CATS:  'cat',
  HOODS: 'hood',
  PRICE: 'price',
  TIME:  'tw',     // time window: "HH:MM-HH:MM"
  SORT:  'sort',
  QUERY: 'q',
  CITY:  'city',
} as const

// ─────────────────────────────────────────────
// VALID VALUE SETS (for safe parsing)
// ─────────────────────────────────────────────

const VALID_DAYS    = new Set<DayOfWeek>(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
const VALID_DEALS   = new Set<DealType>(['beer','wine','cocktail','food','general'])
const VALID_CATS    = new Set<VenueCategory>([
  'sports_bar','dive_bar','cocktail_bar','rooftop','restaurant','brewery',
  'wine_bar','pub','lounge','date_night','patio','live_music','late_night',
])
const VALID_PRICES  = new Set<PriceTier>(['$','$$','$$$','$$$$'])
const VALID_SORTS   = new Set<SortMode>([
  'best_match','closest','cheapest','starting_soon','most_popular','featured',
])

// ─────────────────────────────────────────────
// SERIALIZE — FilterState → URLSearchParams
// ─────────────────────────────────────────────

export function filtersToParams(
  filters: FilterState,
  sort: SortMode
): URLSearchParams {
  const p = new URLSearchParams()

  if (filters.openNow)               p.set(P.NOW,   '1')
  if (filters.days.size > 0)         p.set(P.DAYS,  [...filters.days].join(','))
  if (filters.dealTypes.size > 0)    p.set(P.DEALS, [...filters.dealTypes].join(','))
  if (filters.categories.size > 0)   p.set(P.CATS,  [...filters.categories].join(','))
  if (filters.neighborhoods.size > 0) p.set(P.HOODS, [...filters.neighborhoods].join(','))
  if (filters.priceTiers.size > 0)   p.set(P.PRICE, [...filters.priceTiers].join(','))
  if (filters.timeWindow)            p.set(P.TIME,  `${filters.timeWindow.start}-${filters.timeWindow.end}`)
  if (filters.search.trim())         p.set(P.QUERY, filters.search.trim())
  if (filters.city)                  p.set(P.CITY,  filters.city)
  if (sort !== 'best_match')         p.set(P.SORT,  sort)  // omit default

  return p
}

// ─────────────────────────────────────────────
// PARSE — URLSearchParams → FilterState + SortMode
// ─────────────────────────────────────────────

export function paramsToFilters(
  params: URLSearchParams
): { filters: FilterState; sort: SortMode } {
  function parseSet<T>(key: string, valid: Set<T>): Set<T> {
    const raw = params.get(key)
    if (!raw) return new Set()
    const items = raw.split(',').filter(v => valid.has(v as T)) as T[]
    return new Set(items)
  }

  const timeRaw = params.get(P.TIME)
  let timeWindow = null
  if (timeRaw) {
    const [start, end] = timeRaw.split('-')
    if (start && end && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) {
      timeWindow = { start, end }
    }
  }

  const sortRaw = params.get(P.SORT)
  const sort: SortMode = sortRaw && VALID_SORTS.has(sortRaw as SortMode)
    ? sortRaw as SortMode
    : 'best_match'

  const filters: FilterState = {
    ...DEFAULT_FILTERS,
    openNow:       params.get(P.NOW) === '1',
    days:          parseSet(P.DAYS,  VALID_DAYS),
    dealTypes:     parseSet(P.DEALS, VALID_DEALS),
    categories:    parseSet(P.CATS,  VALID_CATS),
    neighborhoods: parseSet(P.HOODS, new Set<string>()),  // open set
    priceTiers:    parseSet(P.PRICE, VALID_PRICES),
    timeWindow,
    search:        params.get(P.QUERY) ?? '',
    city:          params.get(P.CITY) ?? null,
  }

  // neighborhoods is an open set — re-parse without validation
  const hoodRaw = params.get(P.HOODS)
  if (hoodRaw) {
    filters.neighborhoods = new Set(hoodRaw.split(',').filter(Boolean))
  }

  return { filters, sort }
}

// ─────────────────────────────────────────────
// ACTIVE FILTER COUNT — for badge display
// ─────────────────────────────────────────────

export function countActiveFilters(filters: FilterState, sort: SortMode): number {
  return [
    filters.openNow,
    filters.days.size > 0,
    filters.dealTypes.size > 0,
    filters.categories.size > 0,
    filters.neighborhoods.size > 0,
    filters.priceTiers.size > 0,
    filters.timeWindow !== null,
    filters.search.trim().length > 0,
    sort !== 'best_match',
  ].filter(Boolean).length
}

/** True if filters + sort are at their default values */
export function isDefaultState(filters: FilterState, sort: SortMode): boolean {
  return countActiveFilters(filters, sort) === 0
}
