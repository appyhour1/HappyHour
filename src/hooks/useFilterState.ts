/**
 * useFilterState.ts
 *
 * Single hook that owns filter state, sort mode, and URL sync.
 *
 * WHY A HOOK:
 * - Keeps App.tsx clean — App just calls useFilterState() and gets everything it needs
 * - URL sync logic is isolated here, not scattered across components
 * - Makes it trivial to reset, toggle, or read filter state from anywhere
 *
 * STATE ARCHITECTURE:
 * - filters + sort live in React state (fast, local, drives render)
 * - URL is a derived side-effect (updated on every change via replaceState)
 * - On mount, URL is parsed to hydrate initial state (enables shareable links)
 *
 * WHAT LIVES HERE vs ELSEWHERE:
 * - Here: filter values, sort mode, URL sync, toggle helpers, clear
 * - App.tsx: venues data, loading, modal state, save/delete actions
 * - FilterPanel: renders the filter UI, calls callbacks from this hook
 *
 * DEFAULT SORT: 'featured'
 * - Featured venues always appear first (paid placement)
 * - Remaining venues sorted alphabetically via scoring.ts 'featured' mode
 * - Switch to 'best_match' when engagement data (upvotes, confirmations) is meaningful
 */

import { useState, useEffect, useCallback } from 'react'
import type { FilterState, SortMode, DayOfWeek, DealType, VenueCategory, PriceTier, TimeWindow } from '../types'
import { DEFAULT_FILTERS } from '../types'
import { filtersToParams, paramsToFilters, countActiveFilters, isDefaultState } from '../utils/filterUrl'

export interface UseFilterStateReturn {
  filters: FilterState
  sort: SortMode
  activeCount: number
  isDefault: boolean

  // Setters
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  toggleDay: (day: DayOfWeek) => void
  toggleDealType: (t: DealType) => void
  toggleCategory: (c: VenueCategory) => void
  toggleNeighborhood: (n: string) => void
  togglePriceTier: (p: PriceTier) => void
  setTimeWindow: (tw: TimeWindow | null) => void
  setOpenNow: (on: boolean) => void
  setDogFriendly: (df: boolean) => void
  setSearch: (q: string) => void
  setSort: (mode: SortMode) => void
  clearAll: () => void
}

// Default sort: featured first, then alphabetical
const DEFAULT_SORT: SortMode = 'featured'

function defaultFiltersWithToday(): FilterState {
  return { ...DEFAULT_FILTERS }
}

export function useFilterState(): UseFilterStateReturn {
  // ── INITIAL STATE from URL (enables shareable links) ──
  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.toString() === '') return defaultFiltersWithToday()
      const { filters: parsed } = paramsToFilters(params)
      return parsed
    } catch {
      return defaultFiltersWithToday()
    }
  })

  const [sort, setSort] = useState<SortMode>(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.toString() === '') return DEFAULT_SORT
      const { sort: parsed } = paramsToFilters(params)
      return parsed
    } catch {
      return DEFAULT_SORT
    }
  })

  // ── SYNC STATE → URL ──
  // Uses replaceState so the browser back button isn't flooded
  useEffect(() => {
    try {
      const params = filtersToParams(filters, sort)
      const newSearch = params.toString()
      const currentSearch = window.location.search.replace(/^\?/, '')
      if (newSearch !== currentSearch) {
        window.history.replaceState(null, '', newSearch ? `?${newSearch}` : window.location.pathname)
      }
    } catch {
      // silently ignore — URL sync is best-effort
    }
  }, [filters, sort])

  // ── GENERIC SETTER ──
  const setFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(f => ({ ...f, [key]: value }))
  }, [])

  // ── SET TOGGLE HELPER (for Set-based filters) ──
  function toggleInSet<T>(
    key: keyof FilterState,
    val: T
  ) {
    setFilters(f => {
      const current = f[key] as Set<T>
      const next = new Set(current)
      next.has(val) ? next.delete(val) : next.add(val)
      return { ...f, [key]: next }
    })
  }

  // ── CLEAR ALL ──
  // Resets to default sort (featured) not best_match
  const clearAll = useCallback(() => {
    setFilters(defaultFiltersWithToday())
    setSort(DEFAULT_SORT)
  }, [])

  return {
    filters,
    sort,
    activeCount: countActiveFilters(filters, sort),
    isDefault: isDefaultState(filters, sort),

    setFilter,
    toggleDay:          (d) => toggleInSet<DayOfWeek>('days', d),
    toggleDealType:     (t) => toggleInSet<DealType>('dealTypes', t),
    toggleCategory:     (c) => toggleInSet<VenueCategory>('categories', c),
    toggleNeighborhood: (n) => toggleInSet<string>('neighborhoods', n),
    togglePriceTier:    (p) => toggleInSet<PriceTier>('priceTiers', p),
    setTimeWindow:      (tw) => setFilter('timeWindow', tw),
    setOpenNow:         (on) => setFilter('openNow', on),
    setDogFriendly:     (df: boolean) => setFilter('dogFriendly' as any, df),
    setSearch:          (q)  => setFilter('search', q),
    setSort,
    clearAll,
  }
}
