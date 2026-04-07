import { createClient } from '@supabase/supabase-js'
import type { Venue, HappyHourSchedule, FilterState, DayOfWeek } from '../types'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─────────────────────────────────────────────
// VENUE QUERIES
// ─────────────────────────────────────────────

/** Fetch all venues with their schedules for a given city */
export async function fetchVenuesWithSchedules(city = 'Cincinnati'): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues_with_schedules')
    .select('*')
    .eq('city', city)
    .order('is_featured', { ascending: false })
    .order('upvote_count', { ascending: false })
    .order('name')

  if (error) throw new Error(error.message)
  return (data || []) as Venue[]
}

/** Upsert a venue — insert if no id, update if id present */
export async function saveVenue(payload: Partial<Venue>): Promise<Venue> {
  const { id, schedules: _schedules, ...fields } = payload as any

  if (id) {
    const { data, error } = await supabase
      .from('venues')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Venue
  } else {
    const { data, error } = await supabase
      .from('venues')
      .insert([fields])
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Venue
  }
}

export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase.from('venues').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function upvoteVenue(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_upvote', { venue_id: id })
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────
// SCHEDULE QUERIES
// ─────────────────────────────────────────────

export async function saveSchedule(
  payload: Partial<HappyHourSchedule>
): Promise<HappyHourSchedule> {
  const { id, ...fields } = payload

  if (id) {
    const { data, error } = await supabase
      .from('happy_hour_schedules')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as HappyHourSchedule
  } else {
    const { data, error } = await supabase
      .from('happy_hour_schedules')
      .insert([fields])
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as HappyHourSchedule
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('happy_hour_schedules')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
