/**
 * FilterPanel.tsx
 *
 * Self-contained filter UI. Receives callbacks from useFilterState.
 * Renders in a collapsible sheet on mobile, always-visible sidebar on desktop.
 *
 * SECTIONS:
 *   1. Happening Now toggle (prominent)
 *   2. Day of week
 *   3. Time of day (range)
 *   4. Deal type
 *   5. Venue type / categories
 *   6. Neighborhood
 *   7. Price tier
 *   8. Clear all
 */

import React, { useState } from 'react'
import type { FilterState, DayOfWeek, DealType, VenueCategory, PriceTier } from '../types'
import {
  DAYS_OF_WEEK, DEAL_TYPE_LABELS, DEAL_TYPE_COLORS,
  CATEGORY_LABELS, PRICE_TIER_LABELS,
} from '../types'
import type { UseFilterStateReturn } from '../hooks/useFilterState'
import { fmtTime } from '../utils/filters'
import { countLiveNow } from '../utils/happeningNow'
import type { Venue } from '../types'

// ─────────────────────────────────────────────
// TIME PRESETS
// ─────────────────────────────────────────────

interface TimePreset {
  label: string
  start: string
  end: string
}

const TIME_PRESETS: TimePreset[] = [
  { label: 'Lunch',     start: '11:00', end: '14:00' },
  { label: 'Afternoon', start: '14:00', end: '17:00' },
  { label: 'Happy Hour',start: '16:00', end: '19:00' },
  { label: 'Evening',   start: '19:00', end: '22:00' },
  { label: 'Late Night',start: '21:00', end: '00:00' },
]

