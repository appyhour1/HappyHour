/**
 * SortBar.tsx
 *
 * Sort controls. Horizontally scrollable on mobile.
 * "Closest" shows a location prompt if no GPS yet.
 */

import React from 'react'
import type { SortMode, UserLocation } from '../types'
import { SORT_LABELS } from '../types'

const SORT_MODES: SortMode[] = [
  'best_match',
  'starting_soon',
  'cheapest',
  'closest',
  'most_popular',
  'featured',
]

interface SortBarProps {
  sort: SortMode
  onSort: (mode: SortMode) => void
  userLocation: UserLocation | null
  onRequestLocation?: () => void
  resultCount: number
}

export function SortBar({
  sort,
  onSort,
  userLocation,
  onRequestLocation,
  resultCount,
}: SortBarProps) {
  function handleSort(mode: SortMode) {
    if (mode === 'closest' && !userLocation && onRequestLocation) {
      onRequestLocation()
      return
    }
    onSort(mode)
  }

  return (
    <div className="sort-bar">
      <div className="sort-bar-inner">
        {SORT_MODES.map(mode => {
          const needsGps = mode === 'closest' && !userLocation
          return (
            <button
              key={mode}
              className={`sort-chip${sort === mode ? ' active' : ''}${needsGps ? ' needs-gps' : ''}`}
              onClick={() => handleSort(mode)}
              title={needsGps ? 'Enable location to sort by distance' : undefined}
            >
              {SORT_LABELS[mode]}
              {needsGps && <span className="sort-gps-icon">📍</span>}
            </button>
          )
        })}
      </div>
      <div className="sort-result-count">
        {resultCount} venue{resultCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
