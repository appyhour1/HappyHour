/**
 * MapView.tsx
 *
 * Leaflet map with custom colored pins per venue status.
 * Tiles are configured via REACT_APP_MAP_TILE_URL — defaults to
 * free OpenStreetMap tiles. Swap to Mapbox by setting:
 *   REACT_APP_MAP_TILE_URL=https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}
 *   REACT_APP_MAP_TILE_ATTRIBUTION=© Mapbox © OpenStreetMap
 *
 * IMPORTANT: Leaflet requires its CSS to be imported. We import it here
 * so the map component owns that dependency.
 *
 * PIN COLORS:
 *   Green pulsing  = live now / ends soon
 *   Purple         = starts soon
 *   Gray           = later today / ended / not today
 *   Orange outline = selected venue
 */

import React, { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Venue } from '../types'
import { VenuePopup } from './VenuePopup'
import { getScheduleStatus, STATUS_VISUALS } from '../utils/happeningNow'
import type { HappyHourStatus, ScheduleStatus } from '../utils/happeningNow'

// Fix Leaflet's default icon path issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─────────────────────────────────────────────
// MAP TILE CONFIG
// ─────────────────────────────────────────────

const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const TILE_URL = process.env.REACT_APP_MAP_TILE_URL || DEFAULT_TILE_URL
const TILE_ATTRIBUTION = process.env.REACT_APP_MAP_TILE_ATTRIBUTION || DEFAULT_ATTRIBUTION

// ─────────────────────────────────────────────
// STATUS PRIORITY
// ─────────────────────────────────────────────

const STATUS_PRIORITY: HappyHourStatus[] = ['live_now','ends_soon','starts_soon','later_today','ended','not_today']

function getVenueBestStatus(venue: Venue): ScheduleStatus | null {
  const statuses = (venue.schedules || [])
    .map(s => getScheduleStatus(s))
    .filter((s): s is ScheduleStatus => s !== null)
  if (!statuses.length) return null
  return statuses.sort((a, b) =>
    STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status)
  )[0]
}

// ─────────────────────────────────────────────
// CUSTOM SVG PIN
// Status-colored, selected state uses orange ring
// ─────────────────────────────────────────────

function makePinIcon(color: string, pulse: boolean, selected: boolean): L.DivIcon {
  const ring = selected
    ? `<circle cx="16" cy="16" r="13" fill="none" stroke="#D85A30" stroke-width="2.5"/>`
    : ''
  const dot = pulse
    ? `<circle cx="16" cy="16" r="5" fill="${color}"><animate attributeName="r" values="5;10;5" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1.8s" repeatCount="indefinite"/></circle>`
    : ''
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      ${ring}
      <path d="M16 2C9.4 2 4 7.4 4 14c0 8 12 24 12 24s12-16 12-24c0-6.6-5.4-12-12-12z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="16" cy="14" r="5" fill="white" opacity="0.9"/>
      ${dot}
    </svg>`

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
  })
}

// ─────────────────────────────────────────────
// FLY TO selected venue
// ─────────────────────────────────────────────

function FlyToVenue({ venue }: { venue: Venue | null }) {
  const map = useMap()
  useEffect(() => {
    if (venue?.latitude && venue?.longitude) {
      map.flyTo([venue.latitude, venue.longitude], Math.max(map.getZoom(), 15), { duration: 0.6 })
    }
  }, [venue, map])
  return null
}

// ─────────────────────────────────────────────
// FIT BOUNDS to filtered venues
// ─────────────────────────────────────────────

function FitBounds({ venues }: { venues: Venue[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current) return
    const withCoords = venues.filter(v => v.latitude && v.longitude)
    if (withCoords.length === 0) return
    if (withCoords.length === 1) {
      map.setView([withCoords[0].latitude!, withCoords[0].longitude!], 15)
    } else {
      const bounds = L.latLngBounds(withCoords.map(v => [v.latitude!, v.longitude!] as [number, number]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
    fitted.current = true
  }, [venues, map])

  return null
}

// ─────────────────────────────────────────────
// USER LOCATION PIN
// ─────────────────────────────────────────────

function UserLocationPin({ lat, lng }: { lat: number; lng: number }) {
  return (
    <CircleMarker
      center={[lat, lng]}
      radius={8}
      pathOptions={{ fillColor: '#3C3489', fillOpacity: 1, color: 'white', weight: 2 }}
    >
      <Popup><div style={{ fontSize: 13 }}>Your location</div></Popup>
    </CircleMarker>
  )
}

// ─────────────────────────────────────────────
// MAIN MAP VIEW
// ─────────────────────────────────────────────

interface MapViewProps {
  venues: Venue[]
  selectedVenueId: string | null
  onSelectVenue: (id: string | null) => void
  onViewDetails: (id: string) => void
  userLocation?: { lat: number; lng: number } | null
}

// Default center: Cincinnati
const DEFAULT_CENTER: [number, number] = [39.1031, -84.5120]
const DEFAULT_ZOOM = 13

export function MapView({
  venues,
  selectedVenueId,
  onSelectVenue,
  onViewDetails,
  userLocation,
}: MapViewProps) {
  const venuesWithCoords = useMemo(
    () => venues.filter(v => v.latitude != null && v.longitude != null),
    [venues]
  )

  const selectedVenue = useMemo(
    () => venuesWithCoords.find(v => v.id === selectedVenueId) ?? null,
    [venuesWithCoords, selectedVenueId]
  )

  return (
    <div className="map-container">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="leaflet-map"
        zoomControl={true}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

        <FitBounds venues={venuesWithCoords} />
        <FlyToVenue venue={selectedVenue} />

        {userLocation && (
          <UserLocationPin lat={userLocation.lat} lng={userLocation.lng} />
        )}

        {venuesWithCoords.map(venue => {
          const status = getVenueBestStatus(venue)
          const isSelected = venue.id === selectedVenueId
          const isLive = status?.status === 'live_now' || status?.status === 'ends_soon'
          const isStartsSoon = status?.status === 'starts_soon'

          // Choose pin color based on status
          let pinColor = '#aaa'
          if (isLive) pinColor = '#1D9E75'
          else if (isStartsSoon) pinColor = '#7F77DD'
          else if (status?.status === 'later_today') pinColor = '#888'

          const icon = makePinIcon(pinColor, isLive, isSelected)

          return (
            <Marker
              key={venue.id}
              position={[venue.latitude!, venue.longitude!]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectVenue(venue.id === selectedVenueId ? null : venue.id),
              }}
            >
              <Popup
                className="venue-popup-wrapper"
              >
                <VenuePopup
                  venue={venue}
                  onViewDetails={(id) => {
                    onViewDetails(id)
                    onSelectVenue(id)
                  }}
                />
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {venuesWithCoords.length < venues.length && (
        <div className="map-missing-coords">
          {venues.length - venuesWithCoords.length} venue{venues.length - venuesWithCoords.length !== 1 ? 's' : ''} hidden — no coordinates yet
        </div>
      )}
    </div>
  )
}
