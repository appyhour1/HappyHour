import React from 'react'

export interface BrandAd {
  id: string
  brand_name: string
  headline: string
  subtext: string
  logo_url: string
  logo_bg_color: string
  is_active: boolean
  position: number
}

export function SponsoredBanner({ ad }: { ad: BrandAd }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        background: '#3A3630', borderRadius: 14,
        padding: '14px 16px', display: 'flex',
        alignItems: 'center', gap: 14,
      }}>
        {/* Logo */}
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: ad.logo_bg_color || '#E85D1A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
        }}>
          {ad.logo_url
            ? <img src={ad.logo_url} alt={ad.brand_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
            : <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: -.3 }}>
                {ad.brand_name.slice(0, 2).toUpperCase()}
              </span>
          }
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
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, color: '#aaa', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3, paddingRight: 4 }}>
        Sponsored
      </div>
    </div>
  )
}
