import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { useFilterState } from '../hooks/useFilterState'
import { useViewMode } from '../hooks/useViewMode'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
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
import { SponsoredBanner } from '../components/SponsoredBanner'
import type { BrandAd } from '../components/SponsoredBanner'
import { getActiveBrandAds } from '../services/brandAdService'
import type { Venue } from '../types'

// ─── TIME-AWARE HERO ────────────────────────────────────────────────────────

function BrowseHero({ venues, city }: { venues: Venue[]; city: string }) {
  const now = new Date()
  const hour = now.getHours()
  const currentMins = hour * 60 + now.getMinutes()

  const liveCount = venues.filter(v => isVenueActiveNow(v)).length
  const totalDeals = venues.reduce((acc, v) => acc + (v.schedules?.length ?? 0), 0)

  // Venues starting within 90 minutes
  const startingSoonCount = venues.filter(v =>
    (v.schedules ?? []).some(s => {
      const [sh, sm] = s.start_time.split(':').map(Number)
      const minsUntil = (sh * 60 + (sm || 0)) - currentMins
      return minsUntil > 0 && minsUntil <= 90
    })
  ).length

  // Next happy hour start across all venues
  const nextStart = (() => {
    let earliest = Infinity
    venues.forEach(v => {
      ;(v.schedules ?? []).forEach(s => {
        const [sh, sm] = s.start_time.split(':').map(Number)
        const minsUntil = (sh * 60 + (sm || 0)) - currentMins
        if (minsUntil > 0 && minsUntil < earliest) earliest = minsUntil
      })
    })
    if (earliest === Infinity) return null
    const h = Math.floor(earliest / 60)
    const m = earliest % 60
    if (h === 0) return `${m}m`
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  })()

  // Hero content based on time of day
  let bigNumber: number
  let bigLabel: string
  let subLabel: string
  let ctaLabel: string
  let ctaPath: string

  if (liveCount > 0) {
    bigNumber = liveCount
    bigLabel = `bar${liveCount !== 1 ? 's' : ''} open right now`
    subLabel = `Happy hour is happening in ${city}`
    ctaLabel = `See all ${liveCount} open now →`
    ctaPath = '/now'
  } else if (startingSoonCount > 0) {
    bigNumber = startingSoonCount
    bigLabel = `spot${startingSoonCount !== 1 ? 's' : ''} starting soon`
    subLabel = nextStart ? `Happy hour kicks off in ${nextStart}` : `Coming up soon in ${city}`
    ctaLabel = 'See what\'s starting →'
    ctaPath = '/tonight'
  } else if (nextStart) {
    bigNumber = venues.length
    bigLabel = `happy hour spots in ${city}`
    subLabel = `Next happy hour starts in ${nextStart}`
    ctaLabel = 'See tonight\'s deals →'
    ctaPath = '/tonight'
  } else {
    bigNumber = venues.length
    bigLabel = `happy hour spots in ${city}`
    subLabel = `${totalDeals} deals — updated daily`
    ctaLabel = 'Browse all venues →'
    ctaPath = '/'
  }

  return (
    <div className="browse-hero-card">
      <div className="browse-hero-orb1" />
      <div className="browse-hero-orb2" />
      {liveCount > 0 && (
        <div className="browse-hero-label">
          <span className="browse-hero-live-dot" />
          Right now in {city}
        </div>
      )}
      <div className="browse-hero-number">{bigNumber}</div>
      <div className="browse-hero-sub">{bigLabel}</div>
      {subLabel && (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12, marginTop: -4 }}>
          {subLabel}
        </div>
      )}
      <div className="browse-hero-actions">
        <Link to={ctaPath} className="browse-hero-btn">{ctaLabel}</Link>
        <div className="browse-hero-stats">
          <span className="browse-hero-stat">{venues.length} venues</span>
          <span className="browse-hero-stat-dot">·</span>
          <span className="browse-hero-stat">{totalDeals} schedules</span>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const { venues, loading, error, userLocation, requestLocation, favorites, city, refetchVenues } = useAppContext()
  const fs = useFilterState()
  const vm = useViewMode()
  const { refreshing } = usePullToRefresh(refetchVenues)

  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [brandAds, setBrandAds] = useState<BrandAd[]>([])
  const adOffset = useRef(Math.floor(Math.random() * 100))
  const [tick, setTick] = useState(0)
  const venueCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { showCapture, trigger, dismiss: dismissEmail } = useEmailCapture(favorites.count)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000)
    getActiveBrandAds().then(setBrandAds)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    Analytics.seoPageViewed('browse', city)
    Analytics.pageVisited('browse')
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
  const isSearching = fs.filters.search.trim().length > 0
  const showBestPicks = !showFavoritesOnly && !isSearching

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
        <title>Happy Hour Unlocked {city} - Happy Hour Deals Happening Now</title>
        <meta name="description" content={`Happy Hour Unlocked — Find the best happy hour deals in ${city}. Live prices, verified schedules, and deals happening right now.`} />
      </Helmet>

      <div className="browse-page">

        <BrowseHero venues={venues} city={city} />

        {refreshing && (
          <div className="ptr-indicator">
            <span className="ptr-spinner" />
            Refreshing deals...
          </div>
        )}

        {/* Search */}
        <div className="browse-search-bar">
          <div className="browse-search-icon">🔍</div>
          <input
            className="browse-search-input"
            value={fs.filters.search}
            onChange={e => {
              fs.setSearch(e.target.value)
              if (e.target.value.trim()) {
                setTimeout(() => {
                  const el = document.querySelector('.venue-list')
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
              }
            }}
            placeholder="Search bars, deals, neighborhoods..."
            aria-label="Search"
          />
          {fs.filters.search && (
            <button className="browse-search-clear" onClick={() => fs.setSearch('')}>✕</button>
          )}
        </div>

        {/* Top bar */}
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

        {/* Open Now indicator — shown when auto-enabled */}
        {fs.filters.openNow && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', background: '#DCFCE7', borderRadius: 10,
            margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#166534',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            Showing open now only
            <button
              onClick={() => fs.setOpenNow(false)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#166534', fontWeight: 700 }}
            >
              Show all ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className={`filter-panel-wrap${filterOpen ? ' open' : ''}`}>
          <FilterPanel {...fs} venues={venues} neighborhoods={neighborhoods} />
        </div>

        {/* Sort */}
        <SortBar
          sort={fs.sort}
          onSort={fs.setSort}
          userLocation={userLocation}
          onRequestLocation={requestLocation}
          resultCount={filtered.length}
        />

        {loading && <p className="loading-msg">Loading deals...</p>}
        {error && !loading && <p className="error-msg">Using sample data - {error}</p>}

        {/* Best picks */}
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

        {/* Venue list */}
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
                        : fs.filters.openNow
                          ? 'No happy hours open right now. Try removing the "open now" filter to see all venues.'
                          : 'Try adjusting your filters or check back later.'
                      }
                    </div>
                    {!showFavoritesOnly && (
                      <button className="hn-empty-btn" onClick={fs.clearAll}>Clear filters</button>
                    )}
                  </div>
                ) : filtered.flatMap((venue, i) => {
                  const nodes: React.ReactNode[] = [
                    <VenueCard
                      key={venue.id}
                      venue={venue}
                      isFavorite={favorites.isFavorite(venue.id)}
                      onToggleFavorite={favorites.toggleFavorite}
                      isSelected={selectedVenueId === venue.id}
                      distanceLabel={getDistanceLabel(venue)}
                      cardRef={el => { venueCardRefs.current[venue.id] = el }}
                    />
                  ]
                  if (brandAds.length > 0 && (i + 1) % 4 === 0) {
                    const slotIndex = Math.floor(i / 4)
                    const adIndex = (slotIndex + adOffset.current + tick) % brandAds.length
                    if (slotIndex < brandAds.length) {
                      const ad = brandAds[adIndex]
                      nodes.push(<SponsoredBanner key={`ad-${i}-${tick}`} ad={ad} />)
                    }
                  }
                  return nodes
                })}
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
