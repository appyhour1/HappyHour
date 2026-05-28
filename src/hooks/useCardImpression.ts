/**
 * useCardImpression.ts
 *
 * NOTE: This hook is not currently used by VenueCard — VenueCard manages
 * its own IntersectionObserver inline. This file is kept for any other
 * components that may need impression tracking.
 *
 * Updated to use impressionBuffer for batched writes instead of 3 sequential
 * direct DB operations per impression. See impressionBuffer.ts for details.
 */

import { useEffect, useRef } from 'react'
import { trackImpression } from '../services/impressionBuffer'

// Session-level dedup — fires once per venue per page load
const seen = new Set<string>()

export function useCardImpression(
  venueId: string,
  venueName: string,
  isFeatured: boolean,
  isSponsored: boolean
) {
  const ref = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || seen.has(venueId)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timerRef.current = setTimeout(() => {
            if (!seen.has(venueId)) {
              seen.add(venueId)
              // Batched write — does not hit Supabase immediately
              trackImpression(venueId, 'card_view')
            }
          }, 1000)
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [venueId])

  return ref
}
