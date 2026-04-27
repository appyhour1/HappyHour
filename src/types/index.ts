// ─────────────────────────────────────────────
// ENUMS & CONSTANTS
// ─────────────────────────────────────────────

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ISO day index (0 = Sun, 1 = Mon ... 6 = Sat) → DayOfWeek
export const JS_DAY_TO_DOW: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type PriceTier = '$' | '$$' | '$$$' | '$$$$'

export type VerificationStatus = 'unverified' | 'community' | 'verified' | 'claimed'

export type DataSource = 'user_submitted' | 'business_claimed' | 'scraped' | 'admin'

export type DealType = 'beer' | 'wine' | 'cocktail' | 'liquor' | 'food' | 'general'

export type VenueCategory =
  | 'sports_bar'
  | 'dive_bar'
  | 'cocktail_bar'
  | 'rooftop'
  | 'restaurant'
  | 'brewery'
  | 'wine_bar'
  | 'pub'
  | 'lounge'
  | 'date_night'
  | 'patio'
  | 'live_music'
  | 'late_night'

// ─────────────────────────────────────────────
// DEAL ITEM — a single priced special
// ─────────────────────────────────────────────

export interface DealItem {
  type: DealType
  description: string    // "$3 Bud Light draft"
  price?: number         // 3.00 — enables price-range filtering
  original_price?: number // for "half off" display math
}

// ─────────────────────────────────────────────
// HAPPY HOUR SCHEDULE — one time block
// A venue can have multiple schedules (e.g. different days have different times)
// ─────────────────────────────────────────────

export interface HappyHourSchedule {
  id: string
  venue_id: string
  days: DayOfWeek[]       // which days this schedule applies
  start_time: string      // "16:00" — 24hr HH:MM
  end_time: string        // "18:00" — 24hr HH:MM
  is_all_day: boolean
  deal_text: string       // human-readable summary for display
  deals: DealItem[]       // structured deal breakdown
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// VENUE — the core entity
// ─────────────────────────────────────────────

export interface Venue {
  id: string
  name: string
  neighborhood: string
  city: string
  state: string

  // Location
  address: string | null
  latitude: number | null
  longitude: number | null

  // Contact
  website: string | null
  phone: string | null

  // Classification
  categories: VenueCategory[]
  price_tier: PriceTier | null

  // Media
  image_url: string | null

  // Trust & verification
  verification_status: VerificationStatus
  last_verified_at: string | null
  data_source: DataSource
  claimed_by_user_id: string | null

  // Platform
  dog_friendly: boolean
  is_featured: boolean
  is_sponsored: boolean
  upvote_count: number

  // Timestamps
  created_at: string
  updated_at: string

  // Joined — populated by queries, not stored in venues table
  schedules?: HappyHourSchedule[]
}

// ─────────────────────────────────────────────
// FILTER STATE — what the UI passes to filter functions
// ─────────────────────────────────────────────

/** Time-of-day window: only show venues with happy hour overlapping this range */
export interface TimeWindow {
  start: string   // "HH:MM" 24hr
  end: string     // "HH:MM" 24hr
}

export interface FilterState {
  search: string
  days: Set<DayOfWeek>
  dealTypes: Set<DealType>
  categories: Set<VenueCategory>
  neighborhoods: Set<string>
  priceTiers: Set<PriceTier>
  openNow: boolean
  timeWindow: TimeWindow | null   // null = no time filter
  city: string | null
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  days: new Set(),
  dealTypes: new Set(),
  categories: new Set(),
  neighborhoods: new Set(),
  priceTiers: new Set(),
  openNow: false,
  timeWindow: null,
  city: null,
}

// ─────────────────────────────────────────────
// SORT MODE
// ─────────────────────────────────────────────

export type SortMode =
  | 'best_match'    // scored: open now + cheapest + featured + upvotes
  | 'closest'       // distance asc (falls back to name when no location)
  | 'cheapest'      // lowest deal price asc
  | 'starting_soon' // minutes until next happy hour asc
  | 'most_popular'  // upvote_count desc
  | 'featured'      // featured first, then upvotes

export const SORT_LABELS: Record<SortMode, string> = {
  best_match:    'Best match',
  closest:       'Closest',
  cheapest:      'Cheapest',
  starting_soon: 'Starting soon',
  most_popular:  'Most popular',
  featured:      'Featured',
}

// ─────────────────────────────────────────────
// USER LOCATION — prepared for distance sorting
// ─────────────────────────────────────────────

export interface UserLocation {
  lat: number
  lng: number
  /** How the location was obtained */
  source: 'gps' | 'manual' | 'ip'
  /** Display label e.g. "Downtown Cincinnati" */
  label?: string
}

// ─────────────────────────────────────────────
// FORM STATE — what the add/edit modal manages
// Flat structure intentionally — easier to bind to inputs
// ─────────────────────────────────────────────

export interface VenueFormState {
  // Venue fields
  id: string | null
  name: string
  neighborhood: string
  city: string
  address: string
  website: string
  phone: string
  categories: VenueCategory[]
  price_tier: PriceTier | ''
  image_url: string

  // Schedule fields (for the active schedule being edited)
  schedule_id: string | null
  days: DayOfWeek[]
  start_time: string
  end_time: string
  is_all_day: boolean
  deal_text: string
  deals: DealItem[]
}

export const EMPTY_FORM: VenueFormState = {
  id: null,
  name: '',
  neighborhood: '',
  city: '',
  address: '',
  website: '',
  phone: '',
  categories: [],
  price_tier: '',
  image_url: '',
  schedule_id: null,
  days: [],
  start_time: '16:00',
  end_time: '18:00',
  is_all_day: false,
  deal_text: '',
  deals: [],
}

// ─────────────────────────────────────────────
// DISPLAY HELPERS — label maps used in UI
// ─────────────────────────────────────────────

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  beer:     'Beer',
  wine:     'Wine',
  cocktail: 'Cocktails',
  liquor:   'Liquor',
  food:     'Food',
  general:  'General',
}

export const DEAL_TYPE_COLORS: Record<DealType, { bg: string; text: string }> = {
  beer:     { bg: '#FEF3E2', text: '#633806' },
  wine:     { bg: '#F9EEFF', text: '#5B1A7A' },
  cocktail: { bg: '#EEEDFE', text: '#3C3489' },
  liquor:   { bg: '#FFF0F0', text: '#8B1A1A' },
  food:     { bg: '#E1F5EE', text: '#085041' },
  general:  { bg: '#F0EDE8', text: '#555' },
}

export const CATEGORY_LABELS: Record<VenueCategory, string> = {
  sports_bar:  'Sports Bar',
  dive_bar:    'Dive Bar',
  cocktail_bar:'Cocktail Bar',
  rooftop:     'Rooftop',
  restaurant:  'Restaurant',
  brewery:     'Brewery',
  wine_bar:    'Wine Bar',
  pub:         'Pub',
  lounge:      'Lounge',
  date_night:  'Date Night',
  patio:       'Patio',
  live_music:  'Live Music',
  late_night:  'Late Night',
}

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  '$':    'Budget',
  '$$':   'Moderate',
  '$$$':  'Upscale',
  '$$$$': 'Fine Dining',
}

// Re-exported for convenience so consumers only need to import from './types'
export type { HappyHourStatus, ScheduleStatus, StatusVisual } from '../utils/happeningNow'
