/**
 * SeoLandingPage.tsx
 * Routes: /cincinnati, /cincinnati/otr, /cincinnati/cocktails, etc.
 *
 * Handles: city pages, neighborhood pages, category pages.
 * Real content, not thin doorway pages — each shows actual filtered venues.
 */

import React, { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAppContext } from '../contexts/AppContext'
import { filterVenues, isVenueActiveNow } from '../utils/filters'
import { VenueCard } from '../components/VenueCard'
import { Analytics } from '../services/analytics'
import type { VenueCategory } from '../types'
import { CATEGORY_LABELS } from '../types'

// ─────────────────────────────────────────────
// PAGE CONFIGS
// ─────────────────────────────────────────────

interface PageConfig {
  title: string
  h1: string
  description: string
  intro: string
  filterNeighborhood?: string
  filterCategory?: VenueCategory
  filterOpenNow?: boolean
}

function buildPageConfig(city: string, slug?: string): PageConfig | null {
  const cityTitle = city.charAt(0).toUpperCase() + city.slice(1)

  if (!slug) {
    return {
      title: `Best Happy Hour in ${cityTitle} — Verified Deals`,
      h1: `Happy Hour in ${cityTitle}`,
      description: `Find the best happy hour deals in ${cityTitle}. Live drink specials, food deals, and verified schedules updated by the community.`,
      intro: `${cityTitle} has some of the best happy hour deals in the region. From $2 drafts in dive bars to craft cocktails at upscale lounges, we track them all. Deals are community-verified and updated regularly.`,
    }
  }

  // Category slugs
  const categoryMap: Record<string, VenueCategory> = {
    cocktails: 'cocktail_bar',
    rooftop: 'rooftop',
    'dive-bars': 'dive_bar',
    'sports-bars': 'sports_bar',
    breweries: 'brewery',
    restaurants: 'restaurant',
    'wine-bars': 'wine_bar',
    'date-night': 'date_night',
    'live-music': 'live_music',
  }

  if (slug === 'happening-now') {
    return {
      title: `Happy Hour Happening Now in ${cityTitle}`,
      h1: `Happening Now in ${cityTitle}`,
      description: `Live happy hour deals active right now in ${cityTitle}. Updated in real time.`,
      intro: `These happy hours are active right now. Grab your keys.`,
      filterOpenNow: true,
    }
  }

  if (slug === 'cheap-drinks') {
    return {
      title: `Cheap Drinks & Happy Hour in ${cityTitle} — Under $5`,
      h1: `Cheap Drinks in ${cityTitle}`,
      description: `Best cheap drink deals in ${cityTitle}. Find $2 beers, $3 wells, and deals under $5.`,
      intro: `${cityTitle}'s best deals for budget-conscious drinkers. We highlight the cheapest verified happy hour specials so you always know where your dollar goes furthest.`,
    }
  }

  const cat = categoryMap[slug]
  if (cat) {
    const catLabel = CATEGORY_LABELS[cat]
    return {
      title: `${catLabel} Happy Hour in ${cityTitle} — Best Deals`,
      h1: `${catLabel} Happy Hour in ${cityTitle}`,
      description: `Best ${catLabel.toLowerCase()} happy hour deals in ${cityTitle}. Verified schedules and drink specials.`,
      intro: `Looking for ${catLabel.toLowerCase()} happy hours in ${cityTitle}? We've got verified deals with real prices and times so you can plan your night with confidence.`,
      filterCategory: cat,
    }
  }

  // Assume it's a neighborhood slug
  const neighborhood = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return {
    title: `Happy Hour in ${neighborhood}, ${cityTitle} — Best Deals`,
    h1: `Happy Hour in ${neighborhood}`,
    description: `Find the best happy hour deals in ${neighborhood}, ${cityTitle}. Verified schedules, real prices.`,
    intro: `${neighborhood} is one of ${cityTitle}'s best neighborhoods for happy hour. Here are all the verified deals in the area.`,
    filterNeighborhood: neighborhood,
  }
}

// ─────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────

