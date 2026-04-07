/**
 * venueService.ts
 *
 * All data access goes through this layer. The app never calls
 * Supabase directly — it calls these functions.
 *
 * TO SWAP BACKENDS: change only this file. No other files need updating.
 *
 * CURRENT BACKENDS:
 *   - Supabase (production)
 *   - SAMPLE_VENUES (fallback when Supabase is unavailable)
 */

import { supabase } from '../lib/supabase'
import { SAMPLE_VENUES } from '../data/sampleVenues'
import type { Venue, HappyHourSchedule } from '../types'

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export async function getVenues(city = 'Cincinnati'): Promise<Venue[]> {
  try {
    const { data, error } = await supabase
      .from('venues_with_schedules')
      .select('*')
      .eq('city', city)
      .order('is_featured', { ascending: false })
      .order('name')

    if (error) throw error
    if (data && data.length > 0) return data as Venue[]
    return SAMPLE_VENUES.filter(v => v.city === city || city === 'Cincinnati')
  } catch {
    return SAMPLE_VENUES
  }
}

export async function getVenueById(id: string): Promise<Venue | null> {
  // Try sample data first (for demo IDs)
  const sample = SAMPLE_VENUES.find(v => v.id === id)

  try {
    const { data, error } = await supabase
      .from('venues_with_schedules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return sample ?? null
    return data as Venue
  } catch {
    return sample ?? null
  }
}

export async function getVenuesByNeighborhood(neighborhood: string, city = 'Cincinnati'): Promise<Venue[]> {
  const all = await getVenues(city)
  return all.filter(v => v.neighborhood.toLowerCase() === neighborhood.toLowerCase())
}

export async function getFeaturedVenues(city = 'Cincinnati'): Promise<Venue[]> {
  const all = await getVenues(city)
  return all.filter(v => v.is_featured)
}

// ─────────────────────────────────────────────
// WRITE — venues
// ─────────────────────────────────────────────

export async function createVenue(payload: Omit<Venue, 'id' | 'created_at' | 'updated_at' | 'schedules'>): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Venue
}

export async function updateVenue(id: string, payload: Partial<Venue>): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Venue
}

export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase.from('venues').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────
// WRITE — schedules
// ─────────────────────────────────────────────

export async function createSchedule(payload: Omit<HappyHourSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<HappyHourSchedule> {
  const { data, error } = await supabase
    .from('happy_hour_schedules')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as HappyHourSchedule
}

export async function updateSchedule(id: string, payload: Partial<HappyHourSchedule>): Promise<HappyHourSchedule> {
  const { data, error } = await supabase
    .from('happy_hour_schedules')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as HappyHourSchedule
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('happy_hour_schedules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────
// UPVOTES
// ─────────────────────────────────────────────

export async function upvoteVenue(id: string): Promise<void> {
  // Increment upvote_count atomically
  const { error } = await supabase.rpc('increment_upvote', { venue_id: id })
  if (error) {
    // Fallback: fetch + update
    const { data } = await supabase.from('venues').select('upvote_count').eq('id', id).single()
    if (data) {
      await supabase.from('venues').update({ upvote_count: data.upvote_count + 1 }).eq('id', id)
    }
  }
}
