import { supabase } from '../lib/supabase'

/**
 * analytics.ts
 *
 * Clean abstraction layer over PostHog. Swap the provider by
 * changing only the `provider` object below — no other files need updating.
 *
 * USAGE:
 *   import { track } from '../services/analytics'
 *   track('venue_card_clicked', { venue_id: id, venue_name: name })
 *
 * EVENT CATALOG (all events fire from here):
 *   app_opened
 *   filter_used              { filter_key, filter_value }
 *   happening_now_toggled    { enabled }
 *   venue_card_clicked       { venue_id, venue_name, is_open }
 *   map_pin_clicked          { venue_id, venue_name }
 *   favorite_added           { venue_id, venue_name }
 *   favorite_removed         { venue_id, venue_name }
 *   venue_detail_viewed      { venue_id, venue_name }
 *   submission_started       { flow: 'new_venue' | 'suggest_edit' }
 *   submission_completed     { flow, venue_id? }
 *   outbound_website_clicked { venue_id, url }
 *   get_directions_clicked   { venue_id, venue_name }
 *   view_mode_changed        { mode: 'list' | 'map' | 'split' }
 *   best_picks_section_viewed { section_id }
 *   seo_page_viewed          { page_type, city, neighborhood? }
 */


// ─────────────────────────────────────────────
// VENUE STAT TRACKER — writes to Supabase venue_stats
// ─────────────────────────────────────────────

async function trackVenueStat(venueId: string, stat: string) {
  try {
    await supabase.rpc('increment_venue_stat', {
      p_venue_id: venueId,
      p_stat: stat,
    })
  } catch {
    // silently fail — analytics should never break the app
  }
}

// ─────────────────────────────────────────────
// PROVIDER INTERFACE
// ─────────────────────────────────────────────

interface AnalyticsProvider {
  init(): void
  track(event: string, props?: Record<string, unknown>): void
  identify(userId: string, traits?: Record<string, unknown>): void
  page(pageName: string, props?: Record<string, unknown>): void
}

// ─────────────────────────────────────────────
// POSTHOG PROVIDER
// ─────────────────────────────────────────────

const postHogProvider: AnalyticsProvider = {
  init() {
    const key = process.env.REACT_APP_POSTHOG_KEY
    const host = process.env.REACT_APP_POSTHOG_HOST || 'https://app.posthog.com'
    if (!key) {
      if (process.env.NODE_ENV === 'development') {
        console.info('[Analytics] PostHog key not set — events will be logged to console only')
      }
      return
    }
    // Dynamically import so PostHog doesn't bloat the initial bundle
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        autocapture: false,         // manual only — cleaner data
        capture_pageview: false,    // we do this manually per route
        persistence: 'localStorage',
        disable_session_recording: true,
      })
    })
  },

  track(event, props = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, props)
    }
    import('posthog-js').then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.capture(event, props)
    })
  },

  identify(userId, traits = {}) {
    import('posthog-js').then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.identify(userId, traits)
    })
  },

  page(pageName, props = {}) {
    this.track('$pageview', { page: pageName, ...props })
  },
}

// ─────────────────────────────────────────────
// CONSOLE-ONLY PROVIDER (used when no key set)
// ─────────────────────────────────────────────

const consoleProvider: AnalyticsProvider = {
  init() {},
  track(event, props = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, props)
    }
  },
  identify(userId, traits = {}) {},
  page(pageName, props = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] page: ${pageName}`, props)
    }
  },
}

// ─────────────────────────────────────────────
// ACTIVE PROVIDER
// ─────────────────────────────────────────────

const provider: AnalyticsProvider = process.env.REACT_APP_POSTHOG_KEY
  ? postHogProvider
  : consoleProvider

// ─────────────────────────────────────────────
// PUBLIC API — use these throughout the app
// ─────────────────────────────────────────────

export function initAnalytics() {
  provider.init()
}

export function track(event: string, props?: Record<string, unknown>) {
  provider.track(event, props)
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  provider.identify(userId, traits)
}

export function trackPage(pageName: string, props?: Record<string, unknown>) {
  provider.page(pageName, props)
}

// ─────────────────────────────────────────────
// TYPED EVENT HELPERS — prevents typos, documents the schema
// ─────────────────────────────────────────────

export const Analytics = {
  appOpened: () =>
    track('app_opened'),

  filterUsed: (key: string, value: string | boolean) =>
    track('filter_used', { filter_key: key, filter_value: value }),

  happeningNowToggled: (enabled: boolean) =>
    track('happening_now_toggled', { enabled }),

  venueCardClicked: (venueId: string, venueName: string, isOpen: boolean) => {
    track('venue_card_clicked', { venue_id: venueId, venue_name: venueName, is_open: isOpen })
    trackVenueStat(venueId, 'card_views')
  },

  mapPinClicked: (venueId: string, venueName: string) =>
    track('map_pin_clicked', { venue_id: venueId, venue_name: venueName }),

  favoriteAdded: (venueId: string, venueName: string) => {
    track('favorite_added', { venue_id: venueId, venue_name: venueName })
    trackVenueStat(venueId, 'favorites')
  },

  favoriteRemoved: (venueId: string, venueName: string) =>
    track('favorite_removed', { venue_id: venueId, venue_name: venueName }),

  venueDetailViewed: (venueId: string, venueName: string) => {
    track('venue_detail_viewed', { venue_id: venueId, venue_name: venueName })
    trackVenueStat(venueId, 'detail_views')
  },

  submissionStarted: (flow: 'new_venue' | 'suggest_edit') =>
    track('submission_started', { flow }),

  submissionCompleted: (flow: 'new_venue' | 'suggest_edit', venueId?: string) =>
    track('submission_completed', { flow, venue_id: venueId }),

  outboundWebsiteClicked: (venueId: string, url: string) => {
    track('outbound_website_clicked', { venue_id: venueId, url })
    trackVenueStat(venueId, 'website_clicks')
  },

  getDirectionsClicked: (venueId: string, venueName: string) => {
    track('get_directions_clicked', { venue_id: venueId, venue_name: venueName })
    trackVenueStat(venueId, 'directions_clicks')
  },

  viewModeChanged: (mode: 'list' | 'map' | 'split') =>
    track('view_mode_changed', { mode }),

  bestPicksSectionViewed: (sectionId: string) =>
    track('best_picks_section_viewed', { section_id: sectionId }),

  seoPageViewed: (pageType: string, city: string, neighborhood?: string) =>
    track('seo_page_viewed', { page_type: pageType, city, neighborhood }),
}