// ─────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
  bg,
  color,
}: {
  label: string
  active: boolean
  onClick: () => void
  bg?: string
  color?: string
}) {
  return (
    <button
      className={`fp-chip${active ? ' active' : ''}`}
      onClick={onClick}
      style={active && bg ? { background: bg, borderColor: bg, color } : {}}
    >
      {label}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="fp-section-label">{children}</div>
}

// ─────────────────────────────────────────────
// MAIN FILTER PANEL
// ─────────────────────────────────────────────

interface FilterPanelProps extends UseFilterStateReturn {
  venues: Venue[]           // needed for live count + dynamic neighborhood list
  neighborhoods: string[]   // pre-computed from venue list
}

export function FilterPanel({
  filters,
  sort,
  activeCount,
  venues,
  neighborhoods,
  toggleDay,
  toggleDealType,
  toggleCategory,
  toggleNeighborhood,
  togglePriceTier,
  setTimeWindow,
setOpenNow,
  setDogFriendly,
  setSearch,
  clearAll,
}: FilterPanelProps) {
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [timeMode, setTimeMode] = useState<'preset' | 'custom'>('preset')
  const [customStart, setCustomStart] = useState('16:00')
  const [customEnd, setCustomEnd]     = useState('19:00')

  const liveCount = countLiveNow(venues)

  // Categories split into primary (shown by default) and overflow
  const PRIMARY_CATS: VenueCategory[] = [
    'sports_bar','dive_bar','cocktail_bar','restaurant','rooftop','brewery',
  ]
  const ALL_CATS = Object.keys(CATEGORY_LABELS) as VenueCategory[]
  const visibleCats = showAllCategories ? ALL_CATS : PRIMARY_CATS

  function applyTimePreset(preset: TimePreset) {
    setTimeWindow({ start: preset.start, end: preset.end })
  }

  function applyCustomTime() {
    if (customStart && customEnd) {
      setTimeWindow({ start: customStart, end: customEnd })
    }
  }

  const activePreset = filters.timeWindow
    ? TIME_PRESETS.find(p => p.start === filters.timeWindow!.start && p.end === filters.timeWindow!.end)
    : null

  return (
    <div className="filter-panel">
      {/* ── SEARCH ── */}
      <div className="fp-search-row">
        <input
          className="fp-search"
          value={filters.search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search bars, deals, neighborhoods..."
          aria-label="Search"
        />
        {activeCount > 0 && (
          <button className="fp-clear-btn" onClick={clearAll} aria-label="Clear all filters">
            Clear {activeCount > 1 ? `(${activeCount})` : ''}
          </button>
        )}
      </div>

      {/* ── HAPPENING NOW ── */}
      <button
        className={`fp-now-toggle${filters.openNow ? ' active' : ''}`}
        onClick={() => setOpenNow(!filters.openNow)}
        aria-pressed={filters.openNow}
      >
        <span className={`fp-now-dot${filters.openNow ? ' pulse' : ''}`} />
        <span>Happening Now</span>
        {liveCount > 0 && <span className="fp-now-count">{liveCount}</span>}
      </button>

<button
        className={`fp-now-toggle${(filters as any).dogFriendly ? ' active' : ''}`}
        onClick={() => setDogFriendly(!(filters as any).dogFriendly)}
      >
        <span>🐾</span>
        <span>Dog Friendly Only</span>
      </button>
      {/* ── DAY ── */}
      <div className="fp-section">
        <SectionLabel>Day</SectionLabel>
        <div className="fp-chips">
          {DAYS_OF_WEEK.map(d => (
            <FilterChip
              key={d}
              label={d}
              active={filters.days.has(d)}
              onClick={() => toggleDay(d)}
            />
          ))}
        </div>
      </div>

      {/* ── TIME OF DAY ── */}
      <div className="fp-section">
        <SectionLabel>
          Time of day
          {filters.timeWindow && (
            <button
              className="fp-section-clear"
              onClick={() => setTimeWindow(null)}
              aria-label="Clear time filter"
            >✕</button>
          )}
        </SectionLabel>

        <div className="fp-time-toggle">
          <button
            className={`fp-time-mode${timeMode === 'preset' ? ' active' : ''}`}
            onClick={() => setTimeMode('preset')}
          >Presets</button>
          <button
            className={`fp-time-mode${timeMode === 'custom' ? ' active' : ''}`}
            onClick={() => setTimeMode('custom')}
          >Custom</button>
        </div>

        {timeMode === 'preset' ? (
          <div className="fp-chips">
            {TIME_PRESETS.map(p => (
              <FilterChip
                key={p.label}
                label={p.label}
                active={activePreset?.label === p.label}
                onClick={() => activePreset?.label === p.label
                  ? setTimeWindow(null)
                  : applyTimePreset(p)
                }
              />
            ))}
          </div>
        ) : (
          <div className="fp-custom-time">
            <div className="fp-time-inputs">
              <div className="fp-time-input-group">
                <label className="fp-time-label">From</label>
                <input
                  type="time"
                  className="fp-time-input"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
              </div>
              <span className="fp-time-sep">–</span>
              <div className="fp-time-input-group">
                <label className="fp-time-label">To</label>
                <input
                  type="time"
                  className="fp-time-input"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
            <button className="fp-apply-btn" onClick={applyCustomTime}>Apply</button>
          </div>
        )}

        {filters.timeWindow && (
          <div className="fp-active-time">
            Showing deals from {fmtTime(filters.timeWindow.start)} – {fmtTime(filters.timeWindow.end)}
          </div>
        )}
      </div>

      {/* ── DEAL TYPE ── */}
      <div className="fp-section">
        <SectionLabel>Deal type</SectionLabel>
        <div className="fp-chips">
          {(Object.entries(DEAL_TYPE_LABELS) as [DealType, string][]).map(([type, label]) => (
            <FilterChip
              key={type}
              label={label}
              active={filters.dealTypes.has(type)}
              onClick={() => toggleDealType(type)}
              bg={DEAL_TYPE_COLORS[type].bg}
              color={DEAL_TYPE_COLORS[type].text}
            />
          ))}
        </div>
      </div>

      {/* ── VENUE TYPE ── */}
      <div className="fp-section">
        <SectionLabel>Venue type</SectionLabel>
        <div className="fp-chips">
          {visibleCats.map(cat => (
            <FilterChip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              active={filters.categories.has(cat)}
              onClick={() => toggleCategory(cat)}
            />
          ))}
          <button
            className="fp-chip fp-chip-more"
            onClick={() => setShowAllCategories(v => !v)}
          >
            {showAllCategories ? 'Less' : `+${ALL_CATS.length - PRIMARY_CATS.length} more`}
          </button>
        </div>
      </div>

      {/* ── NEIGHBORHOOD ── */}
      {neighborhoods.length > 0 && (
        <div className="fp-section">
          <SectionLabel>Neighborhood</SectionLabel>
          <div className="fp-chips">
            {neighborhoods.map(n => (
              <FilterChip
                key={n}
                label={n}
                active={filters.neighborhoods.has(n)}
                onClick={() => toggleNeighborhood(n)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── PRICE TIER ── */}
      <div className="fp-section">
        <SectionLabel>Price</SectionLabel>
        <div className="fp-chips">
          {(Object.entries(PRICE_TIER_LABELS) as [PriceTier, string][]).map(([tier, label]) => (
            <FilterChip
              key={tier}
              label={`${tier} ${label}`}
              active={filters.priceTiers.has(tier)}
              onClick={() => togglePriceTier(tier)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
