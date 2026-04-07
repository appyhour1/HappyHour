/**
 * happeningNow.ts
 *
 * All time-status logic for the "Happening Now" feature.
 * Every function is pure and testable — no React, no side effects.
 *
 * KEY DESIGN DECISIONS:
 * - Times are always compared as "HH:MM" strings (lexicographic works correctly for 00:00–23:59)
 * - "Starts soon" = within 30 minutes of start
 * - "Ends soon"   = within 30 minutes of end (shown inside Live Now badge)
 * - Midnight edge: end_time "00:00" is treated as "24:00" so 23:45–00:00 windows work
 * - All-day deals are always Live Now (they don't have a time window to be "soon")
 */

import type { HappyHourSchedule, Venue, DayOfWeek } from '../types'
import { JS_DAY_TO_DOW } from '../types'

// ─────────────────────────────────────────────
// CLOCK — injectable for testing
// ─────────────────────────────────────────────

export interface Clock {
  /** Returns current "HH:MM" in local time */
  nowTime(): string
  /** Returns current DayOfWeek */
  nowDay(): DayOfWeek
  /** Returns current total minutes since midnight (0–1439) */
  nowMinutes(): number
}

export const REAL_CLOCK: Clock = {
  nowTime() {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },
  nowDay() {
    return JS_DAY_TO_DOW[new Date().getDay()]
  },
  nowMinutes() {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  },
}

// ─────────────────────────────────────────────
// STATUS TYPE
// ─────────────────────────────────────────────

export type HappyHourStatus =
  | 'live_now'       // active right now
  | 'ends_soon'      // active, ends within 30 min
  | 'starts_soon'    // starts within 30 min
  | 'later_today'    // has a window later today
  | 'ended'          // had a window today, now over
  | 'not_today'      // no schedule on today's day

export interface ScheduleStatus {
  status: HappyHourStatus
  /** The relevant schedule (the active one, or the next one up) */
  schedule: HappyHourSchedule
  /** Minutes until start (positive) or minutes until end (negative = already started) */
  minutesUntil: number | null
  /** Human-readable label for display */
  label: string
  /** Short label for badges */
  badge: string
  /** Minutes remaining if currently live */
  minutesRemaining: number | null
}

// ─────────────────────────────────────────────
// CORE CONVERSION
// ─────────────────────────────────────────────

/** Convert "HH:MM" to minutes since midnight. "00:00" end times = 1440 (next midnight) */
function toMinutes(t: string, isEndTime = false): number {
  const [h, m] = t.split(':').map(Number)
  const mins = h * 60 + m
  // treat end_time "00:00" as end of day (1440) so windows ending at midnight work
  if (isEndTime && mins === 0) return 1440
  return mins
}

