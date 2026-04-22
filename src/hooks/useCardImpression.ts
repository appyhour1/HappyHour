import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../services/analytics'

// Tracks once per card per session — fires after 1 second of visibility
const seen = new Set<string>()

async function recordImpression(venueId: string, venueName: string, isFeatured: boolean, isSponsored: boolean) {
  try {
    // Fire to PostHog
    track('venue_card_impression', {
      venue_id: venueId,
      venue_name: venueName,
      is_featured: isFeatured,
      is_sponsored: isSponsored,
    })

    // Write to Supabase venue_stats
    await supabase.rpc('increment_venue_stat', {
      p_venue_id: venueId,
      p_stat: 'card_views',
    })
  } catch {
    // Never break the UI for analytics
  }
}

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
          // Start 1-second timer when card enters viewport
          timerRef.current = setTimeout(() => {
            if (!seen.has(venueId)) {
              seen.add(venueId)
              recordImpression(venueId, venueName, isFeatured, isSponsored)
            }
          }, 1000)
        } else {
          // Card left viewport before 1 second — cancel timer
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        }
      },
      { threshold: 0.5 } // 50% of card must be visible
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [venueId, venueName, isFeatured, isSponsored])

  return ref
}
