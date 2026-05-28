/**
 * contributionService.ts
 *
 * Handles user-submitted venue additions and edit suggestions.
 * ALL submissions go through the contributions review queue.
 * Admin reviews and approves/rejects via AdminPage.
 *
 * FLOW:
 *   User submits → contributions table (status: pending)
 *   Admin reviews → approves → venue goes live in venues table
 *   Admin reviews → rejects → contribution marked rejected
 *
 * WHY THE OLD "DIRECT SAVE MODE" WAS REMOVED:
 * - It bypassed admin review entirely — any user could put any content live
 * - It called /api/scan (wrong endpoint — should be /api/scan-menu) so AI
 *   parsing silently failed on every submission anyway
 * - It used claude-sonnet (expensive) when haiku handles deal parsing fine
 * - Admin "Pending approvals" tab was only receiving edit suggestions, not
 *   new venue submissions — making it useless for its primary purpose
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
  latitude?: number
  longitude?: number
  dog_friendly?: boolean
  schedule_description: string
  deal_details: string
  schedules?: ScheduleSubmission[]
  notes?: string
  submitter_email?: string
}

export interface ScheduleSubmission {
  days: string[]
  start_time: string
  end_time: string
  is_all_day: boolean
  deal_text: string
  deals: DealSubmission[]
}

export interface DealSubmission {
  type: string
  description: string
  price?: number | null
}

export interface EditSuggestion {
  flow: 'suggest_edit'
  venue_id: string
  venue_name: string
  field_suggestions: string
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
  if (!data.deal_details?.trim() && !data.schedules?.length) {
    errors.push({ field: 'deal_details', message: 'Deal details are required' })
  }
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
// ADMIN NOTIFICATION
// ─────────────────────────────────────────────

async function notifyAdmin(contribution: Contribution): Promise<void> {
  try {
    const isNew = contribution.flow === 'new_venue'
    const c = contribution as NewVenueSubmission

    await fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue_name: isNew ? c.name : (contribution as EditSuggestion).venue_name,
        neighborhood: isNew ? c.neighborhood : undefined,
        deal_details: isNew ? (c.deal_details || c.schedule_description) : (contribution as EditSuggestion).field_suggestions,
        submitter_email: c.submitter_email,
        schedules: isNew ? c.schedules : undefined,
      }),
    })
  } catch {
    // Never fail the submission if the email fails
  }
}

// ─────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────

export async function submitContribution(contribution: Contribution): Promise<SubmissionResult> {
  Analytics.submissionStarted(contribution.flow)

  try {
    // ALL submissions — both new venues and edit suggestions — go through
    // the contributions table for admin review before anything goes live.
    const { data, error } = await supabase
      .from('contributions')
      .insert([{
        flow: contribution.flow,
        data: contribution,
        status: 'pending',
        created_at: new Date().toISOString(),
      }])
      .select('id')
      .single()

    if (error) throw error

    // Notify admin — fire and forget, don't await
    notifyAdmin(contribution)

    Analytics.submissionCompleted(
      contribution.flow,
      contribution.flow === 'suggest_edit' ? (contribution as EditSuggestion).venue_id : undefined
    )

    return {
      success: true,
      message: contribution.flow === 'new_venue'
        ? 'Thanks! Your submission is under review and will go live once approved.'
        : 'Thanks for the correction! We will review and update the listing.',
      id: data?.id,
    }
  } catch (e: any) {
    console.error('submitContribution error:', e)
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    }
  }
}
