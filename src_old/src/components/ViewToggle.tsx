/**
 * ViewToggle.tsx
 *
 * List / Map / Split toggle. Split only shows on desktop.
 * Uses text labels + accessible aria-pressed.
 */

import React from 'react'
import type { ViewMode } from '../hooks/useViewMode'

interface ViewToggleProps {
  view: ViewMode
  onSet: (v: ViewMode) => void
}

export function ViewToggle({ view, onSet }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="View mode">
      <button
        className={`vt-btn${view === 'list' ? ' active' : ''}`}
        onClick={() => onSet('list')}
        aria-pressed={view === 'list'}
        title="List view"
      >
        <ListIcon />
        <span>List</span>
      </button>
      <button
        className={`vt-btn${view === 'map' ? ' active' : ''}`}
        onClick={() => onSet('map')}
        aria-pressed={view === 'map'}
        title="Map view"
      >
        <MapIcon />
        <span>Map</span>
      </button>
      <button
        className={`vt-btn vt-split-btn${view === 'split' ? ' active' : ''}`}
        onClick={() => onSet('split')}
        aria-pressed={view === 'split'}
        title="Split view (desktop)"
      >
        <SplitIcon />
        <span>Split</span>
      </button>
    </div>
  )
}

// Inline SVG icons — no icon library needed
function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor"/>
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1C4.8 1 3 2.8 3 5c0 3.5 4 8 4 8s4-4.5 4-8c0-2.2-1.8-4-4-4z" fill="currentColor"/>
      <circle cx="7" cy="5" r="1.5" fill="white"/>
    </svg>
  )
}

function SplitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="5" height="12" rx="1" fill="currentColor"/>
      <rect x="8" y="1" width="5" height="12" rx="1" fill="currentColor" opacity="0.5"/>
    </svg>
  )
}
