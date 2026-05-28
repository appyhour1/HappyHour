/**
 * venueCache.ts
 *
 * WHY THIS EXISTS:
 * Every navigation to BrowsePage calls getVenues() which hits Supabase.
 * A user browsing the app for 20 minutes makes ~10–20 repeat DB fetches
 * for the same venue data. Supabase free tier charges per request.
 *
 * This module caches venue data in sessionStorage with a 5-minute TTL.
 * First load hits the DB. All subsequent navigations in the same session
 * are instant and free. Cache is invalidated on pull-to-refresh.
 *
 * sessionStorage is:
 *   - Per-tab (correct — each tab gets fresh data)
 *   - Cleared when the tab closes (correct — no stale data across days)
 *   - ~5–10MB limit (enough for hundreds of venues with full schedules)
 *   - Supported on all iOS Safari versions we care about
 *
 * USAGE:
 *   // In AppContext or venueService — replace:
 *   const venues = await getVenues(city)
 *
 *   // With:
 *   const venues = await cachedGetVenues(city, getVenues)
 *
 *   // To force a fresh fetch (pull-to-refresh):
 *   invalidateVenueCache(city)
 *   const venues = await cachedGetVenues(city, getVenues)
 */

const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes
const CACHE_PREFIX = 'hhu_venues_'

interface CacheEntry<T> {
  data: T
  expires: number
  version: number
}

// Increment when the Venue schema changes to auto-invalidate stale cache entries
const CACHE_VERSION = 1

function getCacheKey(city: string): string {
  return `${CACHE_PREFIX}${city.toLowerCase().replace(/\s+/g, '_')}`
}

function readCache<T>(city: string): T | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(city))
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (entry.version !== CACHE_VERSION) return null
    if (Date.now() > entry.expires) {
      sessionStorage.removeItem(getCacheKey(city))
      return null
    }
    return entry.data
  } catch {
    // sessionStorage unavailable (private browsing edge cases) or malformed data
    return null
  }
}

function writeCache<T>(city: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      expires: Date.now() + CACHE_TTL_MS,
      version: CACHE_VERSION,
    }
    sessionStorage.setItem(getCacheKey(city), JSON.stringify(entry))
  } catch (e: any) {
    // QuotaExceededError — storage full. Continue without caching.
    // This can happen if there are many cities or very large venue datasets.
    if (e?.name === 'QuotaExceededError') {
      // Clear all our cache entries to free space, but don't crash
      clearVenueCache()
    }
  }
}

/**
 * Invalidate the cache for a specific city (call on pull-to-refresh).
 */
export function invalidateVenueCache(city: string): void {
  try {
    sessionStorage.removeItem(getCacheKey(city))
  } catch {}
}

/**
 * Clear all venue cache entries (e.g. on logout or schema change).
 */
export function clearVenueCache(): void {
  try {
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith(CACHE_PREFIX))
    keys.forEach(k => sessionStorage.removeItem(k))
  } catch {}
}

/**
 * Fetch venues for a city, using sessionStorage cache when fresh.
 *
 * @param city       City name, e.g. 'Cincinnati'
 * @param fetcher    The real fetch function, e.g. getVenues from venueService
 * @param forceRefresh  Skip cache and fetch fresh data (for pull-to-refresh)
 */
export async function cachedGetVenues<T>(
  city: string,
  fetcher: (city: string) => Promise<T>,
  forceRefresh = false,
): Promise<T> {
  if (!forceRefresh) {
    const cached = readCache<T>(city)
    if (cached !== null) return cached
  }

  const data = await fetcher(city)
  writeCache(city, data)
  return data
}

/**
 * Returns true if fresh cached data exists for this city.
 * Useful for showing a "Refreshing..." indicator when forceRefresh is used.
 */
export function hasVenueCache(city: string): boolean {
  return readCache(city) !== null
}
