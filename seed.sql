/**
 * useFavorites.ts
 *
 * Favorites backed by localStorage. Clean interface that can be
 * wired to Supabase auth with a single file change.
 *
 * TO CONNECT TO SUPABASE LATER:
 *   1. Replace loadFavorites/saveFavorites with Supabase queries
 *   2. Add a useEffect that syncs when user logs in
 *   3. The rest of the app doesn't change — it only calls this hook
 */

import { useState, useEffect, useCallback } from 'react'
import { Analytics } from '../services/analytics'

const STORAGE_KEY = 'hh_favorites_v1'

// ─────────────────────────────────────────────
// STORAGE HELPERS (swap these for Supabase later)
// ─────────────────────────────────────────────

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // localStorage might be blocked (private mode) — fail silently
  }
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export interface UseFavoritesReturn {
  favorites: Set<string>
  isFavorite: (venueId: string) => boolean
  toggleFavorite: (venueId: string, venueName: string) => void
  addFavorite: (venueId: string, venueName: string) => void
  removeFavorite: (venueId: string, venueName: string) => void
  clearFavorites: () => void
  count: number
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites)

  // Persist whenever favorites change
  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  const isFavorite = useCallback(
    (venueId: string) => favorites.has(venueId),
    [favorites]
  )

  const addFavorite = useCallback((venueId: string, venueName: string) => {
    setFavorites(prev => new Set([...prev, venueId]))
    Analytics.favoriteAdded(venueId, venueName)
  }, [])

  const removeFavorite = useCallback((venueId: string, venueName: string) => {
    setFavorites(prev => { const n = new Set(prev); n.delete(venueId); return n })
    Analytics.favoriteRemoved(venueId, venueName)
  }, [])

  const toggleFavorite = useCallback((venueId: string, venueName: string) => {
    setFavorites(prev => {
      const n = new Set(prev)
      if (n.has(venueId)) {
        n.delete(venueId)
        Analytics.favoriteRemoved(venueId, venueName)
      } else {
        n.add(venueId)
        Analytics.favoriteAdded(venueId, venueName)
      }
      return n
    })
  }, [])

  const clearFavorites = useCallback(() => {
    setFavorites(new Set())
  }, [])

  return { favorites, isFavorite, toggleFavorite, addFavorite, removeFavorite, clearFavorites, count: favorites.size }
}
