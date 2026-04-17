/**
 * EmailPreviewPage.tsx
 * Route: /admin/email-preview
 *
 * Shows a live preview of the Thursday email using real venue data.
 * Use this to check what the email looks like before sending in Mailchimp.
 */

import React, { useMemo } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { getMinDealPrice } from '../utils/filters'
import { DEAL_TYPE_LABELS } from '../types'
import type { Venue, DealItem } from '../types'

const DEAL_ORDER = ['beer', 'cocktail', 'food', 'wine', 'general']

function sortDeals(deals: DealItem[]): DealItem[] {
  return [...deals].sort((a, b) => DEAL_ORDER.indexOf(a.type) - DEAL_ORDER.indexOf(b.type))
}

function DealPill({ deal }: { deal: DealItem }) {
  const colors: Record<string, { bg: string; color: string }> = {
    beer:     { bg: '#FFF8E8', color: '#7A5000' },
    cocktail: { bg: '#EFF6FF', color: '#1E40AF' },
    food:     { bg: '#F0FDF4', color: '#166534' },
    wine:     { bg: '#FFF0F6', color: '#7A0038' },
    general:  { bg: '#F5F3EF', color: '#4A4540' },
  }
  const c = colors[deal.type] ?? colors.general
  return (
    <span style={{
      display: 'inline-block',
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
      padding: '4px 11px', borderRadius: 20,
      marginRight: 5, marginBottom: 5,
    }}>
      {DEAL_TYPE_LABELS[deal.type as keyof typeof DEAL_TYPE_LABELS] ?? deal.type.toUpperCase()} {deal.description}
      {deal.price != null ? ` $${deal.price}` : ''}
    </span>
  )
}

