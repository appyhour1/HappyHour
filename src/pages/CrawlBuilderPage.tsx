/**
 * CrawlBuilderPage.tsx
 * Route: /crawl
 *
 * Bar crawl builder — pick start time, area, stops, get a plan.
 * Generates a shareable link so friends can see the same crawl.
 * Supports ?neighborhood=OTR param from venue detail page "Add to crawl" button.
 */

import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAppContext } from '../contexts/AppContext'
import { buildCrawl, parseCrawlFromUrl, type CrawlPlan, type CrawlStop } from '../utils/crawlBuilder'
import { getNeighborhoods } from '../utils/filters'
import type { DayOfWeek } from '../types'
import { DAYS_OF_WEEK } from '../types'

// ─────────────────────────────────────────────
// TIME OPTIONS
// ─────────────────────────────────────────────

const TIME_OPTIONS = [
  { label: '11:00 AM', value: 11 },
  { label: '12:00 PM', value: 12 },
  { label: '1:00 PM',  value: 13 },
  { label: '2:00 PM',  value: 14 },
  { label: '3:00 PM',  value: 15 },
  { label: '4:00 PM',  value: 16 },
  { label: '5:00 PM',  value: 17 },
  { label: '6:00 PM',  value: 18 },
  { label: '7:00 PM',  value: 19 },
  { label: '8:00 PM',  value: 20 },
]

const RADIUS_OPTIONS = [
  { label: '0.5 mile',  value: 0.5 },
  { label: '1 mile',    value: 1   },
  { label: '2 miles',   value: 2   },
  { label: '5 miles',   value: 5   },
  { label: 'Citywide',  value: 99  },
]

// ─────────────────────────────────────────────
// STOP CARD
// ─────────────────────────────────────────────

