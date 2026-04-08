/**
 * BrowsePage.tsx
 *
 * Main browse experience. Replaces the old App.tsx render.
 * Uses AppContext for venues/favorites, owns its own filter/sort state.
 */

import React, { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAppContext } from '../contexts/AppContext'
import { useFilterState } from '../hooks/useFilterState'
import { useViewMode } from '../hooks/useViewMode'
import { filterVenues, getNeighborhoods, isVenueActiveNow, getVenueActiveDays, distanceMiles, fmtDistance } from '../utils/filters'
import { sortVenuesByMode } from '../utils/scoring'
import { buildBestPicksSections } from '../utils/bestPicks'
import { getVenuesStartingNext, getScheduleStatus, STATUS_VISUALS } from '../utils/happeningNow'
import { Analytics } from '../services/analytics'
import { FilterPanel } from '../components/FilterPanel'
import { SortBar } from '../components/SortBar'
import { MapView } from '../components/MapView'
import { ViewToggle } from '../components/ViewToggle'
import { VenueCard } from '../components/VenueCard'
import { BestPicksRow } from '../components/BestPicksRow'
import type { Venue, HappyHourStatus, ScheduleStatus } from '../types'
import { DAYS_OF_WEEK } from '../types'
import { useNavigate, Link } from 'react-router-dom'

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

export default function BrowsePage() {
  const { venues, loading, error, userLocation, requestLocation, locationPermission, favorites, city } = useAppContext()
  const fs = useFilterState()
  const vm = useViewMode()
  const navigate = useNavigate()

  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [, setTick] = useState(0)
  const venueCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Refresh status badges every minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    Analytics.seoPageViewed('browse', city)
  }, [city])

  const neighborhoods = getNeighborhoods(venues)

  let filtered = sortVenuesByMode(
    filterVenues(venues, fs.filters, userLocation),
    fs.sort,
    userLocation
  )

  if (showFavoritesOnly) {
    filtered = filtered.filter(v => favorites.isFavorite(v.id))
  }

  const bestPicksSections = buildBestPicksSections(venues, userLocation)
  const showBestPicks = !fs.filters.openNow && fs.activeCount === 0 && !showFavoritesOnly

  function handleViewDetails(venueId: string) {
    setSelectedVenueId(venueId)
    if (vm.view === 'map') vm.setView('list')
    setTimeout(() => {
      const el = venueCardRefs.current[venueId]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function getDistanceLabel(venue: Venue): string | undefined {
    if (!userLocation || !venue.latitude || !venue.longitude) return undefined
    return fmtDistance(distanceMiles(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude))
  }

  return (
    <>
      <Helmet>
        <title>Happy Hour {city} — Deals Happening Now</title>
        <meta name="description" content={`Find the best happy hour deals in ${city}. Live prices, verified schedules, and deals happening right now.`} />
      </Helmet>

      <div className="browse-page">
        {/* ── TOP BAR ── */}
        <div className="browse-topbar">
          <div className="browse-topbar-left">
            <button
              className={`mobile-filter-btn${filterOpen ? ' active' : ''}${fs.activeCount > 0 ? ' has-filters' : ''}`}
              onClick={() => setFilterOpen(v => !v)}
            >
              <span>⊟</span> Filters
              {fs.activeCount > 0 && <span className="filter-badge">{fs.activeCount}</span>}
            </button>
            <button
              className={`fav-toggle-btn${showFavoritesOnly ? ' active' : ''}`}
              onClick={() => setShowFavoritesOnly(v => !v)}
            >
              ♥ Saved{favorites.count > 0 && ` (${favorites.count})`}
            </button>
          </div>
         <div className="browse-topbar-right">
          <Link to="/crawl" className="crawl-nav-btn">🍺 Bar Crawl</Link>
          <ViewToggle view={vm.view} onSet={v => { vm.setView(v); Analytics.viewModeChanged(v) }} />
        </div>
        </div>

        {/* ── FILTER PANEL ── */}
        <div className={`filter-panel-wrap${filterOpen ? ' open' : ''}`}>
          <FilterPanel {...fs} venues={venues} neighborhoods={neighborhoods} />
        </div>

        {/* ── SORT BAR ── */}
        <SortBar
          sort={fs.sort}
          onSort={fs.setSort}
          userLocation={userLocation}
          onRequestLocation={requestLocation}
          resultCount={filtered.length}
        />

        {loading && <p className="loading-msg">Loading deals...</p>}
        {error && !loading && <p className="error-msg">Using sample data — {error}</p>}

        {/* ── BEST PICKS (shown when no filters active) ── */}
        {!loading && showBestPicks && bestPicksSections.length > 0 && (
          <div className="best-picks-area">
            {bestPicksSections.map(section => (
              <BestPicksRow
                key={section.id}
                section={section}
                favorites={favorites}
                userLocation={userLocation}
              />
            ))}
            <div className="all-venues-divider">
              <span>All venues ({filtered.length})</span>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {!loading && (
          <div className={`content-area${vm.isSplit ? ' split' : ''}`}>
            {vm.isMap && (
              <div className="map-panel">
                <MapView
                  venues={filtered}
                  selectedVenueId={selectedVenueId}
                  onSelectVenue={setSelectedVenueId}
                  onViewDetails={handleViewDetails}
                  userLocation={userLocation}
                />
              </div>
            )}

            {vm.isList && (
              <div className="venue-list">
                {filtered.length === 0 ? (
                  <div className="hn-empty">
                    <div className="hn-empty-icon">{showFavoritesOnly ? '♥' : '🍺'}</div>
                    <div className="hn-empty-title">
                      {showFavoritesOnly ? 'No saved venues yet' : 'No matches'}
                    </div>
                    <div className="hn-empty-sub">
                      {showFavoritesOnly
                        ? 'Tap the heart on any venue to save it here.'
                        : 'Try adjusting your filters or check back later.'
                      }
                    </div>
                    {!showFavoritesOnly && (
                      <button className="hn-empty-btn" onClick={fs.clearAll}>Clear filters</button>
                    )}
                  </div>
                ) : filtered.map(venue => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    isFavorite={favorites.isFavorite(venue.id)}
                    onToggleFavorite={favorites.toggleFavorite}
                    isSelected={selectedVenueId === venue.id}
                    distanceLabel={getDistanceLabel(venue)}
                    cardRef={el => { venueCardRefs.current[venue.id] = el }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
