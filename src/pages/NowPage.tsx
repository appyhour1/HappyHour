/**
 * NowPage.tsx
 * Route: /now
 *
 * The simplest possible page: what's open RIGHT NOW.
 * No filters, no setup. Open it, go.
 * This is the link people text friends at 5pm on a Friday.
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAppContext } from '../contexts/AppContext'
import { isVenueActiveNow, getVenueActiveDays } from '../utils/filters'
import { getVenueStatus, getVenuesStartingNext, STATUS_VISUALS } from '../utils/happeningNow'
import { VenueCard } from '../components/VenueCard'
import { Analytics } from '../services/analytics'
import type { Venue } from '../types'

export default function NowPage() {
  const { venues, loading, favorites, city } = useAppContext()
  const [, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

  // Refresh every 60s so status badges stay live
  useEffect(() => {
    Analytics.seoPageViewed('now', city)
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [city])

  const liveNow  = venues.filter(v => isVenueActiveNow(v))
  const upcoming = getVenuesStartingNext(venues, 5)
  const liveCount = liveNow.length

  function handleShare() {
    const url = `${window.location.origin}/now`
    if (navigator.share) {
      navigator.share({
        title: `${liveCount} happy hours happening now in ${city}`,
        text: `Check out what's open right now`,
        url,
      })
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
    }
  }

  return (
    <>
      <Helmet>
        <title>Happy Hour Happening Now in {city} — Live Deals</title>
        <meta name="description" content={`${liveCount} happy hours active right now in ${city}. Live prices and verified deals.`} />
      </Helmet>

      <div className="now-page">

        {/* ── HERO ── */}
        <div className="now-hero">
          <div className={`now-live-badge${liveCount > 0 ? ' active' : ''}`}>
            <span className="now-live-dot" />
            {liveCount > 0 ? `${liveCount} happening now` : 'None active right now'}
          </div>
          <h1 className="now-title">
            {liveCount > 0 ? `Get out there.` : `Nothing open right now.`}
          </h1>
          <p className="now-sub">
            {liveCount > 0
              ? `These happy hours are active right now in ${city}. Updated every minute.`
              : `Check back soon — happy hours typically start at 3–4 PM on weekdays.`
            }
          </p>
          <div className="now-actions">
            <button className="now-share-btn" onClick={handleShare}>
              {copied ? '✓ Link copied!' : '🔗 Share this page'}
            </button>
            <Link to="/crawl" className="now-crawl-btn">🍺 Build a crawl</Link>
          </div>
        </div>

        {/* ── LIVE NOW ── */}
        {loading && <p className="loading-msg">Loading...</p>}

        {!loading && liveCount > 0 && (
          <div className="venue-list">
            {liveNow.map(venue => (
              <VenueCard
                key={venue.id}
                venue={venue}
                isFavorite={favorites.isFavorite(venue.id)}
                onToggleFavorite={favorites.toggleFavorite}
              />
            ))}
          </div>
        )}

        {/* ── STARTING SOON ── */}
        {!loading && upcoming.length > 0 && (
          <div className="now-upcoming">
            <div className="now-upcoming-title">Starting soon</div>
            {upcoming.map(({ venue, status }) => {
              const vis = STATUS_VISUALS[status.status]
              return (
                <Link key={venue.id} to={`/venue/${venue.id}`} className="now-upcoming-row">
                  <div className="now-upcoming-info">
                    <span className="now-upcoming-name">{venue.name}</span>
                    <span className="now-upcoming-hood">{venue.neighborhood}</span>
                  </div>
                  <span
                    className="now-upcoming-badge"
                    style={{ background: vis.bg, color: vis.text }}
                  >
                    {status.badge}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && liveCount === 0 && upcoming.length === 0 && (
          <div className="now-empty">
            <div className="now-empty-icon">🌙</div>
            <p>Happy hours usually run 3–7 PM on weekdays.</p>
            <Link to="/" className="now-browse-link">Browse all venues →</Link>
          </div>
        )}
      </div>
    </>
  )
}