export default function SeoLandingPage() {
  const { city = 'cincinnati', slug } = useParams<{ city: string; slug?: string }>()
  const { venues, loading, favorites } = useAppContext()

  const config = buildPageConfig(city, slug)

  useEffect(() => {
    if (config) Analytics.seoPageViewed(slug ?? 'city', city, config.filterNeighborhood)
  }, [city, slug])

  if (!config) return <div className="loading-msg">Page not found</div>

  // Filter venues for this page
  let pageVenues = venues
  if (config.filterOpenNow) pageVenues = pageVenues.filter(isVenueActiveNow)
  if (config.filterNeighborhood) {
    pageVenues = pageVenues.filter(v => v.neighborhood.toLowerCase() === config.filterNeighborhood!.toLowerCase())
  }
  if (config.filterCategory) {
    pageVenues = pageVenues.filter(v => v.categories.includes(config.filterCategory!))
  }

  const liveCount = pageVenues.filter(isVenueActiveNow).length

  return (
    <>
      <Helmet>
        <title>{config.title}</title>
        <meta name="description" content={config.description} />
        <link rel="canonical" href={`${window.location.origin}${window.location.pathname}`} />
      </Helmet>

      <div className="seo-page">
        {/* ── BREADCRUMB ── */}
        <nav className="seo-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <Link to={`/${city}`}>{city.charAt(0).toUpperCase() + city.slice(1)}</Link>
          {slug && <><span>›</span><span>{config.h1}</span></>}
        </nav>

        {/* ── HERO ── */}
        <div className="seo-hero">
          <h1 className="seo-h1">{config.h1}</h1>
          {liveCount > 0 && (
            <div className="seo-live-badge">
              <span className="seo-live-dot" />
              {liveCount} happening now
            </div>
          )}
          <p className="seo-intro">{config.intro}</p>
        </div>

        {/* ── INTERNAL LINKS (SEO) ── */}
        {!slug && (
          <div className="seo-links">
            <div className="seo-links-label">Browse by:</div>
            <div className="seo-links-row">
              <Link to={`/${city}/happening-now`} className="seo-link">🟢 Happening Now</Link>
              <Link to={`/${city}/cheap-drinks`} className="seo-link">💰 Cheap Drinks</Link>
              <Link to={`/${city}/cocktails`} className="seo-link">🍸 Cocktail Bars</Link>
              <Link to={`/${city}/rooftop`} className="seo-link">🌆 Rooftop</Link>
              <Link to={`/${city}/date-night`} className="seo-link">🥂 Date Night</Link>
              <Link to={`/${city}/breweries`} className="seo-link">🍺 Breweries</Link>
            </div>
          </div>
        )}

        {/* ── VENUE LIST ── */}
        {loading ? (
          <p className="loading-msg">Loading deals...</p>
        ) : pageVenues.length === 0 ? (
          <div className="seo-empty">
            <p>No venues found for this page yet.</p>
            <Link to="/" className="seo-browse-link">Browse all venues →</Link>
          </div>
        ) : (
          <div className="venue-list">
            {pageVenues.map(venue => (
              <VenueCard
                key={venue.id}
                venue={venue}
                isFavorite={favorites.isFavorite(venue.id)}
                onToggleFavorite={favorites.toggleFavorite}
              />
            ))}
          </div>
        )}

        {/* ── FAQ SECTION (SEO content) ── */}
        <div className="seo-faq">
          <h2>Frequently Asked Questions</h2>
          <div className="seo-faq-item">
            <h3>When is happy hour in {config.h1.includes('in') ? config.h1.split('in')[1].trim() : 'this area'}?</h3>
            <p>Most venues run happy hour between 3–7 PM on weekdays, with some extending into the evening on Fridays. Check individual venue listings for exact times.</p>
          </div>
          <div className="seo-faq-item">
            <h3>How are deals verified?</h3>
            <p>Deals are submitted by the community and verified through regular check-ins. Look for the "✓ Verified" badge and the last verified date on each listing.</p>
          </div>
          <div className="seo-faq-item">
            <h3>Is a venue missing?</h3>
            <p><Link to="/?submit=true">Submit it here</Link> and we'll add it within 24 hours.</p>
          </div>
        </div>
      </div>
    </>
  )
}