function StopCard({ stop, index }: { stop: CrawlStop; index: number }) {
  return (
    <div className="crawl-stop">
      {index > 0 && (
        <div className="crawl-connector">
          {stop.distanceFromPrev && (
            <span className="crawl-distance">{stop.distanceFromPrev} walk</span>
          )}
        </div>
      )}

      <div className="crawl-stop-card">
        <div className="crawl-stop-num">{index + 1}</div>

        <div className="crawl-stop-body">
          <div className="crawl-stop-time">{stop.arrivalTime}</div>

          <Link to={`/venue/${stop.venue.id}`} className="crawl-stop-name">
            {stop.venue.name}
          </Link>

          <div className="crawl-stop-meta">
            {stop.venue.neighborhood}
            {stop.venue.price_tier && <span> · {stop.venue.price_tier}</span>}
            {stop.venue.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.venue.address)}`}
                target="_blank" rel="noopener noreferrer"
                className="crawl-directions-link"
              >
                Directions ↗
              </a>
            )}
          </div>

          {stop.activeDeals && (
            <div className="crawl-stop-deal">
              🍺 {stop.activeDeals}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────

export default function CrawlBuilderPage() {
  const { venues, userLocation, requestLocation } = useAppContext()
  const [searchParams] = useSearchParams()

  // Check for pre-fill from venue detail page
  const prefilledNeighborhood = searchParams.get('neighborhood') || ''

  // Form state
  const [startHour, setStartHour]       = useState(() => {
    // Default to current hour if in happy hour window, otherwise 4 PM
    const h = new Date().getHours()
    return h >= 15 && h < 20 ? h : 16
  })
  const [numStops, setNumStops]         = useState(3)
  const [areaMode, setAreaMode]         = useState<'neighborhood' | 'radius'>(
    prefilledNeighborhood ? 'neighborhood' : 'neighborhood'
  )
  const [neighborhood, setNeighborhood] = useState(prefilledNeighborhood)
  const [radiusMiles, setRadiusMiles]   = useState(1)
  const [dayOfWeek, setDayOfWeek]       = useState<DayOfWeek>(() => {
    const d = new Date().getDay()
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d] as DayOfWeek
  })

  // Result state
  const [plan, setPlan]         = useState<CrawlPlan | null>(null)
  const [copied, setCopied]     = useState(false)
  const [building, setBuilding] = useState(false)

  const neighborhoods = getNeighborhoods(venues)

  // If URL has crawl params (shared crawl), load it
  useEffect(() => {
    if (searchParams.get('v')) {
      const shared = parseCrawlFromUrl(searchParams, venues)
      if (shared) setPlan(shared)
    }
  }, [venues, searchParams])

  // If pre-filled from venue detail, show a friendly hint
  const hasPreFill = !!prefilledNeighborhood && !searchParams.get('v')

  function handleBuild() {
    setBuilding(true)
    setTimeout(() => {
      const result = buildCrawl(venues, {
        startHour,
        numStops,
        neighborhood: areaMode === 'neighborhood' ? neighborhood || null : null,
        radiusMiles: areaMode === 'radius' ? radiusMiles : null,
        userLocation,
        dayOfWeek,
      })
      setPlan(result)
      setBuilding(false)
      setTimeout(() => {
        document.getElementById('crawl-results')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }, 600)
  }

  function handleCopyLink() {
    if (!plan) return
    navigator.clipboard.writeText(plan.shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handleRebuild() {
    setPlan(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Helmet>
        <title>Bar Crawl Builder - Happy Hour Cincinnati</title>
        <meta name="description" content="Build the perfect Cincinnati bar crawl. Pick your start time, area, and number of stops - we find the best happy hour deals along the way." />
      </Helmet>

      <div className="crawl-page">

        {/* ── HERO ── */}
        <div className="crawl-hero">
          <div className="crawl-hero-emoji">🍺</div>
          <h1 className="crawl-hero-title">Bar Crawl Builder</h1>
          <p className="crawl-hero-sub">
            Pick your start time and area — we build the perfect crawl with happy hour deals at every stop.
          </p>
        </div>

        {/* ── BUILDER FORM ── */}
        {!plan && (
          <div className="crawl-form">

            {/* Pre-fill hint */}
            {hasPreFill && (
              <div style={{
                background: '#FFF3E8', border: '1px solid #E85D1A', borderRadius: 10,
                padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#E85D1A', fontWeight: 600,
              }}>
                🍺 Building a crawl around <strong>{prefilledNeighborhood}</strong> — customize below and hit build
              </div>
            )}

            {/* Day */}
            <div className="crawl-field">
              <label className="crawl-label">Day</label>
              <div className="crawl-day-pills">
                {DAYS_OF_WEEK.map(d => (
                  <button
                    key={d}
                    className={`crawl-day-pill${dayOfWeek === d ? ' active' : ''}`}
                    onClick={() => setDayOfWeek(d)}
                    type="button"
                  >{d}</button>
                ))}
              </div>
            </div>

            {/* Start time */}
            <div className="crawl-field">
              <label className="crawl-label">Start time</label>
              <div className="crawl-options">
                {TIME_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    className={`crawl-option${startHour === t.value ? ' active' : ''}`}
                    onClick={() => setStartHour(t.value)}
                    type="button"
                  >{t.label}</button>
                ))}
              </div>
            </div>

            {/* Number of stops */}
            <div className="crawl-field">
              <label className="crawl-label">Number of stops</label>
              <div className="crawl-stop-picker">
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    className={`crawl-stop-btn${numStops === n ? ' active' : ''}`}
                    onClick={() => setNumStops(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="crawl-field-hint">Each stop is ~1 hour apart</p>
            </div>

            {/* Area mode */}
            <div className="crawl-field">
              <label className="crawl-label">Area</label>
              <div className="crawl-mode-toggle">
                <button
                  className={`crawl-mode-btn${areaMode === 'neighborhood' ? ' active' : ''}`}
                  onClick={() => setAreaMode('neighborhood')}
                  type="button"
                >By neighborhood</button>
                <button
                  className={`crawl-mode-btn${areaMode === 'radius' ? ' active' : ''}`}
                  onClick={() => setAreaMode('radius')}
                  type="button"
                >By radius</button>
              </div>

              {areaMode === 'neighborhood' ? (
                <select
                  className="crawl-select"
                  value={neighborhood}
                  onChange={e => setNeighborhood(e.target.value)}
                >
                  <option value="">All neighborhoods</option>
                  {neighborhoods.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <div>
                  {!userLocation && (
                    <button className="crawl-loc-btn" onClick={requestLocation} type="button">
                      📍 Enable location for radius search
                    </button>
                  )}
                  {userLocation && (
                    <div className="crawl-options">
                      {RADIUS_OPTIONS.map(r => (
                        <button
                          key={r.value}
                          className={`crawl-option${radiusMiles === r.value ? ' active' : ''}`}
                          onClick={() => setRadiusMiles(r.value)}
                          type="button"
                        >{r.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Build button */}
            <button
              className="crawl-build-btn"
              onClick={handleBuild}
              disabled={building || (areaMode === 'radius' && !userLocation)}
            >
              {building ? (
                <span className="crawl-building">
                  <span className="cf-spinner" /> Building your crawl...
                </span>
              ) : (
                `Build my ${numStops}-stop crawl 🍺`
              )}
            </button>

            {venues.length < 5 && (
              <p className="crawl-low-data-note">
                Add more venues to get better crawl results.
                <Link to="/" className="crawl-add-link"> Browse all venues →</Link>
              </p>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {plan && (
          <div id="crawl-results" className="crawl-results">

            <div className="crawl-results-header">
              <div className="crawl-results-title">
                Your {plan.stops.length}-stop crawl
              </div>
              <div className="crawl-results-meta">
                Starting at {plan.startTime}
                {plan.neighborhood && ` · ${plan.neighborhood}`}
                {plan.radiusMiles && plan.radiusMiles < 99 && ` · within ${plan.radiusMiles}mi`}
              </div>
            </div>

            <div className="crawl-stops">
              {plan.stops.length === 0 ? (
                <div className="crawl-empty">
                  <p>No venues found with happy hour for those settings.</p>
                  <p>Try a different time, neighborhood, or larger radius.</p>
                  <button className="crawl-retry-btn" onClick={handleRebuild}>Try again</button>
                </div>
              ) : (
                plan.stops.map((stop, i) => (
                  <StopCard key={stop.venue.id} stop={stop} index={i} />
                ))
              )}
            </div>

            {plan.stops.length > 0 && (
              <div className="crawl-actions">
                <button className="crawl-share-btn" onClick={handleCopyLink}>
                  {copied ? '✓ Link copied!' : '🔗 Share this crawl'}
                </button>
                <button className="crawl-rebuild-btn" onClick={handleRebuild}>
                  Build another
                </button>
              </div>
            )}

            {plan.stops.length > 0 && (
              <div className="crawl-tip">
                💡 Happy hour times can change — always verify with the bar before heading out.
                See something wrong? <Link to={`/venue/${plan.stops[0].venue.id}`}>Suggest a correction</Link>.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
