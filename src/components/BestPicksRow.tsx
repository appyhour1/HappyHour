import React, { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BestPicksSection } from '../utils/bestPicks'
import type { UseFavoritesReturn } from '../hooks/useFavorites'
import type { UserLocation, Venue, DealItem } from '../types'
import { fmtTime, isVenueActiveNow, distanceMiles, fmtDistance } from '../utils/filters'
import { getVenueStatus, STATUS_VISUALS } from '../utils/happeningNow'
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS } from '../types'
import { Analytics } from '../services/analytics'

const SECTION_DEAL_TYPE: Record<string, string> = {
  cocktail_deals: 'cocktail',
  food_deals:     'food',
  cheapest_drinks: 'beer',
  happening_now:  '',
  starting_soon:  '',
}

const DEAL_ORDER = ['beer', 'cocktail', 'food', 'wine', 'general']

function getBestDealForSection(venue: Venue, sectionId: string): DealItem | null {
  const preferredType = SECTION_DEAL_TYPE[sectionId]
  const allDeals = (venue.schedules ?? []).flatMap(s => s.deals)
  if (!allDeals.length) return null

  // For typed sections, show the best deal of that type first
  if (preferredType) {
    const matching = allDeals.filter(d => d.type === preferredType)
    if (matching.length > 0) {
      // Return cheapest of that type, or first if no prices
      return matching.sort((a, b) => (a.price ?? 999) - (b.price ?? 999))[0]
    }
  }

  // Fallback: show best deal in Beer → Cocktail → Food order
  return [...allDeals].sort((a, b) =>
    DEAL_ORDER.indexOf(a.type) - DEAL_ORDER.indexOf(b.type)
  )[0]
}

interface BestPicksRowProps {
  section: BestPicksSection
  favorites: UseFavoritesReturn
  userLocation?: UserLocation | null
}

export function BestPicksRow({ section, favorites, userLocation }: BestPicksRowProps) {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleVenueClick(venue: Venue) {
    Analytics.venueCardClicked(venue.id, venue.name, isVenueActiveNow(venue))
    Analytics.bestPicksSectionViewed(section.id)
    navigate(`/venue/${venue.id}`)
  }

  return (
    <div className="bp-row">
      <div className="bp-row-header">
        <span className="bp-icon">{section.icon}</span>
        <div>
          <h2 className="bp-title">{section.title}</h2>
          <p className="bp-subtitle">{section.subtitle}</p>
        </div>
      </div>
      <div className="bp-scroll" ref={scrollRef}>
        {section.venues.map(venue => {
          const status = getVenueStatus(venue)
          const vis = STATUS_VISUALS[status.status]
          const isOpen = isVenueActiveNow(venue)
          const topDeal = getBestDealForSection(venue, section.id)
          const distLabel = userLocation && venue.latitude && venue.longitude
            ? fmtDistance(distanceMiles(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude))
            : null
          const isFav = favorites.isFavorite(venue.id)

          return (
            <div
              key={venue.id}
              className="bp-card"
              onClick={() => handleVenueClick(venue)}
              role="button"
              tabIndex={0}
            >
              <div className="bp-card-top">
                <span className="bp-status" style={{ background: vis.bg, color: vis.text }}>
                  <span className={`bp-dot${vis.pulse ? ' pulse' : ''}`} style={{ background: vis.dot }} />
                  {status.badge || 'View deals'}
                </span>
                <button
                  className={`bp-heart${isFav ? ' saved' : ''}`}
                  onClick={e => { e.stopPropagation(); favorites.toggleFavorite(venue.id, venue.name) }}
                  aria-label="Save"
                >
                  {isFav ? '♥' : '♡'}
                </button>
              </div>
              <div className="bp-name">{venue.name}</div>
              <div className="bp-meta">
                {venue.neighborhood}
                {distLabel && <span> · {distLabel}</span>}
                {venue.price_tier && <span> · {venue.price_tier}</span>}
              </div>
              {topDeal && (
                <div
                  className="bp-deal"
                  style={{ background: DEAL_TYPE_COLORS[topDeal.type].bg, color: DEAL_TYPE_COLORS[topDeal.type].text }}
                >
                  <span className="bp-deal-type">{DEAL_TYPE_LABELS[topDeal.type]}</span>
                  <span className="bp-deal-desc">{topDeal.description}</span>
                  {topDeal.price != null && <span className="bp-deal-price">${topDeal.price}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