/** Format minutes as "X min" or "X hr Y min" */
export function fmtDuration(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─────────────────────────────────────────────
// SCHEDULE STATUS
// ─────────────────────────────────────────────

const STARTS_SOON_WINDOW = 30  // minutes
const ENDS_SOON_WINDOW   = 30  // minutes

/**
 * Compute the status of a single schedule relative to the current time.
 * Returns null if the schedule doesn't apply today at all.
 */
export function getScheduleStatus(
  schedule: HappyHourSchedule,
  clock: Clock = REAL_CLOCK
): ScheduleStatus | null {
  const today = clock.nowDay()

  // All-day deals are always live if they include today
  if (schedule.is_all_day) {
    if (!schedule.days.includes(today)) return null
    return {
      status: 'live_now',
      schedule,
      minutesUntil: null,
      minutesRemaining: null,
      label: 'All day',
      badge: 'Live Now',
    }
  }

  const now         = clock.nowMinutes()
  const startMins   = toMinutes(schedule.start_time)
  const endMins     = toMinutes(schedule.end_time, true)
  const onToday     = schedule.days.includes(today)

  if (!onToday) return null

  // Currently live
  if (now >= startMins && now <= endMins) {
    const remaining = endMins - now
    const endsSoon  = remaining <= ENDS_SOON_WINDOW

    return {
      status: endsSoon ? 'ends_soon' : 'live_now',
      schedule,
      minutesUntil: null,
      minutesRemaining: remaining,
      label: endsSoon
        ? `Ends in ${fmtDuration(remaining)}`
        : `Until ${fmtTimeFromMins(endMins)}`,
      badge: endsSoon ? `Ends in ${fmtDuration(remaining)}` : 'Live Now',
    }
  }

  // Hasn't started yet
  if (now < startMins) {
    const until     = startMins - now
    const startsSoon = until <= STARTS_SOON_WINDOW

    return {
      status: startsSoon ? 'starts_soon' : 'later_today',
      schedule,
      minutesUntil: until,
      minutesRemaining: null,
      label: startsSoon
        ? `Starts in ${fmtDuration(until)}`
        : `Starts at ${fmtTimeFromMins(startMins)}`,
      badge: startsSoon ? `Starts in ${fmtDuration(until)}` : 'Later Today',
    }
  }

  // Already ended
  return {
    status: 'ended',
    schedule,
    minutesUntil: null,
    minutesRemaining: null,
    label: `Ended at ${fmtTimeFromMins(endMins)}`,
    badge: 'Ended',
  }
}

// ─────────────────────────────────────────────
// VENUE STATUS — picks the best schedule
// ─────────────────────────────────────────────

/**
 * Priority order for picking which schedule's status to surface:
 * ends_soon > live_now > starts_soon > later_today > ended > not_today
 */
const STATUS_PRIORITY: Record<HappyHourStatus, number> = {
  ends_soon:   0,
  live_now:    1,
  starts_soon: 2,
  later_today: 3,
  ended:       4,
  not_today:   5,
}

/**
 * Returns the most relevant status for a venue across all its schedules.
 * Always picks the best active status — if two schedules are live, the one
 * ending soonest is surfaced so users know they need to hurry.
 */
export function getVenueStatus(
  venue: Venue,
  clock: Clock = REAL_CLOCK
): ScheduleStatus {
  const schedules = venue.schedules ?? []

  if (schedules.length === 0) {
    return {
      status: 'not_today',
      schedule: {} as HappyHourSchedule,
      minutesUntil: null,
      minutesRemaining: null,
      label: 'No deals listed',
      badge: '',
    }
  }

  // Get status for every schedule that applies today
  const statuses = schedules
    .map(s => getScheduleStatus(s, clock))
    .filter((s): s is ScheduleStatus => s !== null)

  if (statuses.length === 0) {
    // No schedules today — find the next day they have one
    const nextInfo = getNextHappyHourDay(venue, clock)
    return {
      status: 'not_today',
      schedule: schedules[0],
      minutesUntil: null,
      minutesRemaining: null,
      label: nextInfo ?? 'Not available today',
      badge: '',
    }
  }

  // Sort by priority, then by minutesRemaining (ascending) for ties
  statuses.sort((a, b) => {
    const p = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
    if (p !== 0) return p
    // Both live — surface the one ending soonest
    if (a.minutesRemaining !== null && b.minutesRemaining !== null) {
      return a.minutesRemaining - b.minutesRemaining
    }
    // Both upcoming — surface the one starting soonest
    if (a.minutesUntil !== null && b.minutesUntil !== null) {
      return a.minutesUntil - b.minutesUntil
    }
    return 0
  })

  return statuses[0]
}

// ─────────────────────────────────────────────
// VENUE-LEVEL PREDICATES (used by filterVenues)
// ─────────────────────────────────────────────

export function isVenueLiveNow(venue: Venue, clock: Clock = REAL_CLOCK): boolean {
  const s = getVenueStatus(venue, clock)
  return s.status === 'live_now' || s.status === 'ends_soon'
}

export function isVenueHappeningToday(venue: Venue, clock: Clock = REAL_CLOCK): boolean {
  const s = getVenueStatus(venue, clock)
  return s.status !== 'not_today'
}

// ─────────────────────────────────────────────
// EMPTY STATE HELPERS
// ─────────────────────────────────────────────

/**
 * From a full venue list, return the venues starting next — useful for
 * the empty state when no venues are live right now.
 */
export function getVenuesStartingNext(
  venues: Venue[],
  limit = 3,
  clock: Clock = REAL_CLOCK
): Array<{ venue: Venue; status: ScheduleStatus }> {
  return venues
    .map(v => ({ venue: v, status: getVenueStatus(v, clock) }))
    .filter(({ status }) => status.status === 'starts_soon' || status.status === 'later_today')
    .sort((a, b) => (a.status.minutesUntil ?? 999) - (b.status.minutesUntil ?? 999))
    .slice(0, limit)
}

/**
 * How many venues are currently live
 */
export function countLiveNow(venues: Venue[], clock: Clock = REAL_CLOCK): number {
  return venues.filter(v => isVenueLiveNow(v, clock)).length
}

// ─────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────

/** Convert minutes-since-midnight back to "H:MM AM/PM" */
function fmtTimeFromMins(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24
  const m = totalMins % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr   = h % 12 || 12
  return `${hr}${m > 0 ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`
}

/** Get a friendly string like "Next: Thursday" for when a venue has no deals today */
function getNextHappyHourDay(venue: Venue, clock: Clock): string | null {
  const today = clock.nowDay()
  const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayIndex = DAYS.indexOf(today)
  const allDays = new Set(
    (venue.schedules ?? []).flatMap(s => s.days as DayOfWeek[])
  )
  if (allDays.size === 0) return null

  for (let offset = 1; offset <= 7; offset++) {
    const candidate = DAYS[(todayIndex + offset) % 7]
    if (allDays.has(candidate)) {
      return offset === 1 ? 'Next: Tomorrow' : `Next: ${candidate}`
    }
  }
  return null
}

// ─────────────────────────────────────────────
// STATUS → VISUAL CONFIG
// ─────────────────────────────────────────────

export interface StatusVisual {
  bg: string
  text: string
  border: string
  dot: string
  pulse: boolean
}

export const STATUS_VISUALS: Record<HappyHourStatus, StatusVisual> = {
  live_now:    { bg: '#E1F5EE', text: '#085041', border: '#1D9E75', dot: '#1D9E75', pulse: true  },
  ends_soon:   { bg: '#FEF3E2', text: '#633806', border: '#BA7517', dot: '#EF9F27', pulse: true  },
  starts_soon: { bg: '#EEEDFE', text: '#3C3489', border: '#7F77DD', dot: '#7F77DD', pulse: false },
  later_today: { bg: '#F0EDE8', text: '#555555', border: '#d0cdc8', dot: '#aaa',    pulse: false },
  ended:       { bg: '#F5F3EF', text: '#aaaaaa', border: '#e0ddd8', dot: '#ccc',    pulse: false },
  not_today:   { bg: '#F5F3EF', text: '#aaaaaa', border: '#e0ddd8', dot: '#ccc',    pulse: false },
}
