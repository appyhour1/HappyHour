/**
 * useConfirmDeal.ts
 *
 * Community "still accurate" confirmations.
 * Each user can confirm once per venue per day.
 * Count shown on venue cards and detail pages.
 *
 * TO CONFIRM: call confirmDeal(venueId)
 * TO CHECK COUNT: use confirmCounts[venueId] (number)
 * TO CHECK IF CONFIRMED TODAY: hasConfirmed(venueId)
 *
 * BACKEND: writes to deal_confirmations table in Supabase.
 * Anonymous — uses a session ID stored in localStorage.
 * No auth required.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Generate or retrieve anonymous session ID
function getSessionId(): string {
  const key = 'hh_session_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
}

// Track which venues this session has confirmed today
function getConfirmedToday(): Set<string> {
  try {
    const raw = localStorage.getItem('hh_confirmed_today')
    const stored = raw ? JSON.parse(raw) : {}
    const today = new Date().toDateString()
    if (stored.date !== today) return new Set()
    return new Set(stored.venues ?? [])
  } catch { return new Set() }
}

function saveConfirmedToday(ids: Set<string>) {
  try {
    localStorage.setItem('hh_confirmed_today', JSON.stringify({
      date: new Date().toDateString(),
      venues: [...ids],
    }))
  } catch {}
}

export interface UseConfirmDealReturn {
  confirmCounts: Record<string, number>
  confirming: string | null
  hasConfirmed: (venueId: string) => boolean
  confirmDeal: (venueId: string) => Promise<void>
  loadCountsForVenues: (venueIds: string[]) => Promise<void>
}

export function useConfirmDeal(): UseConfirmDealReturn {
  const [confirmCounts, setConfirmCounts] = useState<Record<string, number>>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmedToday, setConfirmedToday] = useState<Set<string>>(getConfirmedToday)

  const hasConfirmed = useCallback(
    (venueId: string) => confirmedToday.has(venueId),
    [confirmedToday]
  )

  const loadCountsForVenues = useCallback(async (venueIds: string[]) => {
    if (venueIds.length === 0) return
    try {
      // Count confirmations in the last 7 days per venue
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('deal_confirmations')
        .select('venue_id')
        .in('venue_id', venueIds)
        .gte('confirmed_at', since)

      if (error) return

      const counts: Record<string, number> = {}
      venueIds.forEach(id => { counts[id] = 0 })
      ;(data ?? []).forEach((row: { venue_id: string }) => {
        counts[row.venue_id] = (counts[row.venue_id] ?? 0) + 1
      })
      setConfirmCounts(prev => ({ ...prev, ...counts }))
    } catch {}
  }, [])

  const confirmDeal = useCallback(async (venueId: string) => {
    if (confirmedToday.has(venueId)) return
    setConfirming(venueId)

    try {
      await supabase.from('deal_confirmations').insert([{
        venue_id: venueId,
        session_id: getSessionId(),
        confirmed_at: new Date().toISOString(),
      }])

      // Update local count
      setConfirmCounts(prev => ({
        ...prev,
        [venueId]: (prev[venueId] ?? 0) + 1,
      }))

      // Mark confirmed today
      const next = new Set(confirmedToday)
      next.add(venueId)
      setConfirmedToday(next)
      saveConfirmedToday(next)
    } catch {}

    setConfirming(null)
  }, [confirmedToday])

  return { confirmCounts, confirming, hasConfirmed, confirmDeal, loadCountsForVenues }
}
