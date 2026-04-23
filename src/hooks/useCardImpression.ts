import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../services/analytics'

// Tracks once per card per session — fires after 1 second of 50% visibility
const seen = new Set<string>()

async function recordImpression(venueId: string, venueName: string, isFeatured: boolean, isSponsored: boolean) {
  try {
    // 1. Fire to PostHog
    track('venue_card_impression', {
      venue_id: venueId,
      venue_name: venueName,
      is_featured: isFeatured,
      is_sponsored: isSponsored,
    })

    // 2. Increment weekly venue_stats (existing)
    await supabase.rpc('increment_venue_stat', {
      p_venue_id: venueId,
      p_stat: 'card_views',
    })

    // 3. Log timestamped event for daily/weekly/monthly/yearly/all-time queries
    await supabase.from('venue_impressions').insert({
      venue_id: venueId,
      event_type: 'card_view',
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
          timerRef.current = setTimeout(() => {
            if (!seen.has(venueId)) {
              seen.add(venueId)
              recordImpression(venueId, venueName, isFeatured, isSponsored)
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
  }, [venueId, venueName, isFeatured, isSponsored])

  return ref
}
