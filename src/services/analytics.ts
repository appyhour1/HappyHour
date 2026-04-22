import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
// VENUE STAT TRACKER
// ─────────────────────────────────────────────

async function trackVenueStat(venueId: string, stat: string) {
  try {
    await supabase.rpc('increment_venue_stat', { p_venue_id: venueId, p_stat: stat })
  } catch { }
}

// ─────────────────────────────────────────────
// AD STAT TRACKER — writes to ad_events table
// ─────────────────────────────────────────────

async function trackAdEvent(adId: string, brandName: string, eventType: 'impression' | 'click') {
  try {
    await supabase.from('ad_events').insert([{
      ad_id: adId,
      brand_name: brandName,
      event_type: eventType,
      created_at: new Date().toISOString(),
    }])
  } catch { }
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
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        persistence: 'localStorage',
        disable_session_recording: true,
      })
    })
  },
  track(event, props = {}) {
    if (process.env.NODE_ENV === 'development') console.log(`[Analytics] ${event}`, props)
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

const consoleProvider: AnalyticsProvider = {
  init() {},
  track(event, props = {}) {
    if (process.env.NODE_ENV === 'development') console.log(`[Analytics] ${event}`, props)
  },
  identify() {},
  page(pageName, props = {}) {
    if (process.env.NODE_ENV === 'development') console.log(`[Analytics] page: ${pageName}`, props)
  },
}

const provider: AnalyticsProvider = process.env.REACT_APP_POSTHOG_KEY
  ? postHogProvider : consoleProvider

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

export function initAnalytics() { provider.init() }
export function track(event: string, props?: Record<string, unknown>) { provider.track(event, props) }
export function identifyUser(userId: string, traits?: Record<string, unknown>) { provider.identify(userId, traits) }
export function trackPage(pageName: string, props?: Record<string, unknown>) { provider.page(pageName, props) }

// ─────────────────────────────────────────────
// TYPED EVENT HELPERS
// ─────────────────────────────────────────────

export const Analytics = {
  appOpened: () => track('app_opened'),

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

  // ── AD TRACKING ──
  adImpression: (adId: string, brandName: string) => {
    track('ad_impression', { ad_id: adId, brand_name: brandName })
    trackAdEvent(adId, brandName, 'impression')
  },

  adClicked: (adId: string, brandName: string) => {
    track('ad_clicked', { ad_id: adId, brand_name: brandName })
    trackAdEvent(adId, brandName, 'click')
  },

  // ── EMAIL SIGNUP ──
  emailSignup: (email: string, source: string) =>
    track('email_signup', { email, source }),
}
