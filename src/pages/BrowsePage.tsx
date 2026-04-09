import React, { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { useFilterState } from '../hooks/useFilterState'
import { useViewMode } from '../hooks/useViewMode'
import { filterVenues, getNeighborhoods, isVenueActiveNow, distanceMiles, fmtDistance } from '../utils/filters'
import { sortVenuesByMode } from '../utils/scoring'
import { buildBestPicksSections } from '../utils/bestPicks'
import { Analytics } from '../services/analytics'
import { FilterPanel } from '../components/FilterPanel'
import { SortBar } from '../components/SortBar'
import { MapView } from '../components/MapView'
import { ViewToggle } from '../components/ViewToggle'
import { VenueCard } from '../components/VenueCard'
import { BestPicksRow } from '../components/BestPicksRow'
import { EmailCapture, useEmailCapture } from '../components/EmailCapture'
import type { Venue } from '../types'

function BrowseHero({ venues, city }: { venues: Venue[]; city: string }) {
  const liveCount = venues.filter(v => isVenueActiveNow(v)).length
  const totalDeals = venues.reduce((acc, v) => acc + (v.schedules?.length ?? 0), 0)
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return !!sessionStorage.getItem('hh_hero_collapsed') } catch { return false }
  })

  function collapse() {
    setCollapsed(true)
    try { sessionStorage.setItem('hh_hero_collapsed', '1') } catch {}
  }

  if (collapsed) {
    return (
      <div className="browse-hero browse-hero--compact">
        <div className="browse-hero-compact-row">
          <span className="browse-hero-compact-title">Happy Hour in {city}</span>
          {liveCount > 0 && (
            <Link to="/now" className="browse-hero-live">
              <span className="browse-hero-dot" />
              {liveCount} live now
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="browse-hero">
      <div className="browse-hero-content">
        <div className="browse-hero-header">
          <h1 className="browse-hero-title">Happy Hour in {city}</h1>
          <button className="browse-hero-collapse" onClick={collapse} title="Collapse">✕</button>
        </div>
        <p className="browse-hero-sub">
          Real deals, verified by the community. Updated in real time.
        </p>
        <div className="browse-hero-stats">
          {liveCount > 0 && (
            <Link to="/now" className="browse-hero-live">
              <span className="browse-hero-dot" />
              {liveCount} happening now
            </Link>
          )}
          <span className="browse-hero-stat">{venues.length} venues</span>
          <span className="browse-hero-stat">{totalDeals} deal schedules</span>
        </div>
      </div>
    </div>
  )
}

export default function BrowsePage() {
  const { venues, loading, error, userLocation, requestLocation, favorites, city } = useAppContext()
  const fs = useFilterState()
  const vm = useViewMode()

  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [, setTick] = useState(0)
  const venueCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { showCapture, trigger, dismiss: dismissEmail } = useEmailCapture(favorites.count)

  useEffect(() => {
    const hour = new Date().getHours()
    const isHappyHourTime = hour >= 15 && hour < 21
    if (isHappyHourTime && fs.activeCount === 0 && !fs.filters.openNow) {
      const key = 'hh_smart_default_applied'
      if (!sessionStorage.getItem(key)) {
        fs.setOpenNow(true)
        sessionStorage.setItem(key, '1')
      }
    }
  }, []) // eslint-disable-line

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
  const showBestPicks = !showFavoritesOnly

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
        <title>Happy Hour {city} - Deals Happening Now</title>
        <meta name="description" content={`Find the best happy hour deals in ${city}. Live prices, verified schedules, and deals happening right now.`} />
      </Helmet>

      <div className="browse-page">
        <BrowseHero venues={venues} city={city} />

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
            <Link to="/crawl" className="crawl-nav-btn">🍺 Build a Crawl</Link>
            <ViewToggle view={vm.view} onSet={v => { vm.setView(v); Analytics.viewModeChanged(v) }} />
          </div>
        </div>

        <div className={`filter-panel-wrap${filterOpen ? ' open' : ''}`}>
          <FilterPanel {...fs} venues={venues} neighborhoods={neighborhoods} />
        </div>

        <SortBar
          sort={fs.sort}
          onSort={fs.setSort}
          userLocation={userLocation}
          onRequestLocation={requestLocation}
          resultCount={filtered.length}
        />

        {loading && <p className="loading-msg">Loading deals...</p>}
        {error && !loading && <p className="error-msg">Using sample data - {error}</p>}

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

        {showCapture && (
          <EmailCapture trigger={trigger} city={city} onDismiss={dismissEmail} />
        )}
      </div>
    </>
  )
}
