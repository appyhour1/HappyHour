/**
 * impressionBuffer.ts
 *
 * WHY THIS EXISTS:
 * Previously VenueCard fired 2 Supabase writes per card viewed:
 *   1. supabase.rpc('increment_venue_stat', ...)  — per impression
 *   2. supabase.from('venue_impressions').insert(...) — per impression
 *
 * At 100 users browsing 20 cards each = 4,000 DB writes/minute.
 * Supabase free tier allows ~500 requests/minute before throttling.
 *
 * This module accumulates impressions in memory and flushes them as a
 * single batch INSERT every 30 seconds, or immediately when the tab is
 * hidden/closed. Result: ~1 DB write per 30 seconds instead of per card.
 *
 * The increment_venue_stat RPC is removed — AdminPage already reads
 * directly from venue_impressions, so it's redundant.
 *
 * USAGE:
 *   import { trackImpression } from '../services/impressionBuffer'
 *   trackImpression(venueId, 'card_view')
 *   trackImpression(venueId, 'detail_view')
 */

import { supabase } from '../lib/supabase'

export type ImpressionEventType = 'card_view' | 'detail_view'

interface ImpressionEvent {
  venue_id: string
  event_type: ImpressionEventType
}

// Module-level buffer — survives component unmounts within a session
const buffer: ImpressionEvent[] = []
let initialized = false
let flushTimer: ReturnType<typeof setInterval> | null = null

async function flush(): Promise<void> {
  if (buffer.length === 0) return

  // Drain atomically — splice before the await so no events are lost
  // if flush() is called again while the insert is in flight
  const batch = buffer.splice(0, buffer.length)

  try {
    await supabase.from('venue_impressions').insert(batch)
  } catch {
    // Impressions are analytics data — never crash the app over them.
    // Lost impressions on network failure are acceptable.
  }
}

function init(): void {
  if (initialized) return
  initialized = true

  // Flush every 30 seconds
  flushTimer = setInterval(flush, 30_000)

  // Flush when tab goes to background (covers iOS Safari swipe-away)
  // NOTE: 'beforeunload' is unreliable on iOS Safari — visibilitychange is correct
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Use sendBeacon if available — works even when the page is being unloaded
      if (buffer.length > 0 && navigator.sendBeacon) {
        // sendBeacon can't use supabase client directly, so fall back to fetch-based flush
        void flush()
      } else {
        void flush()
      }
    }
  })

  // Flush on page unload (desktop browsers)
  window.addEventListener('pagehide', () => { void flush() })
}

/**
 * Queue a venue impression event for batched delivery to Supabase.
 * Safe to call from any component — initializes the flush cycle on first call.
 */
export function trackImpression(venueId: string, eventType: ImpressionEventType): void {
  if (!venueId) return
  init()
  buffer.push({ venue_id: venueId, event_type: eventType })
}

/**
 * Force an immediate flush. Useful for testing or before critical navigation.
 */
export function flushImpressions(): Promise<void> {
  return flush()
}
