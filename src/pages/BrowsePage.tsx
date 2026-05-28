import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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

// ─── PAGINATION CONSTANTS ────────────────────────────────────────────────────
// Why: Rendering 200 VenueCards simultaneously creates 200 IntersectionObservers,
// 200 refs, and heavy initial paint. Showing 30 at a time keeps the DOM lean
// with no UX cost — users rarely scroll past 30 results.
const INITIAL_PAGE_SIZE = 30
const LOAD_MORE_SIZE = 20

// ─── ROTATING AD ────────────────────────────────────────────────────────────
// Self-contained: manages its own rotation so BrowsePage never re-renders
// from the timer. Each slot staggers its offset so ads don't all rotate at once.

interface RotatingAdProps {
  ads: BrandAd[]
  slotIndex: number
}

const RotatingAd = React.memo(function RotatingAd({ ads, slotIndex }: RotatingAdProps) {
  const [adIndex, setAdIndex] = useState(() => slotIndex % ads.length)

  useEffect(() => {
    if (ads.length <= 1) return
    const id = setInterval(() => setAdIndex(i => (i + 1) % ads.length), 15_000)
    return () => clearInterval(id)
  }, [ads.length])

  const ad = ads[adIndex]
  if (!ad) return null
  return <SponsoredBanner ad={ad} />
})

// ─── TIME-AWARE HERO ────────────────────────────────────────────────────────
// Memoized separately so it doesn't re-render when filter state changes

const BrowseHero = React.memo(function BrowseHero({ venues, city }: { venues: Venue[]; city: string }) {
  const now = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const todayAbbr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]

  const liveCount = useMemo(() => venues.filter(v => isVenueActiveNow(v)).length, [venues])
  const totalDeals = useMemo(() => venues.reduce((acc, v) => acc + (v.schedules?.length ?? 0), 0), [venues])

  const startingSoonCount = useMemo(() => venues.filter(v =>
    (v.schedules ?? []).some(s => {
      if (!s.days.includes(todayAbbr as any)) return false
      const [sh, sm] = s.start_time.split(':').map(Number)
      const minsUntil = (sh * 60 + (sm || 0)) - currentMins
      return minsUntil > 0 && minsUntil <= 90
    })
  ).length, [venues, todayAbbr, currentMins])

  const nextStart = useMemo(() => {
    let earliest = Infinity
    venues.forEach(v => {
      ;(v.schedules ?? []).forEach(s => {
        if (!s.days.includes(todayAbbr as any)) return
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
  }, [venues, todayAbbr, currentMins])

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
    ctaLabel = "See what's starting →"
    ctaPath = '/tonight'
  } else if (nextStart) {
    bigNumber = venues.length
    bigLabel = `happy hour spots in ${city}`
    subLabel = `Next happy hour starts in ${nextStart}`
    ctaLabel = "See tonight's deals →"
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
})

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
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE)
  const venueCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { showCapture, trigger, dismiss: dismissEmail } = useEmailCapture(favorites.count)

  useEffect(() => {
    getActiveBrandAds().then(setBrandAds)
  }, [])

  useEffect(() => {
    Analytics.seoPageViewed('browse', city)
    Analytics.pageVisited('browse')
  }, [city])

  // Reset pagination when filters change — avoid stale "Load more" state
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE)
  }, [fs.filters, showFavoritesOnly])

  // Memoize expensive computations so they don't re-run on every render
  const neighborhoods = useMemo(() => getNeighborhoods(venues), [venues])

  const filtered = useMemo(() => {
    let result = sortVenuesByMode(
      filterVenues(venues, fs.filters, userLocation),
      fs.sort,
      userLocation
    )
    if (showFavoritesOnly) {
      result = result.filter(v => favorites.isFavorite(v.id))
    }
    return result
  }, [venues, fs.filters, fs.sort, userLocation, showFavoritesOnly, favorites])

  const bestPicksSections = useMemo(
    () => buildBestPicksSections(venues, userLocation),
    [venues, userLocation]
  )

  // Only render up to visibleCount cards — key to keeping DOM lean
  const visibleVenues = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  )

  const hasMore = visibleCount < filtered.length
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

  // Stable callback to avoid re-creating per venue
  const getDistanceLabel = useCallback((venue: Venue): string | undefined => {
    if (!userLocation || !venue.latitude || !venue.longitude) return undefined
    return fmtDistance(distanceMiles(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude))
  }, [userLocation])

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

        {/* Open Now indicator */}
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

        {/* Best picks — memoized, only recalculates when venues or location changes */}
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
                ) : (
                  <>
                    {visibleVenues.flatMap((venue, i) => {
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

                      // Ad every 4th venue — RotatingAd manages its own timer
                      // so this never triggers a BrowsePage re-render
                      if (brandAds.length > 0 && (i + 1) % 4 === 0) {
                        const slotIndex = Math.floor(i / 4)
                        nodes.push(
                          <RotatingAd
                            key={`ad-slot-${slotIndex}`}
                            ads={brandAds}
                            slotIndex={slotIndex}
                          />
                        )
                      }

                      return nodes
                    })}

                    {/* Load more — only renders when results exceed INITIAL_PAGE_SIZE */}
                    {hasMore && (
                      <button
                        onClick={() => setVisibleCount(c => c + LOAD_MORE_SIZE)}
                        style={{
                          width: '100%', marginTop: 8, padding: '14px',
                          background: '#F8F6F1', border: '2px solid #1A1612',
                          borderRadius: 12, fontSize: 14, fontWeight: 700,
                          color: '#1A1612', cursor: 'pointer',
                        }}
                      >
                        Load {Math.min(LOAD_MORE_SIZE, filtered.length - visibleCount)} more
                        <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>
                          ({visibleCount} of {filtered.length})
                        </span>
                      </button>
                    )}
                  </>
                )}
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
