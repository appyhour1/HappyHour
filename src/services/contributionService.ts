/**
 * contributionService.ts
 *
 * Handles user-submitted venue additions and edit suggestions.
 *
 * CURRENT BEHAVIOR: stores to Supabase `contributions` table.
 * Falls back to console.log if table doesn't exist yet.
 *
 * BACKEND RECOMMENDATION (see DEPLOYMENT_GUIDE.md):
 *   Use the `contributions` Supabase table with status: pending | approved | rejected
 *   Add a simple admin view to review/approve submissions
 */

import { supabase } from '../lib/supabase'
import { Analytics } from './analytics'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type ContributionFlow = 'new_venue' | 'suggest_edit'

export interface NewVenueSubmission {
  flow: 'new_venue'
  name: string
  address: string
  neighborhood: string
  city: string
  website?: string
  phone?: string
  schedule_description: string   // freeform: "Mon-Fri 4-7pm, $3 beers"
  deal_details: string
  notes?: string
  submitter_email?: string
}

export interface EditSuggestion {
  flow: 'suggest_edit'
  venue_id: string
  venue_name: string
  field_suggestions: string      // freeform description of what's wrong/changed
  new_schedule?: string
  new_deal_details?: string
  notes?: string
  submitter_email?: string
}

export type Contribution = NewVenueSubmission | EditSuggestion

export interface SubmissionResult {
  success: boolean
  message: string
  id?: string
}

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

export function validateNewVenue(data: Partial<NewVenueSubmission>): ValidationError[] {
  const errors: ValidationError[] = []
  if (!data.name?.trim()) errors.push({ field: 'name', message: 'Venue name is required' })
  if (!data.neighborhood?.trim()) errors.push({ field: 'neighborhood', message: 'Neighborhood is required' })
  if (!data.deal_details?.trim()) errors.push({ field: 'deal_details', message: 'Deal details are required' })
  if (data.submitter_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.submitter_email)) {
    errors.push({ field: 'submitter_email', message: 'Invalid email address' })
  }
  return errors
}

export function validateEditSuggestion(data: Partial<EditSuggestion>): ValidationError[] {
  const errors: ValidationError[] = []
  if (!data.venue_id) errors.push({ field: 'venue_id', message: 'Venue ID is required' })
  if (!data.field_suggestions?.trim()) errors.push({ field: 'field_suggestions', message: 'Please describe what needs to change' })
  return errors
}

// ─────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────

export async function submitContribution(contribution: Contribution): Promise<SubmissionResult> {
  Analytics.submissionStarted(contribution.flow)

  try {
    // DIRECT SAVE MODE — bypasses review queue, saves straight to venues table
    if (contribution.flow === 'new_venue') {
      const c = contribution as NewVenueSubmission

      // Insert venue
      const { data: venueData, error: venueErr } = await supabase
        .from('venues')
        .insert([{
          name: c.name.trim(),
          neighborhood: c.neighborhood.trim() || 'Unknown',
          city: c.city.trim() || 'Cincinnati',
          state: 'OH',
          address: c.address?.trim() || null,
          website: c.website?.trim() || null,
          phone: c.phone?.trim() || null,
          verification_status: 'community',
          data_source: 'user_submitted',
          is_featured: false,
          upvote_count: 0,
          dog_friendly: c.notes?.includes('Dog friendly') ?? false,
        }])
        .select('id')
        .single()

      if (venueErr) throw venueErr

      // Insert schedule
      await supabase.from('happy_hour_schedules').insert([{
        venue_id: venueData.id,
        days: '["Mon","Tue","Wed","Thu","Fri"]',
        start_time: '16:00',
        end_time: '19:00',
        is_all_day: false,
        deal_text: c.deal_details?.trim() || c.schedule_description?.trim() || 'See bar for details',
        deals: [],
      }])

      Analytics.submissionCompleted(contribution.flow, venueData.id)
      return {
        success: true,
        message: 'Added! The venue is now live on the app.',
        id: venueData.id,
      }
    }

    // For edit suggestions — still goes to contributions table for review
    const { data, error } = await supabase
      .from('contributions')
      .insert([{ flow: contribution.flow, data: contribution, status: 'pending', created_at: new Date().toISOString() }])
      .select('id')
      .single()

    if (error) {
      console.warn('contributions table not found:', contribution)
    }

    Analytics.submissionCompleted(contribution.flow, (contribution as EditSuggestion).venue_id)
    return {
      success: true,
      message: 'Thanks for the correction! We will review and update the listing.',
      id: data?.id,
    }

  } catch (e: any) {
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    }
  }
}
