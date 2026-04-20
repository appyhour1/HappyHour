/**
 * SponsoredBanner.tsx
 * Charcoal banner ad shown between venue cards.
 * Brand logo, headline, subtext, CTA button.
 * Managed via brand_ads table in Supabase.
 */

import React from 'react'

export interface BrandAd {
  id: string
  brand_name: string
  headline: string
  subtext: string
  cta_label: string
  cta_url: string
  logo_emoji: string
  logo_bg_color: string
  is_active: boolean
  position: number
}

export function SponsoredBanner({ ad }: { ad: BrandAd }) {
  function handleCta(e: React.MouseEvent) {
    e.stopPropagation()
    if (ad.cta_url) window.open(ad.cta_url, '_blank')
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        background: '#3A3630',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        {/* Logo */}
        <div style={{
          width: 44, height: 44,
          borderRadius: 10,
          background: ad.logo_bg_color || '#E85D1A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          {ad.logo_emoji || '🍺'}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ad.headline}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ad.subtext}
          </div>
        </div>

        {/* CTA */}
        <button onClick={handleCta} style={{
          background: '#E85D1A', color: '#fff',
          border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          fontFamily: 'inherit', transition: 'opacity .15s',
        }}>
          {ad.cta_label || 'Learn more'}
        </button>
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, color: '#aaa', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3, paddingRight: 4 }}>
        Sponsored
      </div>
    </div>
  )
}