function VenueEmailCard({ venue, rank }: { venue: Venue; rank: number }) {
  const schedule = venue.schedules?.[0]
  const deals = sortDeals(schedule?.deals ?? []).slice(0, 3)
  const days = schedule?.days?.join(', ') ?? ''
  const time = schedule
    ? schedule.is_all_day
      ? 'All day'
      : `${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`
    : ''

  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid #F0EDE8',
      padding: '18px 28px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 12,
            background: '#3A3630', color: '#E85D1A',
            fontSize: 11, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{rank}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1612', letterSpacing: '-.3px' }}>
            {venue.name}
          </span>
        </div>
        <span style={{
          background: '#DCFCE7', color: '#15803D',
          fontSize: 10, fontWeight: 700,
          padding: '3px 9px', borderRadius: 20,
          whiteSpace: 'nowrap',
        }}>
          This weekend
        </span>
      </div>

      <div style={{ fontSize: 12, color: '#A8A49C', marginBottom: 6 }}>
        {venue.neighborhood} · {venue.price_tier ?? ''}
        {venue.address ? ` · ${venue.address.split(',')[0]}` : ''}
      </div>

      {schedule && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E85D1A', marginBottom: 10 }}>
          {days} · {time}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        {deals.map((d, i) => <DealPill key={i} deal={d} />)}
      </div>

      <a
        href={`/venue/${venue.id}`}
        style={{
          display: 'inline-block',
          background: '#3A3630', color: '#fff',
          fontSize: 12, fontWeight: 700,
          padding: '8px 16px', borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        View deals →
      </a>
    </div>
  )
}

function formatTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`
}

export default function EmailPreviewPage() {
  const { venues, city } = useAppContext()

  const topVenues = useMemo(() => {
    return [...venues]
      .filter(v => (v.schedules ?? []).length > 0)
      .sort((a, b) => {
        const aPrice = getMinDealPrice(a) ?? 999
        const bPrice = getMinDealPrice(b) ?? 999
        if (aPrice !== bPrice) return aPrice - bPrice
        return b.upvote_count - a.upvote_count
      })
      .slice(0, 5)
  }, [venues])

  const thisThursday = new Date()
  thisThursday.setDate(thisThursday.getDate() + ((4 - thisThursday.getDay() + 7) % 7 || 7))
  const dateStr = thisThursday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ background: '#F5F3EF', minHeight: '100vh', padding: '24px 16px' }}>

      {/* Admin toolbar */}
      <div style={{
        maxWidth: 580, margin: '0 auto 20px',
        background: '#3A3630', borderRadius: 12,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>📧 Email Preview</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>Next send: Thursday {dateStr} at 2 PM</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/email-template.html"
            download
            style={{
              background: '#E85D1A', color: '#fff',
              fontSize: 12, fontWeight: 700,
              padding: '8px 14px', borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Download HTML
          </a>
        </div>
      </div>

      {/* Email preview */}
      <div style={{ maxWidth: 580, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: '#3A3630',
          borderRadius: '16px 16px 0 0',
          padding: '28px 32px 24px',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#F5F3EF', letterSpacing: -1.5, fontStyle: 'italic' }}>Appy</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#E85D1A', letterSpacing: -1.5, fontStyle: 'italic' }}>Hour</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            {city}, OH
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            This Weekend's Best Happy Hours 🍺
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
            Hand-picked deals for Friday & Saturday
          </div>
        </div>

        {/* Live banner */}
        <div style={{
          background: '#22C55E',
          padding: '10px 24px',
          textAlign: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
        }}>
          🟢 &nbsp;{venues.length} venues with active happy hour deals this weekend
        </div>

        {/* Section header */}
        <div style={{
          background: '#fff',
          padding: '20px 28px 0',
          borderTop: '1px solid #EAE6DF',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8A8580', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
            Editor's picks
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1612', letterSpacing: '-.4px', paddingBottom: 16 }}>
            Top {topVenues.length} Deals This Weekend
          </div>
        </div>

        {/* Venue cards */}
        {topVenues.map((venue, i) => (
          <VenueEmailCard key={venue.id} venue={venue} rank={i + 1} />
        ))}

        {/* CTA */}
        <div style={{
          background: '#fff',
          padding: '24px 28px',
          textAlign: 'center',
          borderTop: '1px solid #EAE6DF',
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1612', marginBottom: 6 }}>
            See all {venues.length} venues →
          </div>
          <div style={{ fontSize: 13, color: '#8A8580', marginBottom: 14 }}>
            Live deals, verified by the community. Updated in real time.
          </div>
          <a
            href="/"
            style={{
              display: 'inline-block',
              background: '#E85D1A', color: '#fff',
              fontSize: 14, fontWeight: 700,
              padding: '12px 28px', borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Open Appy Hour 🍺
          </a>
        </div>

        {/* Footer */}
        <div style={{
          background: '#3A3630',
          borderRadius: '0 0 16px 16px',
          padding: '24px 28px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'rgba(255,255,255,.3)', fontStyle: 'italic', letterSpacing: -1, marginBottom: 8 }}>
            Appy<span style={{ color: '#E85D1A' }}>Hour</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', lineHeight: 1.6 }}>
            You're receiving this because you signed up at appyhour.com<br />
            Unsubscribe · Update preferences
          </div>
        </div>

      </div>

      {/* Instructions */}
      <div style={{
        maxWidth: 580, margin: '24px auto 0',
        background: '#fff', borderRadius: 12,
        padding: '20px 24px',
        border: '1px solid #EAE6DF',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612', marginBottom: 12 }}>
          📋 How to send this in Mailchimp
        </div>
        {[
          'Log into Mailchimp → Campaigns → Create Campaign → Email',
          'Choose "Regular" email type',
          'Select your audience (your Appy Hour signup list)',
          'Subject line: "This weekend\'s best happy hours in Cincinnati 🍺"',
          'Preview text: "5 deals worth leaving work early for"',
          'In the email editor → choose "Code your own" → paste the HTML from email-template.html',
          'Replace the venue names/deals with your current top picks',
          'Schedule for Thursday at 2:00 PM',
          'Send a test email to yourself first!',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{
              width: 22, height: 22, borderRadius: 11,
              background: '#E85D1A', color: '#fff',
              fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>{i + 1}</span>
            <span style={{ fontSize: 13, color: '#4A4540', lineHeight: 1.5 }}>{step}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
