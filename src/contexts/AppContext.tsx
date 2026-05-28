/**
 * AppContext.tsx
 *
 * Shared state available to every page/component without prop drilling.
 * Wraps the entire app in index.tsx.
 *
 * WHAT LIVES HERE vs ELSEWHERE:
 * - Here: venues (global data), userLocation, favorites, loading state
 * - Individual pages: their own filter state, sort mode, selected venue
 * - Reason: venues are fetched once and shared. Filter state is per-page.
 *
 * CACHING:
 * - Venue data is cached in sessionStorage via venueCache (5-minute TTL)
 * - Normal navigation: instant, no DB hit
 * - Pull-to-refresh: bypasses cache, forces fresh fetch
 * - City change: always fetches fresh data for the new city
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Venue, UserLocation } from '../types'
import { getVenues } from '../services/venueService'
import { cachedGetVenues, invalidateVenueCache } from '../utils/venueCache'
import { useFavorites, type UseFavoritesReturn } from '../hooks/useFavorites'
import { Analytics, initAnalytics } from '../services/analytics'

// ─────────────────────────────────────────────
// CONTEXT TYPE
// ─────────────────────────────────────────────

interface AppContextValue {
  // Venues
  venues: Venue[]
  loading: boolean
  error: string | null
  refetchVenues: () => void

  // Location
  userLocation: UserLocation | null
  requestLocation: () => void
  locationPermission: 'unknown' | 'granted' | 'denied'

  // Favorites
  favorites: UseFavoritesReturn

  // City
  city: string
  setCity: (c: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [city, setCity] = useState('Cincinnati')

  const favorites = useFavorites()

  // Init analytics once
  useEffect(() => {
    initAnalytics()
    Analytics.appOpened()
  }, [])

  // FIX: wrap in useCallback so the function reference is stable across renders.
  // Previously fetchVenues was a plain async function — a new reference every render.
  // usePullToRefresh has refetchVenues in its useEffect deps, so the unstable
  // reference caused touch listeners to re-register on every render.
  //
  // forceRefresh=true: invalidates venueCache and fetches fresh from Supabase
  // forceRefresh=false (default): uses sessionStorage cache if fresh (< 5 min old)
  const fetchVenues = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await cachedGetVenues(city, getVenues, forceRefresh)
      setVenues(data)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [city])

  // Fetch when city changes — always force fresh so we don't serve
  // a cached list for the wrong city
  useEffect(() => {
    fetchVenues(true)
  }, [fetchVenues])

  // refetchVenues is what pull-to-refresh calls — always forces a fresh fetch
  const refetchVenues = useCallback(() => {
    fetchVenues(true)
  }, [fetchVenues])

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermission('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: 'gps',
          label: 'Your location',
        })
        setLocationPermission('granted')
      },
      () => setLocationPermission('denied')
    )
  }, [])

  return (
    <AppContext.Provider value={{
      venues, loading, error, refetchVenues,
      userLocation, requestLocation, locationPermission,
      favorites,
      city, setCity,
    }}>
      {children}
    </AppContext.Provider>
  )
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
